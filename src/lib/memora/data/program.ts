import { after } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { MAX_BATCH } from "../ai/enrichment";
import { enrichWords } from "../ai/service";
import { newWordsPerDay } from "../pace";
import {
  calibrate,
  cleanGoals,
  feedLists,
  feedNeed,
  listFloor,
  planFeed,
  type Candidate,
  type PlannedWord,
  type ProgramList,
} from "../program";
import type { PracticeSummary, Profile, WordContent } from "../types";
import { readTestResult } from "../vocab-test";
import { readWordContent } from "../word-content";
import { isUniqueViolation, must, type Db } from "./db";
import { savePosition } from "./profile";
import { insertWordsWithCards, type NewWord } from "./words";

type ProgramCandidate = Candidate & { content: WordContent; enriched: boolean };

const CANDIDATE_SLACK = 5;
/** Calibrate at most this often (a change also resets its sample). */
const CALIBRATION_INTERVAL_MS = 20 * 60 * 60 * 1000;

function isOnboarded(profile: Profile): profile is Profile & { programRank: number; knownRank: number } {
  return profile.onboardedAt !== null && profile.programRank !== null && profile.knownRank !== null;
}

async function loadCandidates(db: Db, lists: ProgramList[], programRank: number, limit: number) {
  const entries = await Promise.all(
    lists.map(async (list) => {
      const rows = must(
        await db.rpc("get_program_candidates", { p_list: list, p_min_rank: listFloor(list, programRank), p_limit: limit }),
      );
      const candidates: ProgramCandidate[] = rows.map((row) => ({
        lexiconId: row.lexicon_id,
        lemma: row.lemma,
        list,
        listRank: row.list_rank,
        frequencyRank: row.frequency_rank,
        content: readWordContent(row.content),
        enriched: row.enriched,
      }));
      return [list, candidates] as const;
    }),
  );
  return Object.fromEntries(entries) as Partial<Record<ProgramList, ProgramCandidate[]>>;
}

/**
 * Fills the AI content of words the shared lexicon has not enriched yet (one
 * request per 20 words, cached for everyone). Returns content per lexicon id;
 * words that could not be filled are missing from the map.
 */
async function enrichCandidates(userId: string, words: ProgramCandidate[]) {
  const contents = new Map<string, WordContent>();
  for (const word of words) if (word.enriched) contents.set(word.lexiconId, word.content);

  const missing = words.filter((word) => !word.enriched);
  const admin = missing.length > 0 ? createSupabaseAdminClient() : null;
  if (!admin) return contents;

  for (let start = 0; start < missing.length; start += MAX_BATCH) {
    const batch = missing.slice(start, start + MAX_BATCH);
    let results;
    try {
      results = await enrichWords(userId, batch.map((word) => ({ input: word.lemma })), "program");
    } catch (error) {
      // Budget, rate limit or provider trouble: feed what is ready, try again next visit.
      console.error("program enrichment skipped", error);
      break;
    }
    await Promise.all(
      batch.map(async (word, index) => {
        const result = results[index];
        if (!result) return;
        contents.set(word.lexiconId, result.content);
        // The model may have answered under another dictionary form: keep the
        // program entry filled too, so it is never paid for again.
        if (result.lexiconId !== word.lexiconId) {
          const { error } = await admin
            .from("lexicon")
            .update({
              content: result.content as unknown as Json,
              enriched_at: new Date().toISOString(),
              enrich_model: "copy",
            })
            .eq("id", word.lexiconId);
          if (error) console.error("program lexicon copy failed", error);
        }
      }),
    );
  }
  return contents;
}

async function insertProgramWords(db: Db, words: NewWord[]) {
  try {
    return (await insertWordsWithCards(db, words)).length;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    // A parallel visit added some of them: add the rest one by one.
    let added = 0;
    for (const word of words) {
      try {
        added += (await insertWordsWithCards(db, [word])).length;
      } catch (inner) {
        if (!isUniqueViolation(inner)) throw inner;
      }
    }
    return added;
  }
}

async function calibratePosition(db: Db, profile: Profile & { programRank: number; knownRank: number }) {
  const last = profile.calibratedAt ? Date.parse(profile.calibratedAt) : 0;
  if (Date.now() - last < CALIBRATION_INTERVAL_MS) return profile;
  const rows = must(await db.rpc("get_program_calibration", { p_since: profile.calibratedAt ?? "1970-01-01T00:00:00Z" }));
  const result = calibrate({
    reviews: rows.map((row) => ({ assumedKnown: row.assumed_known, rating: row.rating })),
    knownRank: profile.knownRank,
    programRank: profile.programRank,
  });
  if (!result.changed) return profile;
  await savePosition(db, profile.id, result);
  return { ...profile, knownRank: result.knownRank, programRank: result.programRank };
}

/**
 * Daily feed: calibrates the position, then tops the pool of unstarted words
 * up (program.ts) and, after the response, prepares tomorrow's words (AI
 * content only, nothing is added). Returns how many words were added.
 */
export async function runDailyFeed(db: Db, current: Profile, summary: PracticeSummary): Promise<number> {
  if (!isOnboarded(current)) return 0;
  const profile = await calibratePosition(db, current);
  const need = feedNeed(summary);
  const tomorrow = newWordsPerDay(profile.dailyMinutes, 0);

  const goals = cleanGoals(profile.goals);
  const test = readTestResult(profile.levelEstimate);
  const testSets = { known: new Set(test?.known ?? []), unknown: new Set(test?.unknown ?? []) };
  const candidates = await loadCandidates(db, feedLists(goals), profile.programRank, need + tomorrow + CANDIDATE_SLACK);

  const plan = (count: number, exclude: Set<string>) =>
    planFeed({
      need: count,
      goals,
      candidates: Object.fromEntries(
        Object.entries(candidates).map(([list, items]) => [list, items.filter((item) => !exclude.has(item.lemma))]),
      ),
      knownRank: profile.knownRank,
      test: testSets,
    }) as Array<PlannedWord & { candidate: ProgramCandidate }>;

  const today = plan(need, new Set());
  let added = 0;
  if (today.length > 0) {
    const contents = await enrichCandidates(profile.id, today.map((word) => word.candidate));
    const words: NewWord[] = today.flatMap(({ candidate, assumedKnown }) => {
      const content = contents.get(candidate.lexiconId);
      return content
        ? [{ lemma: candidate.lemma, content, source: "program" as const, lexiconId: candidate.lexiconId, assumedKnown }]
        : [];
    });
    added = await insertProgramWords(db, words);
  }

  const upcoming = plan(tomorrow, new Set(today.map((word) => word.candidate.lemma)))
    .map((word) => word.candidate)
    .filter((candidate) => !candidate.enriched);
  if (upcoming.length > 0) {
    after(async () => {
      await enrichCandidates(profile.id, upcoming);
    });
  }
  return added;
}
