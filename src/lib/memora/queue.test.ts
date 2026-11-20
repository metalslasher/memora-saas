import { describe, expect, it } from "vitest";
import { buildPracticeQueue, nextDueAt } from "./queue";
import { createStoredSchedule } from "./scheduler";
import type { CardKind, PracticeCard, StoredSchedule } from "./types";

const now = new Date("2026-11-19T12:00:00.000Z");
const dayStart = new Date("2026-11-18T22:00:00.000Z"); // Kyiv midnight
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

function card(
  id: string,
  word: string,
  kind: CardKind,
  schedule: Partial<StoredSchedule> = {},
  wordReviewedAt: string | null = null,
): PracticeCard {
  return {
    id,
    userWordId: word,
    kind,
    lemma: word,
    content: { translations: [word], examples: [] },
    schedule: { ...createStoredSchedule(new Date(now.getTime() - 60_000)), ...schedule },
    wordReviewedAt,
  };
}

function review(daysSince: number, stability: number): Partial<StoredSchedule> {
  return {
    state: "Review",
    reps: 3,
    stability,
    difficulty: 5,
    scheduled_days: Math.round(stability),
    last_review: daysAgo(daysSince),
    due: minutesAgo(1),
  };
}

const ids = (cards: PracticeCard[]) => cards.map((item) => item.id);

describe("practice queue", () => {
  it("orders reviews by retrievability, then unlocked exercises, then new words in server order", () => {
    const cards = [
      card("new-b", "w1", "recognition"),
      card("fresh", "w2", "recognition", review(1, 10)),
      card("unlocked", "w3", "recall", {}, daysAgo(3)),
      card("new-a", "w4", "recognition"),
      card("faded", "w5", "recognition", review(9, 2)),
    ];
    const newOrder = new Map([
      ["new-a", 0],
      ["new-b", 1],
    ]);
    expect(ids(buildPracticeQueue(cards, now, { dayStart, newOrder }))).toEqual([
      "faded",
      "fresh",
      "unlocked",
      "new-a",
      "new-b",
    ]);
  });

  it("holds at most one card per word, preferring the most forgotten review", () => {
    const cards = [
      card("rec", "w1", "recognition", review(2, 20)),
      card("recall", "w1", "recall", review(9, 3)),
      card("cloze", "w1", "cloze", {}, daysAgo(2)),
    ];
    expect(ids(buildPracticeQueue(cards, now, { dayStart }))).toEqual(["recall"]);
  });

  it("buries every sibling of a word rated today", () => {
    const ratedToday = card("rec", "w1", "recognition", {
      state: "Review",
      reps: 2,
      scheduled_days: 2,
      stability: 2,
      last_review: minutesAgo(30),
      due: new Date(now.getTime() + 2 * 86_400_000).toISOString(),
    });
    const sibling = card("recall", "w1", "recall", review(5, 3));
    expect(buildPracticeQueue([ratedToday, sibling], now, { dayStart })).toEqual([]);

    // The server reports reviews of cards the session does not hold.
    const buriedByServer = card("recall-2", "w2", "recall", review(5, 3), minutesAgo(90));
    expect(buildPracticeQueue([buriedByServer], now, { dayStart })).toEqual([]);

    // A review from yesterday does not bury anything.
    const yesterday = card("recall-3", "w3", "recall", review(5, 3), daysAgo(1));
    expect(ids(buildPracticeQueue([yesterday], now, { dayStart }))).toEqual(["recall-3"]);
  });

  it("lets the same card come back for its learning steps", () => {
    const step = card("rec", "w1", "recognition", {
      state: "Relearning",
      reps: 4,
      lapses: 1,
      stability: 1,
      last_review: minutesAgo(11),
      due: minutesAgo(1),
    });
    const sibling = card("recall", "w1", "recall", review(5, 3));
    expect(ids(buildPracticeQueue([step, sibling], now, { dayStart }))).toEqual(["rec"]);
  });

  it("skips cards that are not due yet and cards skipped in the session", () => {
    const later = card("later", "w1", "recognition", { due: new Date(now.getTime() + 600_000).toISOString() });
    const skipped = card("skipped", "w2", "listening", {}, daysAgo(4));
    expect(buildPracticeQueue([later, skipped], now, { dayStart, skipped: new Set(["skipped"]) })).toEqual([]);
  });

  it("finds the next due time among reviewed cards", () => {
    const soon = card("soon", "w1", "recall", {
      ...review(1, 3),
      due: new Date(now.getTime() + 30 * 60_000).toISOString(),
    });
    const unseen = card("new", "w2", "recognition", { due: new Date(now.getTime() + 60_000).toISOString() });
    expect(nextDueAt([soon, unseen], now, null)?.toISOString()).toBe(soon.schedule.due);
    expect(nextDueAt([], now, "2026-11-20T09:00:00.000Z")?.toISOString()).toBe("2026-11-20T09:00:00.000Z");
    expect(nextDueAt([], now, null)).toBeNull();
  });
});
