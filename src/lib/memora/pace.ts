import type { PracticeSummary } from "./types";

/**
 * Pace instead of limits: the learner picks minutes per day, Memora derives
 * how many NEW WORDS to introduce today.
 *
 * Time costs (heuristics, to be calibrated on real review logs):
 * - one review ≈ 12 s (silent recognition is faster, typed recall slower);
 * - one new word on its first day ≈ 45 s (first look + two learning steps);
 * - in the steady state every word introduced per day keeps ≈ 8 reviews a
 *   day busy (several exercises per word over the following weeks).
 *
 *   steady = budget / (NEW_WORD_SECONDS + REVIEWS_PER_NEW_WORD × REVIEW_SECONDS)
 *   free   = (budget − todayReviews × REVIEW_SECONDS) / NEW_WORD_SECONDS
 *   newWords = clamp(floor(min(steady, free)), 0, MAX_NEW_WORDS)
 *
 * `steady` keeps tomorrow's review load sustainable (15 min → 6 words);
 * `free` cuts new words on days with a review backlog (todayReviews = done
 * today + still due), down to zero when reviews alone fill the time.
 * "Ще 5 нових" after a session lets the learner go beyond it on purpose.
 */
export const DAILY_MINUTES_OPTIONS = [5, 10, 15, 20, 30] as const;
export const SESSION_MINUTES_OPTIONS = [5, 10, 20] as const;
export const DEFAULT_DAILY_MINUTES = 15;

export const REVIEW_SECONDS = 12;
export const NEW_WORD_SECONDS = 45;
export const REVIEWS_PER_NEW_WORD = 8;
export const MAX_NEW_WORDS = 20;

export function isDailyMinutes(value: unknown): value is (typeof DAILY_MINUTES_OPTIONS)[number] {
  return DAILY_MINUTES_OPTIONS.includes(value as (typeof DAILY_MINUTES_OPTIONS)[number]);
}

/** New words for a whole day, given today's review load (done + due). */
export function newWordsPerDay(dailyMinutes: number, todayReviews: number) {
  const budget = Math.max(0, dailyMinutes) * 60;
  const steady = budget / (NEW_WORD_SECONDS + REVIEWS_PER_NEW_WORD * REVIEW_SECONDS);
  const free = (budget - Math.max(0, todayReviews) * REVIEW_SECONDS) / NEW_WORD_SECONDS;
  return Math.max(0, Math.min(MAX_NEW_WORDS, Math.floor(Math.min(steady, free))));
}

/** New words still allowed right now (+ `extra` the learner asked for). */
export function newWordAllowance(summary: PracticeSummary, extra = 0) {
  const perDay = newWordsPerDay(summary.dailyMinutes, summary.reviewsToday + summary.dueWords);
  return Math.max(0, perDay - summary.newToday) + Math.max(0, extra);
}

/** Ready new words held back by today's pace. */
export function heldBackNew(summary: PracticeSummary, extra = 0) {
  return Math.max(0, summary.newReady - newWordAllowance(summary, extra));
}

/** Session length choices: 5 / 10 / 20 plus the learner's daily minutes. */
export function sessionOptions(dailyMinutes: number) {
  const options = new Set<number>(SESSION_MINUTES_OPTIONS);
  if (dailyMinutes > 0) options.add(dailyMinutes);
  return [...options].sort((a, b) => a - b);
}

/** Rough minutes for a number of cards (for the header estimate). */
export function estimateMinutes(cardCount: number) {
  return Math.max(1, Math.ceil((cardCount * REVIEW_SECONDS) / 60));
}

/** Per-card time counted towards the session: idle time is not counted. */
export const MAX_COUNTED_CARD_MS = 90_000;
