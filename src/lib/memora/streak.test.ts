import { describe, expect, it } from "vitest";
import { markReviewedToday, pluralizeDays, streakMessage } from "./streak";

describe("streak", () => {
  it("pluralizes days in Ukrainian", () => {
    expect(pluralizeDays(1)).toBe("день поспіль");
    expect(pluralizeDays(3)).toBe("дні поспіль");
    expect(pluralizeDays(5)).toBe("днів поспіль");
    expect(pluralizeDays(12)).toBe("днів поспіль");
    expect(pluralizeDays(22)).toBe("дні поспіль");
  });

  it("chooses a message", () => {
    expect(streakMessage({ streak: 0, reviewedToday: false })).toBe("Почни серію сьогодні");
    expect(streakMessage({ streak: 4, reviewedToday: false })).toBe("Сьогодні ще чекає практика");
    expect(streakMessage({ streak: 8, reviewedToday: true })).toBe("Відмінна робота!");
  });

  it("marks today optimistically once", () => {
    const summary = { streak: 2, reviewedToday: false, today: "2026-11-19", weekDays: ["2026-11-18"] };
    const marked = markReviewedToday(summary);
    expect(marked).toEqual({
      streak: 3,
      reviewedToday: true,
      today: "2026-11-19",
      weekDays: ["2026-11-18", "2026-11-19"],
    });
    expect(markReviewedToday(marked)).toBe(marked);
  });
});
