import { newWordAllowance } from "./pace";
import type { PracticeSummary, ReviewRating } from "./types";

/**
 * The program: which words the daily feed adds and how its position moves.
 *
 * Position (per learner, from the vocabulary test):
 * - knownRank — words with a general frequency rank up to it are taken as
 *   passively known (vocabulary size ≈ frequency level, as in the Vocabulary
 *   Size Test of Nation & Beglar 2007). They start with an active exercise
 *   (recall) instead of recognition.
 * - programRank — where the core list (NGSL) starts. Active vocabulary is
 *   much smaller than passive (Laufer & Paribakht 1998), so the feed starts
 *   at half the passive size, capped so NGSL still has words to give.
 *   The 0.5 ratio is an experiment.
 *
 * Feed (each visit of the practice page tops the pool up):
 * - pool of unstarted words = today's remaining pace (pace.ts) + 5 spare for
 *   "Ще 5 нових"; own words and words from text count first, the program only
 *   fills the rest (they also come first in the queue — SQL orders them);
 * - a third of the program words come from the goals' lists (themes, BSL,
 *   NGSL-Spoken, round-robin), the rest from NGSL by rank; when one side runs
 *   out, the other fills in;
 * - words already in the library are never offered (SQL);
 * - assumed known: confirmed by the test, or (not failed in the test and)
 *   frequency rank ≤ knownRank. Themed phrases always start as new.
 */

export const GOALS = ["general", "work", "travel", "talk"] as const;
export type Goal = (typeof GOALS)[number];

export const goalLabels: Record<Goal, string> = {
  general: "Загальна англійська",
  work: "Робота / IT",
  travel: "Подорожі",
  talk: "Розмовна",
};

export const PROGRAM_LISTS = ["ngsl", "ngsl_spoken", "bsl", "theme_work", "theme_travel", "theme_talk"] as const;
export type ProgramList = (typeof PROGRAM_LISTS)[number];

export const goalLists: Record<Goal, ProgramList[]> = {
  general: [],
  work: ["theme_work", "bsl"],
  travel: ["theme_travel"],
  talk: ["theme_talk", "ngsl_spoken"],
};

export const CORE_LIST: ProgramList = "ngsl";
/** NGSL ranks below this are grammar words (the, be, of …) — not fed. */
export const CORE_FLOOR = 100;
/** Highest NGSL start: the list has 2,809 words, keep ~500 to feed. */
export const MAX_PROGRAM_RANK = 2300;
export const ACTIVE_SHARE = 0.5;
export const THEME_SHARE = 1 / 3;
export const SPARE_NEW_WORDS = 5;

export function isGoal(value: unknown): value is Goal {
  return GOALS.includes(value as Goal);
}

export function cleanGoals(values: unknown): Goal[] {
  if (!Array.isArray(values)) return [];
  return GOALS.filter((goal) => values.includes(goal));
}

/** Minimum rank per list: the core starts at the learner's position. */
export function listFloor(list: ProgramList, programRank: number) {
  if (list === CORE_LIST) return Math.max(CORE_FLOOR, programRank);
  if (list === "ngsl_spoken") return CORE_FLOOR;
  return 1;
}

export function startingPosition(vocab: number) {
  const knownRank = Math.max(0, Math.round(vocab));
  const programRank = Math.min(MAX_PROGRAM_RANK, Math.max(CORE_FLOOR, Math.round(knownRank * ACTIVE_SHARE)));
  return { knownRank, programRank };
}

/** How many program words to add now. */
export function feedNeed(summary: PracticeSummary) {
  return Math.max(0, newWordAllowance(summary) + SPARE_NEW_WORDS - summary.newReady);
}

export type Candidate = {
  lexiconId: string;
  lemma: string;
  list: ProgramList;
  listRank: number;
  frequencyRank: number | null;
};

export type PlannedWord = { candidate: Candidate; assumedKnown: boolean };

export function isAssumedKnown(
  candidate: Candidate,
  knownRank: number,
  test: { known: ReadonlySet<string>; unknown: ReadonlySet<string> },
) {
  if (candidate.list.startsWith("theme_")) return false;
  if (test.known.has(candidate.lemma)) return true;
  if (test.unknown.has(candidate.lemma)) return false;
  return candidate.frequencyRank !== null && candidate.frequencyRank <= knownRank;
}

/** Lists the feed reads for these goals: the core plus each goal's lists. */
export function feedLists(goals: Goal[]): ProgramList[] {
  return [CORE_LIST, ...new Set(goals.flatMap((goal) => goalLists[goal]))];
}

export function planFeed(input: {
  need: number;
  goals: Goal[];
  /** Candidates per list, already in rank order and above the list floor. */
  candidates: Partial<Record<ProgramList, Candidate[]>>;
  knownRank: number;
  test: { known: ReadonlySet<string>; unknown: ReadonlySet<string> };
}): PlannedWord[] {
  const { need, goals, candidates, knownRank, test } = input;
  if (need <= 0) return [];

  const themed = feedLists(goals).filter((list) => list !== CORE_LIST);
  const cursors = new Map<ProgramList, number>();
  const taken = new Set<string>();
  const picked: Candidate[] = [];

  const takeFrom = (list: ProgramList) => {
    const items = candidates[list] ?? [];
    let cursor = cursors.get(list) ?? 0;
    while (cursor < items.length && taken.has(items[cursor].lemma)) cursor += 1;
    cursors.set(list, cursor + 1);
    const item = items[cursor];
    if (!item) return false;
    taken.add(item.lemma);
    picked.push(item);
    return true;
  };
  const roundRobin = (count: number) => {
    let added = 0;
    let idle = 0;
    let index = 0;
    while (added < count && themed.length > 0 && idle < themed.length) {
      if (takeFrom(themed[index % themed.length])) {
        added += 1;
        idle = 0;
      } else {
        idle += 1;
      }
      index += 1;
    }
    return added;
  };

  const themedSlots = themed.length === 0 ? 0 : Math.max(1, Math.round(need * THEME_SHARE));
  roundRobin(Math.min(themedSlots, need));
  while (picked.length < need && takeFrom(CORE_LIST)) {
    // core fills the rest
  }
  if (picked.length < need) roundRobin(need - picked.length);

  return picked.map((candidate) => ({ candidate, assumedKnown: isAssumedKnown(candidate, knownRank, test) }));
}

/* ---------------- calibration by practice ---------------- */

/**
 * Experiment (heuristic thresholds, to be checked on real logs): the first
 * review of each program word tells whether the position fits.
 * - Words taken as known (start with recall) that are failed (Again) on the
 *   first try: more than 35 % of at least 8 → the test overestimated, both
 *   ranks move down by 200. Yes/no tests are known to overestimate when
 *   learners say "yes" too easily (Eyckmans 2004; Mochida & Harrington 2006).
 * - New words recognised on their first look ("Згадав"): at least 80 % of at
 *   least 8 → the feed is too easy, both ranks move up by 200.
 * Uses only reviews after the last change, at most once a day.
 */
export const CALIBRATION_WINDOW = 20;
export const CALIBRATION_MIN_SAMPLES = 8;
export const CALIBRATION_MISS_RATE = 0.35;
export const CALIBRATION_EASY_RATE = 0.8;
export const CALIBRATION_STEP = 200;

export type FirstReview = { assumedKnown: boolean; rating: ReviewRating };

export function calibrate(input: { reviews: FirstReview[]; knownRank: number; programRank: number }) {
  const known = input.reviews.filter((review) => review.assumedKnown).slice(0, CALIBRATION_WINDOW);
  const fresh = input.reviews.filter((review) => !review.assumedKnown).slice(0, CALIBRATION_WINDOW);

  let delta = 0;
  if (
    known.length >= CALIBRATION_MIN_SAMPLES &&
    known.filter((review) => review.rating === "again").length / known.length > CALIBRATION_MISS_RATE
  ) {
    delta = -CALIBRATION_STEP;
  } else if (
    fresh.length >= CALIBRATION_MIN_SAMPLES &&
    fresh.filter((review) => review.rating === "good" || review.rating === "easy").length / fresh.length >=
      CALIBRATION_EASY_RATE
  ) {
    delta = CALIBRATION_STEP;
  }

  if (delta === 0) return { changed: false as const, knownRank: input.knownRank, programRank: input.programRank };
  return {
    changed: true as const,
    delta,
    knownRank: Math.max(0, input.knownRank + delta),
    programRank: Math.min(MAX_PROGRAM_RANK, Math.max(CORE_FLOOR, input.programRank + delta)),
  };
}
