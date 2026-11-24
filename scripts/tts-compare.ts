// Compares en-US TTS voices (batch 3): price, latency, file size. Uploads the
// clips to the public `tts` bucket under samples/ so they can be listened to.
// Run: npx tsx --env-file=.env.local scripts/tts-compare.ts
// Every call is reserved and billed in ai_usage (feature "compare").
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { reserve, settle } from "@/lib/memora/ai/budget";
import { monthlyLimitUsd } from "@/lib/memora/ai/config";
import { estimateTtsCost, ttsCost, ttsModels } from "@/lib/memora/ai/pricing";
import { geminiTtsProvider, openAiTtsProvider, type TtsProvider } from "@/lib/memora/ai/providers";
import type { Database } from "@/lib/supabase/database.types";

const texts = ["figure out", "I finally figured it out.", "Could you pull up a chair and join us?"];
const variants: Array<[string, string]> = [
  ["gpt-4o-mini-tts", "alloy"],
  ["gpt-4o-mini-tts", "coral"],
  ["tts-1", "alloy"],
  ["gemini-3.8-flash-lite-tts", "Kore"],
  ["gemini-2.5-flash-preview-tts", "Kore"],
];

const admin = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

function providerFor(model: string, voice: string): TtsProvider {
  const price = ttsModels[model];
  return price.provider === "openai"
    ? openAiTtsProvider(process.env.OPENAI_API_KEY!, model, voice)
    : geminiTtsProvider(process.env.GEMINI_API_KEY!, model, voice);
}

async function main() {
  const rows: string[] = [];
  let total = 0;
  for (const [model, voice] of variants) {
    const provider = providerFor(model, voice);
    let cost = 0;
    let seconds = 0;
    let bytes = 0;
    let usageNote = "";
    const links: string[] = [];
    try {
      for (const [index, text] of texts.entries()) {
        const reservation = await reserve(admin, {
          userId: null,
          feature: "compare",
          provider: provider.provider,
          model,
          estimateUsd: estimateTtsCost(model, text),
          monthlyLimitUsd: monthlyLimitUsd(),
        });
        const started = performance.now();
        try {
          const { audio, mime, usage } = await provider.synthesize(text);
          seconds += (performance.now() - started) / 1000;
          const exact = usage.outputTokens !== undefined || ttsModels[model].perMillionChars !== undefined;
          if (!exact) usageNote = " (оцінка: провайдер не повернув токени)";
          const callCost = exact ? ttsCost(model, usage) : estimateTtsCost(model, text);
          cost += callCost;
          bytes += audio.length;
          await settle(admin, reservation, { status: "ok", costUsd: callCost, ...usage });
          const path = `samples/${model}-${voice}-${index + 1}.${mime === "audio/wav" ? "wav" : "mp3"}`.toLowerCase();
          const upload = await admin.storage.from("tts").upload(path, audio, { contentType: mime, upsert: true });
          if (upload.error) throw upload.error;
          links.push(`[${index + 1}](${admin.storage.from("tts").getPublicUrl(path).data.publicUrl})`);
        } catch (error) {
          await settle(admin, reservation, { status: "failed", costUsd: 0 });
          throw error;
        }
      }
      total += cost;
      const chars = texts.join("").length;
      rows.push(
        `| ${model} · ${voice} | ${(seconds / texts.length).toFixed(1)} | ${Math.round(bytes / 1024)} | $${cost.toFixed(5)}${usageNote} | $${((cost / chars) * 1_000_000).toFixed(2)} | ${links.join(" ")} |`,
      );
      console.log(`${model} ${voice}: $${cost.toFixed(5)}, ${(seconds / texts.length).toFixed(1)} s/clip, ${bytes} B`);
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 160) : String(error);
      rows.push(`| ${model} · ${voice} | — | — | помилка: ${message.replace(/\|/g, "/").replace(/\n/g, " ")} | — | — |`);
      console.log(`${model} ${voice}: ${message}`);
    }
  }

  const lines = [
    "## Голоси (TTS)",
    "",
    `Тексти: ${texts.map((text) => `«${text}»`).join(", ")}. Вартість усього тесту голосів: **$${total.toFixed(4)}**.`,
    "",
    "| Модель · голос | Час на кліп, с | Розмір 3 кліпів, КБ | Вартість 3 кліпів | $ за 1 млн символів | Послухати |",
    "|---|---|---|---|---|---|",
    ...rows,
    "",
  ];
  fs.writeFileSync("C:/tmp/memora-tts-compare.md", lines.join("\n"));
  console.log(`Total $${total.toFixed(4)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
