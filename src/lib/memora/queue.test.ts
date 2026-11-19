import { describe, expect, it } from "vitest";
import { buildPracticeQueue, estimateMinutes, heldBackNew, nextDueAt } from "./queue";
import { createStoredSchedule, scheduleReview } from "./scheduler";
import type { PracticeCard, PracticeSummary } from "./types";

const now = new Date("2026-11-19T12:00:00.000Z");

function card(id: string, schedule = createStoredSchedule(new Date(now.getTime() - 60_000))): PracticeCard {
  return {
    id,
    userWordId: `w-${id}`,
    kind: "recall",
    lemma: id,
    content: { translations: [id], examples: [] },
    schedule,
  };
}

function reviewed(id: string, daysAgo: number, stability: number) {
  const reviewedAt = new Date(now.getTime() - daysAgo * 86_400_000);
  const base = scheduleReview(createStoredSchedule(reviewedAt), "good", reviewedAt).schedule;
  return card(id, { ...base, state: "Review", stability, due: new Date(now.getTime() - 1000).toISOString() });
}

const summary: PracticeSummary = {
  dueReviews: 0,
  newReady: 12,
  newToday: 3,
  dailyNewLimit: 8,
  nextDueAt: null,
  activeCards: 20,
};

describe("practice queue", () => {
  it("puts due reviews first, most forgotten first, then new cards in server order", () => {
    const cards = [card("new-b"), reviewed("fresh", 1, 10), card("new-a"), reviewed("faded", 9, 2)];
    const order = new Map([
      ["new-a", 0],
      ["new-b", 1],
    ]);
    expect(buildPracticeQueue(cards, now, order).map((item) => item.id)).toEqual(["faded", "fresh", "new-a", "new-b"]);
  });

  it("leaves out cards that are not due yet", () => {
    const later = card("later", { ...createStoredSchedule(now), due: new Date(now.getTime() + 600_000).toISOString() });
    expect(buildPracticeQueue([later], now)).toEqual([]);
  });

  it("counts new cards held back by the daily limit", () => {
    expect(heldBackNew(summary, 0)).toBe(7);
    expect(heldBackNew(summary, 5)).toBe(2);
    expect(heldBackNew({ ...summary, newToday: 20 }, 0)).toBe(12);
  });

  it("finds the next due date among held cards and the server", () => {
    const soon = card("soon", {
      ...createStoredSchedule(now),
      reps: 1,
      state: "Learning",
      due: new Date(now.getTime() + 600_000).toISOString(),
    });
    expect(nextDueAt([soon], now, new Date(now.getTime() + 3_600_000).toISOString())?.toISOString()).toBe(
      soon.schedule.due,
    );
    expect(nextDueAt([], now, "2026-11-19T11:00:00.000Z")).toBeNull();
    expect(nextDueAt([], now, null)).toBeNull();
  });

  it("estimates session length", () => {
    expect(estimateMinutes(0)).toBe(1);
    expect(estimateMinutes(10)).toBe(8);
  });
});
