import { describe, expect, it } from "vitest";
import {
  addDays,
  addGoalTime,
  buildStreakSummary,
  computeStreak,
  pluralizeDays,
  streakMessage,
  weekStart,
} from "./streak";

// 2026-11-23 is a Monday.
describe("streak text", () => {
  it("pluralizes days in Ukrainian", () => {
    expect(pluralizeDays(1)).toBe("день поспіль");
    expect(pluralizeDays(3)).toBe("дні поспіль");
    expect(pluralizeDays(5)).toBe("днів поспіль");
    expect(pluralizeDays(12)).toBe("днів поспіль");
    expect(pluralizeDays(22)).toBe("дні поспіль");
  });

  it("chooses a message", () => {
    expect(streakMessage({ streak: 0, goalMet: false, freezeUsed: false })).toBe("Почни серію сьогодні");
    expect(streakMessage({ streak: 4, goalMet: false, freezeUsed: false })).toBe("Сьогодні ще чекає ціль дня");
    expect(streakMessage({ streak: 4, goalMet: false, freezeUsed: true })).toBe("Заморозку цього тижня витрачено");
    expect(streakMessage({ streak: 8, goalMet: true, freezeUsed: false })).toBe("Відмінна робота!");
  });
});

describe("calendar helpers", () => {
  it("finds Monday of the week", () => {
    expect(weekStart("2026-11-23")).toBe("2026-11-23");
    expect(weekStart("2026-11-29")).toBe("2026-11-23");
    expect(weekStart("2026-11-30")).toBe("2026-11-30");
  });

  it("adds days across month and year ends", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-03-01", -1)).toBe("2027-02-28");
  });
});

describe("computeStreak", () => {
  it("is zero without goal days", () => {
    expect(computeStreak([], "2026-11-25")).toEqual({ streak: 0, frozenDays: [], freezeUsed: false });
  });

  it("counts consecutive days, today included once met", () => {
    expect(computeStreak(["2026-11-23", "2026-11-24"], "2026-11-25").streak).toBe(2);
    expect(computeStreak(["2026-11-23", "2026-11-24", "2026-11-25"], "2026-11-25").streak).toBe(3);
  });

  it("does not break on an unfinished today", () => {
    expect(computeStreak(["2026-11-24"], "2026-11-25").streak).toBe(1);
  });

  it("spends one freeze per week on a missed day without counting it", () => {
    // Mon, Tue met, Wed missed (frozen), Thu met.
    const result = computeStreak(["2026-11-23", "2026-11-24", "2026-11-26"], "2026-11-26");
    expect(result).toEqual({ streak: 3, frozenDays: ["2026-11-25"], freezeUsed: true });
  });

  it("resets on a second miss in the same week", () => {
    // Mon met, Tue missed (frozen), Wed missed (reset), Thu met.
    const result = computeStreak(["2026-11-23", "2026-11-26"], "2026-11-26");
    expect(result.streak).toBe(1);
  });

  it("gives a fresh freeze every week", () => {
    // Fri missed (week 1), then Wed missed (week 2): both absorbed.
    const days = [
      "2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26",
      "2026-11-28", "2026-11-29", "2026-11-30", "2026-12-01", "2026-12-03",
    ];
    const result = computeStreak(days, "2026-12-03");
    expect(result.frozenDays).toEqual(["2026-11-27", "2026-12-02"]);
    expect(result.streak).toBe(days.length);
  });

  it("keeps a frozen yesterday while today is still open", () => {
    const result = computeStreak(["2026-11-23", "2026-11-24"], "2026-11-26");
    expect(result).toEqual({ streak: 2, frozenDays: ["2026-11-25"], freezeUsed: true });
  });

  it("resets when a second day is missed after the freeze was spent", () => {
    // Mon met, Tue missed (frozen), Wed met, Thu missed (reset), today Fri.
    expect(computeStreak(["2026-11-23", "2026-11-25"], "2026-11-27").streak).toBe(0);
  });

  it("does not spend freezes before the first goal day", () => {
    expect(computeStreak(["2026-11-25"], "2026-11-25")).toEqual({ streak: 1, frozenDays: [], freezeUsed: false });
  });

  it("uses plain local dates, so a timezone change cannot merge or split days", () => {
    // Stored days are strings; computing 'today' elsewhere only moves the open day.
    const days = ["2026-11-23", "2026-11-24"];
    expect(computeStreak(days, "2026-11-25").streak).toBe(2);
    expect(computeStreak(days, "2026-11-24").streak).toBe(2);
    expect(computeStreak(days, "2026-11-23").streak).toBe(1);
  });

  it("ignores days after today (clock moved back)", () => {
    expect(computeStreak(["2026-11-24", "2026-11-26"], "2026-11-25").streak).toBe(1);
  });
});

describe("buildStreakSummary and optimistic goal time", () => {
  const base = buildStreakSummary({
    goalDays: ["2026-11-23", "2026-11-24", "2026-11-26"],
    today: "2026-11-26",
    activeMs: 600_000,
    goalMinutes: 15,
  });

  it("keeps only this week's days and flags freezes", () => {
    expect(base).toMatchObject({
      streak: 3,
      goalMet: true,
      weekDays: ["2026-11-23", "2026-11-24", "2026-11-26"],
      frozenDays: ["2026-11-25"],
      freezeUsed: true,
    });
    const next = buildStreakSummary({ goalDays: ["2026-11-23"], today: "2026-11-30", activeMs: 0, goalMinutes: 10 });
    expect(next.weekDays).toEqual([]);
    expect(next.frozenDays).toEqual([]);
  });

  it("lights up today once the counted time reaches the goal", () => {
    const open = buildStreakSummary({
      goalDays: ["2026-11-24", "2026-11-25"],
      today: "2026-11-26",
      activeMs: 0,
      goalMinutes: 1,
    });
    const half = addGoalTime(open, 30_000);
    expect(half).toMatchObject({ goalMet: false, streak: 2, doneMs: 30_000 });
    const done = addGoalTime(half, 40_000);
    expect(done).toMatchObject({ goalMet: true, streak: 3, doneMs: 70_000 });
    expect(done.weekDays).toContain("2026-11-26");
    expect(addGoalTime(done, 10_000).streak).toBe(3);
  });

  it("never goes below zero on undo", () => {
    expect(addGoalTime({ ...base, goalMet: false, doneMs: 5_000 }, -20_000).doneMs).toBe(0);
  });
});
