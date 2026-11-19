import { describe, expect, it } from "vitest";
import { estimateMinutes, heldBackNew, newWordAllowance, newWordsPerDay, sessionOptions } from "./pace";
import type { PracticeSummary } from "./types";

const summary: PracticeSummary = {
  dueWords: 0,
  reviewsToday: 0,
  newReady: 30,
  newToday: 0,
  dailyMinutes: 15,
  nextDueAt: null,
  activeCards: 40,
  dayStart: "2026-11-18T22:00:00.000Z",
};

describe("pace", () => {
  it("derives a sustainable number of new words from minutes per day", () => {
    expect([5, 10, 15, 20, 30].map((minutes) => newWordsPerDay(minutes, 0))).toEqual([2, 4, 6, 8, 12]);
  });

  it("cuts new words when reviews fill the day", () => {
    expect(newWordsPerDay(15, 40)).toBe(6); // (900 − 480) / 45 = 9.3 > steady 6.4
    expect(newWordsPerDay(15, 65)).toBe(2); // (900 − 780) / 45 = 2.7
    expect(newWordsPerDay(15, 80)).toBe(0); // reviews alone take the whole time
    expect(newWordsPerDay(0, 0)).toBe(0);
  });

  it("counts words introduced today and the extra the learner asked for", () => {
    expect(newWordAllowance(summary)).toBe(6);
    expect(newWordAllowance({ ...summary, newToday: 4 })).toBe(2);
    expect(newWordAllowance({ ...summary, newToday: 9 })).toBe(0);
    expect(newWordAllowance({ ...summary, newToday: 9 }, 5)).toBe(5);
    // Done and still-due reviews both count as today's load.
    expect(newWordAllowance({ ...summary, reviewsToday: 40, dueWords: 25 })).toBe(2);
  });

  it("reports ready words held back by the pace", () => {
    expect(heldBackNew(summary)).toBe(24);
    expect(heldBackNew({ ...summary, newReady: 3 })).toBe(0);
    expect(heldBackNew(summary, 5)).toBe(19);
  });

  it("offers 5/10/20-minute sessions plus the daily minutes", () => {
    expect(sessionOptions(15)).toEqual([5, 10, 15, 20]);
    expect(sessionOptions(10)).toEqual([5, 10, 20]);
    expect(sessionOptions(30)).toEqual([5, 10, 20, 30]);
  });

  it("estimates minutes for a queue", () => {
    expect(estimateMinutes(0)).toBe(1);
    expect(estimateMinutes(10)).toBe(2);
    expect(estimateMinutes(50)).toBe(10);
  });
});
