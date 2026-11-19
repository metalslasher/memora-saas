import { getRetrievability } from "./scheduler";
import type { PracticeCard, PracticeSummary } from "./types";

/**
 * Orders the cards a session holds: due reviews first (most forgotten
 * first), then new cards in the order the server picked them. The server
 * already applied today's new-card limit, so every held new card is allowed.
 */
export function buildPracticeQueue(
  cards: PracticeCard[],
  now: Date,
  newOrder: ReadonlyMap<string, number> = new Map(),
) {
  const nowMs = now.getTime();
  const due = cards.filter((card) => Date.parse(card.schedule.due) <= nowMs);
  const reviews = due
    .filter((card) => card.schedule.reps > 0)
    .map((card) => ({ card, r: getRetrievability(card.schedule, now) }))
    .sort((a, b) => a.r - b.r || Date.parse(a.card.schedule.due) - Date.parse(b.card.schedule.due))
    .map((item) => item.card);
  const fresh = due
    .filter((card) => card.schedule.reps === 0)
    .sort(
      (a, b) =>
        (newOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (newOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    );

  return [...reviews, ...fresh];
}

/** New cards that are ready but held back by today's limit. */
export function heldBackNew(summary: PracticeSummary, extraNew: number) {
  const allowance = Math.max(0, summary.dailyNewLimit - summary.newToday) + extraNew;
  return Math.max(0, summary.newReady - allowance);
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

export function estimateMinutes(cardCount: number) {
  return Math.max(1, Math.ceil(cardCount * 0.75));
}
