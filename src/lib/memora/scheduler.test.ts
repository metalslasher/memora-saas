import { describe, expect, it } from "vitest";
import {
  createStoredSchedule,
  formatInterval,
  getRetrievability,
  previewNextDue,
  readStoredSchedule,
  scheduleReview,
} from "./scheduler";
import type { StoredSchedule } from "./types";

describe("scheduler (ts-fsrs 6, FSRS-6 model)", () => {
  it("advances a new card through the learning steps", () => {
    const reviewedAt = new Date("2026-07-12T12:00:00.000Z");
    const outcome = scheduleReview("card-1", createStoredSchedule(reviewedAt), "good", reviewedAt);

    expect(outcome.schedule.reps).toBe(1);
    expect(outcome.schedule.state).toBe("Learning");
    // Good on a new card → second learning step (30 min).
    expect(outcome.schedule.due).toBe("2026-07-12T12:30:00.000Z");
    expect(outcome.schedule.last_review).toBe(reviewedAt.toISOString());
  });

  it("previews increasing intervals and matches the real review", () => {
    const now = new Date("2026-07-12T12:00:00.000Z");
    const preview = previewNextDue("card-1", createStoredSchedule(now), now);

    expect(preview.again.getTime()).toBeLessThanOrEqual(preview.hard.getTime());
    expect(preview.hard.getTime()).toBeLessThanOrEqual(preview.good.getTime());
    expect(preview.good.getTime()).toBeLessThan(preview.easy.getTime());
    expect(preview.good.toISOString()).toBe(scheduleReview("card-1", createStoredSchedule(now), "good", now).schedule.due);
  });

  it("reads schedules saved by ts-fsrs 5 (with elapsed_days) and keeps scheduling them", () => {
    const stored = readStoredSchedule({
      due: "2026-11-18T12:00:00.000Z",
      stability: 5,
      difficulty: 5,
      elapsed_days: 8,
      scheduled_days: 8,
      learning_steps: 0,
      reps: 3,
      lapses: 0,
      state: "Review",
      last_review: "2026-11-10T12:00:00.000Z",
    });
    expect(stored).not.toBeNull();
    expect(stored).not.toHaveProperty("elapsed_days");

    const now = new Date("2026-11-19T12:00:00.000Z");
    const next = scheduleReview("card-1", stored!, "good", now).schedule;
    expect(next.state).toBe("Review");
    expect(next.reps).toBe(4);
    expect(next.stability).toBeGreaterThan(5);
    expect(next.scheduled_days).toBeGreaterThan(8);
  });

  it("fuzzes long intervals deterministically per card", () => {
    const now = new Date("2026-11-19T12:00:00.000Z");
    const mature: StoredSchedule = {
      due: now.toISOString(),
      stability: 40,
      difficulty: 5,
      scheduled_days: 40,
      learning_steps: 0,
      reps: 6,
      lapses: 0,
      state: "Review",
      last_review: "2026-10-10T12:00:00.000Z",
    };
    const days = (id: string) => scheduleReview(id, mature, "good", now).schedule.scheduled_days;

    expect(days("a")).toBe(days("a"));
    const spread = new Set(["a", "b", "c", "d", "e", "f", "g", "h"].map(days));
    expect(spread.size).toBeGreaterThan(1);
  });

  it("estimates retrievability with the FSRS-6 forgetting curve", () => {
    const schedule: StoredSchedule = {
      due: "2026-11-19T12:00:00.000Z",
      stability: 10,
      difficulty: 5,
      scheduled_days: 10,
      learning_steps: 0,
      reps: 3,
      lapses: 0,
      state: "Review",
      last_review: "2026-11-09T12:00:00.000Z",
    };
    // By definition R = 90% when elapsed time equals stability.
    expect(getRetrievability(schedule, new Date("2026-11-19T12:00:00.000Z"))).toBeCloseTo(0.9, 2);
    expect(getRetrievability(schedule, new Date("2026-12-19T12:00:00.000Z"))).toBeLessThan(0.9);
    expect(getRetrievability(createStoredSchedule())).toBe(1);
  });

  it("formats intervals compactly", () => {
    const from = new Date("2026-07-12T12:00:00.000Z");
    const plus = (ms: number) => new Date(from.getTime() + ms);

    expect(formatInterval(from, plus(10 * 60_000))).toBe("10 хв");
    expect(formatInterval(from, plus(5 * 3_600_000))).toBe("5 год");
    expect(formatInterval(from, plus(3 * 86_400_000))).toBe("3 дн");
    expect(formatInterval(from, plus(62 * 86_400_000))).toBe("2 міс");
    expect(formatInterval(from, plus(550 * 86_400_000))).toBe("1,5 р");
  });
});
