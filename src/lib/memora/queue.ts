import { getRetrievability } from "./scheduler";
import type { PracticeCard } from "./types";

/**
 * Sibling burying — one word, at most one card a day.
 *
 * - The queue holds at most one card per word, so a recall card cannot
 *   follow (and be answered by) the recognition card of the same word.
 * - A word any card of which was already rated today (learner's local day)
 *   does not come back with another card. The only exception is the
 *   learning steps of that same card (10 min / 30 min after a lapse or a
 *   first look), which must come back the same day to work.
 *
 * Ordering: due reviews first, most forgotten first (lowest FSRS-6
 * retrievability), then newly unlocked exercises of known words, then new
 * words in the order the server picked them.
 *
 * The same rule is mirrored in SQL (`get_practice_overview`,
 * `get_practice_cards`) to count due words for the badge and to avoid
 * loading buried cards; this module is the reference implementation.
 */
export type QueueOptions = {
  /** Start of the learner's local day. */
  dayStart: Date;
  /** Server order of new words (card id → position). */
  newOrder?: ReadonlyMap<string, number>;
  /** Cards skipped in this session (e.g. listening without sound). */
  skipped?: ReadonlySet<string>;
};

export function isNewWordCard(card: PracticeCard) {
  return card.kind === "recognition" && card.schedule.reps === 0;
}

function isLearningStep(card: PracticeCard) {
  return card.schedule.state === "Learning" || card.schedule.state === "Relearning";
}

function time(value: string | null) {
  return value ? Date.parse(value) : Number.NEGATIVE_INFINITY;
}

/** Latest review per word among the held cards and the server's word data. */
export function wordReviewTimes(cards: PracticeCard[]) {
  const latest = new Map<string, number>();
  for (const card of cards) {
    const reviewed = Math.max(time(card.wordReviewedAt), time(card.schedule.last_review));
    latest.set(card.userWordId, Math.max(latest.get(card.userWordId) ?? Number.NEGATIVE_INFINITY, reviewed));
  }
  return latest;
}

/** Whether the card may be shown today under the burying rule (ignores due time). */
export function isAllowedToday(card: PracticeCard, wordReviewedAt: number, dayStart: Date) {
  const dayStartMs = dayStart.getTime();
  if (wordReviewedAt < dayStartMs) return true;
  return time(card.schedule.last_review) >= dayStartMs && isLearningStep(card);
}

export function buildPracticeQueue(cards: PracticeCard[], now: Date, options: QueueOptions) {
  const nowMs = now.getTime();
  const reviewTimes = wordReviewTimes(cards);
  const newOrder = options.newOrder ?? new Map<string, number>();

  const candidates = cards.filter(
    (card) =>
      !options.skipped?.has(card.id) &&
      Date.parse(card.schedule.due) <= nowMs &&
      isAllowedToday(card, reviewTimes.get(card.userWordId) ?? Number.NEGATIVE_INFINITY, options.dayStart),
  );

  // Priority inside a word: a review (lowest retrievability) beats a newly
  // unlocked exercise, which beats the word's first look.
  const rank = (card: PracticeCard) => (card.schedule.reps > 0 ? 0 : isNewWordCard(card) ? 2 : 1);
  const retrievability = new Map(candidates.map((card) => [card.id, getRetrievability(card.schedule, now)]));
  const compare = (a: PracticeCard, b: PracticeCard) =>
    rank(a) - rank(b) ||
    (rank(a) === 2
      ? (newOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (newOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER)
      : (retrievability.get(a.id) ?? 1) - (retrievability.get(b.id) ?? 1) ||
        Date.parse(a.schedule.due) - Date.parse(b.schedule.due));

  const perWord = new Map<string, PracticeCard>();
  for (const card of candidates) {
    const current = perWord.get(card.userWordId);
    if (!current || compare(card, current) < 0) perWord.set(card.userWordId, card);
  }

  return [...perWord.values()].sort(compare);
}

/** Earliest future due date among held cards and the server's next due date. */
export function nextDueAt(cards: PracticeCard[], now: Date, serverNext: string | null) {
  const nowMs = now.getTime();
  const server = serverNext ? Date.parse(serverNext) : Number.NaN;
  let next = server > nowMs ? server : Number.POSITIVE_INFINITY;
  for (const card of cards) {
    if (card.schedule.reps === 0) continue;
    const due = Date.parse(card.schedule.due);
    if (due > nowMs && due < next) next = due;
  }
  return Number.isFinite(next) ? new Date(next) : null;
}
