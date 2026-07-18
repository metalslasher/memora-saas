import { describe, expect, it } from "vitest";
import { buildStreakStats, pluralizeDays } from "./streak";

function logAt(reviewedAt: string) {
  return { reviewedAt };
}

describe("buildStreakStats", () => {
  it("counts a streak that includes today", () => {
    const stats = buildStreakStats(
      [
        logAt("2026-07-12T08:00:00.000Z"),
        logAt("2026-07-13T08:00:00.000Z"),
        logAt("2026-07-14T08:00:00.000Z"),
        logAt("2026-07-15T08:00:00.000Z"),
        logAt("2026-07-16T08:00:00.000Z"),
        logAt("2026-07-17T08:00:00.000Z"),
        logAt("2026-07-18T08:00:00.000Z"),
      ],
      new Date("2026-07-18T12:00:00.000Z"),
    );

    expect(stats.count).toBe(7);
    expect(stats.reviewedToday).toBe(true);
    expect(stats.message).toBe("Відмінна робота!");
  });

  it("keeps yesterday streak during the current day until today's practice happens", () => {
    const stats = buildStreakStats(
      [
        logAt("2026-07-15T08:00:00.000Z"),
        logAt("2026-07-16T08:00:00.000Z"),
        logAt("2026-07-17T08:00:00.000Z"),
      ],
      new Date("2026-07-18T12:00:00.000Z"),
    );

    expect(stats.count).toBe(3);
    expect(stats.reviewedToday).toBe(false);
    expect(stats.message).toBe("Сьогодні ще чекає практика");
  });

  it("marks completed days in the current Monday-Sunday week", () => {
    const stats = buildStreakStats(
      [
        logAt("2026-07-13T08:00:00.000Z"),
        logAt("2026-07-15T08:00:00.000Z"),
        logAt("2026-07-18T08:00:00.000Z"),
      ],
      new Date("2026-07-18T12:00:00.000Z"),
    );

    expect(stats.week.map((day) => day.label)).toEqual([
      "Пн",
      "Вт",
      "Ср",
      "Чт",
      "Пт",
      "Сб",
      "Нд",
    ]);
    expect(stats.week.map((day) => day.isCompleted)).toEqual([
      true,
      false,
      true,
      false,
      false,
      true,
      false,
    ]);
    expect(stats.week.find((day) => day.isToday)?.label).toBe("Сб");
  });
});

describe("pluralizeDays", () => {
  it("uses Ukrainian day forms", () => {
    expect(pluralizeDays(1)).toBe("день поспіль");
    expect(pluralizeDays(2)).toBe("дні поспіль");
    expect(pluralizeDays(5)).toBe("днів поспіль");
    expect(pluralizeDays(11)).toBe("днів поспіль");
    expect(pluralizeDays(21)).toBe("день поспіль");
  });
});
