// Side-by-side test of the text models for word enrichment (batch 3).
// Run: npx tsx --env-file=.env.local scripts/ai-compare.ts [model ...]
// Every call is reserved and billed in ai_usage (feature "compare") and the
// run stops once it has spent MAX_RUN_USD. Writes the results table to
// C:/tmp/memora-ai-compare.md (copied into docs/ai-compare.md) and raw JSON.
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { reserve, settle } from "@/lib/memora/ai/budget";
import { monthlyLimitUsd } from "@/lib/memora/ai/config";
import {
  enrichmentSchema,
  enrichmentSystemPrompt,
  enrichmentUserPrompt,
  estimateEnrichmentTokens,
  parseEnrichment,
  type EnrichedWord,
  type EnrichRequest,
} from "@/lib/memora/ai/enrichment";
import { PRICES_CHECKED_AT, textCost, textModels } from "@/lib/memora/ai/pricing";
import { geminiTextProvider, openAiTextProvider, type TextProvider } from "@/lib/memora/ai/providers";
import type { Database } from "@/lib/supabase/database.types";

const MAX_RUN_USD = 0.5;
const BATCH = 10;

const words = [
  // phrasal verbs
  "figure out", "give up", "run into", "put off", "come up with", "look forward to", "hang out",
  // polysemous
  "run", "set", "fair", "light", "charge", "address", "bank",
  // idioms
  "break the ice", "piece of cake", "under the weather", "call it a day", "no big deal",
  // simple nouns
  "apple", "kitchen", "umbrella", "chair",
  // adjectives / verbs
  "reliable", "awkward", "overwhelm", "cheerful",
  // false friends for Ukrainian speakers
  "actually", "eventually", "sympathetic", "magazine",
];

type RunResult = {
  model: string;
  provider: string;
  error?: string;
  seconds: number;
  singleSeconds: number[];
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  items: Record<string, EnrichedWord | null>;
};

const admin = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
let spent = 0;

function providerFor(model: string): TextProvider | null {
  const price = textModels[model];
  if (!price) throw new Error(`Unknown model ${model}`);
  const key = price.provider === "openai" ? process.env.OPENAI_API_KEY : process.env.GEMINI_API_KEY;
  if (!key) return null;
  return price.provider === "openai" ? openAiTextProvider(key, model) : geminiTextProvider(key, model);
}

async function call(provider: TextProvider, requests: EnrichRequest[]) {
  const estimate = estimateEnrichmentTokens(requests);
  const estimateUsd = textCost(provider.model, estimate.input, estimate.output * 2);
  if (spent + estimateUsd > MAX_RUN_USD) throw new Error(`Run limit $${MAX_RUN_USD} reached`);
  const reservation = await reserve(admin, {
    userId: null,
    feature: "compare",
    provider: provider.provider,
    model: provider.model,
    estimateUsd,
    monthlyLimitUsd: monthlyLimitUsd(),
  });
  const started = performance.now();
  try {
    const { data, usage } = await provider.generateJson({
      system: enrichmentSystemPrompt,
      user: enrichmentUserPrompt(requests),
      schema: enrichmentSchema,
      schemaName: "vocabulary_cards",
      maxOutputTokens: Math.min(16_000, estimate.output * 3),
    });
    const costUsd = textCost(provider.model, usage.inputTokens, usage.outputTokens);
    spent += costUsd;
    await settle(admin, reservation, { status: "ok", costUsd, ...usage });
    return { parsed: parseEnrichment(data, requests), usage, costUsd, seconds: (performance.now() - started) / 1000 };
  } catch (error) {
    await settle(admin, reservation, { status: "failed", costUsd: 0 });
    throw error;
  }
}

async function run(model: string): Promise<RunResult> {
  const provider = providerFor(model);
  const result: RunResult = {
    model,
    provider: textModels[model].provider,
    seconds: 0,
    singleSeconds: [],
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    items: {},
  };
  if (!provider) return { ...result, error: "no API key" };
  try {
    for (let start = 0; start < words.length; start += BATCH) {
      const requests = words.slice(start, start + BATCH).map((input) => ({ input }));
      const response = await call(provider, requests);
      result.seconds += response.seconds;
      result.inputTokens += response.usage.inputTokens;
      result.outputTokens += response.usage.outputTokens;
      result.costUsd += response.costUsd;
      requests.forEach((request, index) => (result.items[request.input] = response.parsed[index]));
    }
    // Latency of a single word (the add form).
    for (const input of ["serendipity", "take for granted", "grumpy"]) {
      const response = await call(provider, [{ input }]);
      result.singleSeconds.push(response.seconds);
      result.inputTokens += response.usage.inputTokens;
      result.outputTokens += response.usage.outputTokens;
      result.costUsd += response.costUsd;
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message.slice(0, 200) : String(error);
  }
  console.log(`${model}: ${result.error ?? "ok"} · $${result.costUsd.toFixed(4)} · ${result.seconds.toFixed(1)} s`);
  return result;
}

function cell(word: EnrichedWord | null | undefined) {
  if (!word) return "—";
  const example = word.examples[0];
  const escape = (text: string) => text.replace(/\|/g, "\\|");
  return escape(
    `**${word.translations.join(", ")}**<br>${example ? `${example.en}<br>_${example.uk}_` : "немає прикладу"}`,
  );
}

async function main() {
  const models = process.argv.slice(2).length
    ? process.argv.slice(2)
    : ["gpt-5-nano", "gpt-6-luna", "gemini-2.5-flash-lite", "gemini-3.5-flash-lite"];
  const results: RunResult[] = [];
  for (const model of models) results.push(await run(model));

  fs.mkdirSync("C:/tmp", { recursive: true });
  fs.writeFileSync("C:/tmp/memora-ai-compare.json", JSON.stringify(results, null, 2));

  const ok = results.filter((result) => !result.error || Object.keys(result.items).length > 0);
  const lines = [
    "## Результати прогону",
    "",
    `Дата: ${new Date().toISOString().slice(0, 10)} · ціни звірено ${PRICES_CHECKED_AT} · ${words.length} слів пачками по ${BATCH} + 3 окремі слова на модель.`,
    `Фактична вартість усього тесту: **$${spent.toFixed(4)}** (записано в \`ai_usage\`, feature \`compare\`).`,
    "",
    "| Модель | Валідних карток | Час 30 слів, с | Одне слово, с | Токени in/out | Вартість, $ | $ за 1000 слів |",
    "|---|---|---|---|---|---|---|",
    ...results.map((result) => {
      const valid = Object.values(result.items).filter(Boolean).length;
      const single = result.singleSeconds.length
        ? (result.singleSeconds.reduce((a, b) => a + b, 0) / result.singleSeconds.length).toFixed(1)
        : "—";
      const perThousand = valid ? ((result.costUsd / (valid + result.singleSeconds.length)) * 1000).toFixed(2) : "—";
      return `| ${result.model}${result.error ? ` (помилка: ${result.error.replace(/\|/g, "/")})` : ""} | ${valid}/${words.length} | ${result.seconds.toFixed(1)} | ${single} | ${result.inputTokens}/${result.outputTokens} | ${result.costUsd.toFixed(4)} | ${perThousand} |`;
    }),
    "",
    "### Переклади й перший приклад поруч",
    "",
    `| Слово | ${ok.map((result) => result.model).join(" | ")} |`,
    `|---|${ok.map(() => "---").join("|")}|`,
    ...words.map((word) => `| ${word} | ${ok.map((result) => cell(result.items[word])).join(" | ")} |`),
    "",
  ];
  fs.writeFileSync("C:/tmp/memora-ai-compare.md", lines.join("\n"));
  console.log(`Spent $${spent.toFixed(4)}. Wrote C:/tmp/memora-ai-compare.md`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
