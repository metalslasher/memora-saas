import { describe, expect, it } from "vitest";
import { evaluateGoal, goalPercent, goalProgressLabel, localDay, localHour } from "./goal";

describe("evaluateGoal", () => {
  const base = { activeMs: 0, goalMinutes: 10, reviews: 5, queueEmpty: false };

  it("is met by the minutes", () => {
    expect(evaluateGoal({ ...base, activeMs: 10 * 60_000 })).toEqual({ met: true, reason: "minutes" });
    expect(evaluateGoal({ ...base, activeMs: 10 * 60_000 - 1 })).toEqual({ met: false, reason: null });
  });

  it("is met by an empty queue", () => {
    expect(evaluateGoal({ ...base, queueEmpty: true })).toEqual({ met: true, reason: "queue" });
  });

  it("prefers the minutes reason when both hold", () => {
    expect(evaluateGoal({ ...base, activeMs: 11 * 60_000, queueEmpty: true }).reason).toBe("minutes");
  });

  it("never counts a day without a review", () => {
    expect(evaluateGoal({ ...base, reviews: 0, queueEmpty: true })).toEqual({ met: false, reason: null });
    expect(evaluateGoal({ ...base, reviews: 0, activeMs: 99 * 60_000 }).met).toBe(false);
  });
});

describe("goal labels", () => {
  it("shows whole minutes capped at the goal", () => {
    expect(goalProgressLabel(7 * 60_000 + 30_000, 15)).toBe("7 з 15 хв");
    expect(goalProgressLabel(40 * 60_000, 15)).toBe("15 з 15 хв");
    expect(goalPercent(7.5 * 60_000, 15)).toBe(50);
    expect(goalPercent(99 * 60_000, 15)).toBe(100);
  });
});

describe("local day and hour", () => {
  it("moves the day boundary with the timezone", () => {
    const instant = new Date("2026-11-25T22:30:00Z");
    expect(localDay(instant, "UTC")).toBe("2026-11-25");
    expect(localDay(instant, "Europe/Kyiv")).toBe("2026-11-26"); // UTC+2 in winter
    expect(localDay(instant, "America/Los_Angeles")).toBe("2026-11-25");
    expect(localHour(instant, "Europe/Kyiv")).toBe(0);
  });

  it("is on either side of midnight exactly", () => {
    expect(localDay(new Date("2026-11-25T21:59:59Z"), "Europe/Kyiv")).toBe("2026-11-25");
    expect(localDay(new Date("2026-11-25T22:00:00Z"), "Europe/Kyiv")).toBe("2026-11-26");
    expect(localHour(new Date("2026-11-25T22:00:00Z"), "Europe/Kyiv")).toBe(0);
  });

  it("follows daylight saving time", () => {
    // Kyiv: UTC+3 in summer, UTC+2 in winter.
    expect(localHour(new Date("2026-07-01T12:00:00Z"), "Europe/Kyiv")).toBe(15);
    expect(localHour(new Date("2026-12-01T12:00:00Z"), "Europe/Kyiv")).toBe(14);
  });

  it("handles half-hour zones", () => {
    expect(localHour(new Date("2026-11-25T13:30:00Z"), "Asia/Kolkata")).toBe(19);
  });
});
