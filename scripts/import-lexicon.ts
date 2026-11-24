// Imports the program lists (data/lexicon) into the shared lexicon. Idempotent:
// upserts lexicon rows (never touches AI content) and syncs lexicon_lists.
// Run: npx tsx --env-file=.env.local scripts/import-lexicon.ts
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { lemmaKey } from "@/lib/memora/duplicates";
import type { ProgramList } from "@/lib/memora/program";
import type { Database } from "@/lib/supabase/database.types";

const admin = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const dir = "data/lexicon";
// Primary list of a lemma (lexicon.source_list): the first list it appears in.
const sources: Array<{ list: ProgramList; file: string; rankColumn: number | null }> = [
  { list: "ngsl", file: "NGSL_12_stats.csv", rankColumn: 1 },
  { list: "ngsl_spoken", file: "NGSL-Spoken_12_stats.csv", rankColumn: 1 },
  { list: "bsl", file: "BSL_120_stats.csv", rankColumn: 1 },
  { list: "theme_work", file: "themes_work.csv", rankColumn: null },
  { list: "theme_travel", file: "themes_travel.csv", rankColumn: null },
  { list: "theme_talk", file: "themes_talk.csv", rankColumn: null },
];

function rows(file: string) {
  return fs.readFileSync(`${dir}/${file}`, "utf8").replace(/^﻿/, "").trim().split(/\r?\n/).slice(1);
}

function chunks<T>(items: T[], size: number) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

async function main() {
  const frequency = new Map(
    rows("frequency_12k.csv").map((line) => {
      const [lemma, rank] = line.split(",");
      return [lemma, Number(rank)] as const;
    }),
  );

  const lists = new Map<ProgramList, Map<string, number>>();
  const primary = new Map<string, ProgramList>();
  for (const source of sources) {
    const entries = new Map<string, number>();
    rows(source.file).forEach((line, index) => {
      // Themed phrases may contain commas ("check, please"): the whole line is the text.
      const text = source.rankColumn === null ? line : line.split(",")[0];
      const lemma = lemmaKey(text);
      const rank = source.rankColumn === null ? index + 1 : Number(line.split(",")[source.rankColumn]);
      if (!lemma || !(rank > 0) || entries.has(lemma)) return;
      entries.set(lemma, rank);
      if (!primary.has(lemma)) primary.set(lemma, source.list);
    });
    lists.set(source.list, entries);
    console.log(`${source.list}: ${entries.size}`);
  }

  const lexiconRows = [...primary.entries()].map(([lemma, list]) => ({
    lemma,
    part_of_speech: "",
    frequency_rank: frequency.get(lemma) ?? null,
    source_list: list,
  }));
  const ids = new Map<string, string>();
  for (const chunk of chunks(lexiconRows, 500)) {
    const { data, error } = await admin
      .from("lexicon")
      .upsert(chunk, { onConflict: "lemma,part_of_speech" })
      .select("id,lemma");
    if (error) throw error;
    for (const row of data) ids.set(row.lemma, row.id);
  }
  console.log(`lexicon rows upserted: ${ids.size}`);

  for (const [list, entries] of lists) {
    const wanted = [...entries.entries()].map(([lemma, rank]) => ({ list, lexicon_id: ids.get(lemma)!, rank }));
    for (const chunk of chunks(wanted, 500)) {
      const { error } = await admin.from("lexicon_lists").upsert(chunk, { onConflict: "list,lexicon_id" });
      if (error) throw error;
    }
    const { data: existing, error } = await admin.from("lexicon_lists").select("lexicon_id").eq("list", list).limit(10000);
    if (error) throw error;
    const keep = new Set(wanted.map((row) => row.lexicon_id));
    const stale = existing.map((row) => row.lexicon_id).filter((id) => !keep.has(id));
    for (const chunk of chunks(stale, 200)) {
      const { error: deleteError } = await admin.from("lexicon_lists").delete().eq("list", list).in("lexicon_id", chunk);
      if (deleteError) throw deleteError;
    }
    console.log(`${list}: ${wanted.length} linked, ${stale.length} stale removed`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
