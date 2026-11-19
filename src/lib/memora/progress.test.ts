import { describe, expect, it } from "vitest";
import { buildHeatmap, buildWeek, parseProgressStats, recallRate } from "./progress";

describe("progress", () => {
  it("parses get_progress_stats output", () => {
    const stats = parseProgressStats({
      today: "2026-11-19",
      streak: { streak: 3, reviewed_today: true, today: "2026-11-19", week_days: ["2026-11-17", "2026-11-19"] },
      activity: [{ day: "2026-11-19", reviews: 12, correct: 9 }, { day: "bad" }],
      recall_30d: { reviews: 20, correct: 15 },
      reviews_7d: 12,
      forecast: [{ day: "2026-11-19", cards: 4 }],
      stages: { new: 5, learning: 2, young: 3, mature: 1 },
      words: { total: 6, active: 5 },
    });
    expect(stats.streak).toEqual({
      streak: 3,
      reviewedToday: true,
      today: "2026-11-19",
      weekDays: ["2026-11-17", "2026-11-19"],
    });
    expect(stats.activity).toEqual([{ day: "2026-11-19", reviews: 12, correct: 9 }]);
    expect(stats.forecast).toEqual([{ day: "2026-11-19", cards: 4 }]);
    expect(recallRate(stats)).toBe(0.75);
  });

  it("tolerates an empty payload", () => {
    const stats = parseProgressStats(null);
    expect(stats.stages).toEqual({ new: 0, learning: 0, young: 0, mature: 0 });
    expect(recallRate(stats)).toBeNull();
  });

  it("builds a Monday-first heatmap ending with this week", () => {
    // 2026-11-19 is a Thursday.
    const heatmap = buildHeatmap(
      [
        { day: "2026-11-19", reviews: 5, correct: 5 },
        { day: "2026-11-16", reviews: 2, correct: 1 },
        { day: "2026-01-01", reviews: 9, correct: 9 },
      ],
      "2026-11-19",
      2,
    );
    expect(heatmap.columns).toHaveLength(2);
    expect(heatmap.columns[0][0].day).toBe("2026-11-09");
    expect(heatmap.columns[1][0]).toEqual({ day: "2026-11-16", reviews: 2, isFuture: false });
    expect(heatmap.columns[1][6]).toEqual({ day: "2026-11-22", reviews: 0, isFuture: true });
    expect(heatmap.total).toBe(7);
    expect(heatmap.activeDays).toBe(2);
  });

  it("labels the current week", () => {
    const week = buildWeek({ streak: 1, reviewedToday: true, today: "2026-11-19", weekDays: ["2026-11-19"] });
    expect(week.map((day) => day.label)).toEqual(["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"]);
    expect(week[3]).toEqual({ day: "2026-11-19", label: "Чт", isCompleted: true, isToday: true });
  });
});
