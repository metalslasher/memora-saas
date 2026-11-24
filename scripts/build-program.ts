// One-off build of the program content (batch 4). Every call is reserved and
// billed in ai_usage (feature "program_build"); the run stops at MAX_RUN_USD.
//
//   npx tsx --env-file=.env.local scripts/build-program.ts themes
//     → data/lexicon/themes_{work,travel,talk}.csv (reviewed by hand afterwards)
//   npx tsx --env-file=.env.local scripts/build-program.ts test-pool
//     → src/lib/memora/vocab-test-pool.ts (band words with a Ukrainian meaning,
//       checked pseudowords; reviewed by hand afterwards)
//
// Optional: MEMORA_FREQ_FULL=<path to the 31K list as JSON rows> to check the
// pseudowords against all 31,000 lemmas instead of the 12K extract.
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { reserve, settle } from "@/lib/memora/ai/budget";
import { monthlyLimitUsd, textProviderFromEnv } from "@/lib/memora/ai/config";
import { textCost } from "@/lib/memora/ai/pricing";
import type { Database } from "@/lib/supabase/database.types";

const MAX_RUN_USD = 0.5;
const admin = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const provider = textProviderFromEnv();
if (!provider) throw new Error("No text provider configured");
let spent = 0;

async function ask<T>(system: string, user: string, schema: Record<string, unknown>, outputTokens: number): Promise<T> {
  const estimateUsd = textCost(provider!.model, Math.ceil((system.length + user.length) / 3), outputTokens);
  if (spent + estimateUsd > MAX_RUN_USD) throw new Error(`Run limit $${MAX_RUN_USD} reached`);
  const reservation = await reserve(admin, {
    userId: null,
    feature: "program_build",
    provider: provider!.provider,
    model: provider!.model,
    estimateUsd,
    monthlyLimitUsd: monthlyLimitUsd(),
  });
  try {
    const { data, usage } = await provider!.generateJson({ system, user, schema, schemaName: "items", maxOutputTokens: outputTokens });
    const costUsd = textCost(provider!.model, usage.inputTokens, usage.outputTokens);
    spent += costUsd;
    await settle(admin, reservation, { status: "ok", costUsd, ...usage });
    return data as T;
  } catch (error) {
    await settle(admin, reservation, { status: "failed", costUsd: 0 });
    throw error;
  }
}

/* ---------------- themed lists ---------------- */

const themes = {
  work: "Work and IT: everyday English of an office or tech job — meetings, email and chat, deadlines, priorities, feedback, remote work, hiring, software teams. Collocations (meet a deadline), phrasal verbs (follow up), short fixed phrases (let me know). No jargon only engineers use.",
  travel: "Travel: airports and flights, hotels and rentals, directions and transit, restaurants and cafes, shopping and paying, renting a car, small problems and emergencies on a trip.",
  talk: "Everyday conversation: small talk, reacting and showing interest, agreeing and disagreeing, feelings, making plans, asking for and giving opinions, casual expressions and phrasal verbs friends use.",
} as const;

const themeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: { items: { type: "array", items: { type: "string" } } },
};

const themeSystem = `You build vocabulary lists for Ukrainian adults learning American English (around B1–B2).
List only phrases, collocations, phrasal verbs and fixed expressions that native speakers in the US really use today, in natural modern American English. Not textbook English, no British forms, nothing dated or rare.
Rules for each item: 2–5 words; lowercase except "I" and proper nouns; no final period; a question keeps its question mark; no slashes, brackets or alternatives; one item per idea (no near-duplicates); skip items a B1 learner already knows (like "good morning").`;

async function buildThemes() {
  for (const [name, description] of Object.entries(themes)) {
    const { items } = await ask<{ items: string[] }>(
      themeSystem,
      `Theme — ${description}\nReturn exactly 140 unique items, most useful first.`,
      themeSchema,
      6000,
    );
    const seen = new Set<string>();
    const clean = items
      .map((item) => item.trim().replace(/\s+/g, " ").replace(/\.$/, ""))
      .filter((item) => item && item.length <= 60 && !seen.has(item.toLowerCase()) && seen.add(item.toLowerCase()));
    fs.writeFileSync(`data/lexicon/themes_${name}.csv`, ["text", ...clean].join("\n") + "\n");
    console.log(`${name}: ${clean.length} items · total $${spent.toFixed(4)}`);
  }
}

/* ---------------- vocabulary test pool ---------------- */

const BAND_SIZE = 1000;
const BANDS = 10;
const CANDIDATES_PER_BAND = 30;
const WORDS_PER_BAND = 14;

const pseudowordDrafts = [
  "crumplish", "snarvel", "plinter", "drossage", "fendrick", "glammet", "tropple", "wendle", "sluvish",
  "morkle", "bratten", "quindle", "fusket", "drimble", "plaxon", "stobble", "crandish", "velture",
  "harbish", "contrivial", "disperment", "obsolate", "rendacious", "fluxtion", "presumptal", "mensible",
  "alberation", "plaudate", "spaunch", "exprate", "rebondicate", "flendy", "gravolent", "sprindle",
  "carmotion", "depravish", "implosure", "lurgate", "nomitive", "oxtrality", "perfuncture", "quelsome",
  "restitate", "scrallow", "tentacy", "unsterve", "vandrous", "blenture", "cradency", "dismaction",
  "elphony", "fortlish", "hackrel", "indulcate", "jostrum", "kindlage", "loftment", "marplish",
  "ploverous", "rambulate", "trundish", "wrangish",
];

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function readFrequency() {
  const lines = fs.readFileSync("data/lexicon/frequency_12k.csv", "utf8").trim().split(/\r?\n/).slice(1);
  return lines.map((line) => {
    const [lemma, rank] = line.split(",");
    return { lemma, rank: Number(rank) };
  });
}

const poolSchema = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["word", "ok", "uk"],
        properties: { word: { type: "string" }, ok: { type: "boolean" }, uk: { type: "string" } },
      },
    },
  },
};

const poolSystem = `You check words for a yes/no vocabulary test for Ukrainian speakers learning American English.
For every input word return one item:
- word: exactly as given.
- ok: true only if it is a standalone, standard English word a dictionary lists as a headword; false for proper nouns and names (people, places, brands), abbreviations, slurs or vulgar words, archaic or very technical words, foreign words, interjections, and words that are mostly just an inflected form of another word (plural, past tense).
- uk: its most common meaning as a short Ukrainian translation (1–3 words), in standard modern Ukrainian, no Russian or surzhyk words. Empty if ok is false.`;

const realSchema = {
  type: "object",
  additionalProperties: false,
  required: ["real"],
  properties: { real: { type: "array", items: { type: "string" } } },
};

async function buildTestPool() {
  const frequency = readFrequency();
  const known = new Set(frequency.map((entry) => entry.lemma));
  const fullPath = process.env.MEMORA_FREQ_FULL;
  if (fullPath) {
    for (const row of JSON.parse(fs.readFileSync(fullPath, "utf8")) as Array<{ A?: string }>) {
      if (row.A) known.add(String(row.A).trim().toLowerCase());
    }
  }
  const random = seeded(20261124);
  const bands: Array<{ band: number; words: Array<{ word: string; uk: string; rank: number }> }> = [];

  for (let band = 1; band <= BANDS; band += 1) {
    const inBand = frequency.filter(
      (entry) =>
        entry.rank > (band - 1) * BAND_SIZE &&
        entry.rank <= band * BAND_SIZE &&
        /^[a-z]{4,}$/.test(entry.lemma) &&
        // Band 1 starts with grammar words; the test asks about content words.
        entry.rank > 150,
    );
    const candidates = [...inBand].sort(() => random() - 0.5).slice(0, CANDIDATES_PER_BAND);
    const { items } = await ask<{ items: Array<{ word: string; ok: boolean; uk: string }> }>(
      poolSystem,
      `Words:\n${candidates.map((entry) => entry.lemma).join("\n")}`,
      poolSchema,
      2500,
    );
    const ranks = new Map(candidates.map((entry) => [entry.lemma, entry.rank]));
    const words = items
      .filter((item) => item.ok && item.uk.trim() && ranks.has(item.word))
      .slice(0, WORDS_PER_BAND)
      .map((item) => ({ word: item.word, uk: item.uk.trim().toLowerCase(), rank: ranks.get(item.word)! }));
    bands.push({ band, words });
    console.log(`band ${band}: ${words.length} words · total $${spent.toFixed(4)}`);
  }

  const notListed = pseudowordDrafts.filter((word) => !known.has(word));
  const { real } = await ask<{ real: string[] }>(
    "You are an English lexicographer.",
    `Which of these strings are real English words, names, brands, or common slang? Return only those.\n${notListed.join("\n")}`,
    realSchema,
    800,
  );
  const realSet = new Set(real.map((word) => word.trim().toLowerCase()));
  const pseudowords = notListed.filter((word) => !realSet.has(word));
  console.log(`pseudowords: ${pseudowords.length} kept, dropped: ${[...realSet].join(", ") || "none"}`);

  const file = `// Generated by scripts/build-program.ts test-pool, then reviewed by hand.
// Band words: "NGSL with SFI (31K)" by Browne, Culligan & Phillips (CC BY-SA 4.0),
// band = 1,000 lemmas by raw frequency rank. Pseudowords: Memora's own, checked
// against the 31K list and by AI.
import type { TestPool } from "./vocab-test";

export const vocabTestPool: TestPool = ${JSON.stringify({ bands, pseudowords }, null, 2)};
`;
  fs.writeFileSync("src/lib/memora/vocab-test-pool.ts", file);
  console.log(`done · total $${spent.toFixed(4)}`);
}

async function main() {
  const command = process.argv[2];
  if (command === "themes") await buildThemes();
  else if (command === "test-pool") await buildTestPool();
  else console.log("Usage: build-program.ts themes | test-pool");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
