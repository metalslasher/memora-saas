import { describe, expect, it } from "vitest";
import {
  createStoredSchedule,
  formatInterval,
  previewNextDue,
  scheduleReview,
} from "./scheduler";

describe("scheduler", () => {
  it("advances a new card after a good review", () => {
    const reviewedAt = new Date("2026-07-12T12:00:00.000Z");
    const schedule = createStoredSchedule(reviewedAt);

    const outcome = scheduleReview(schedule, "good", reviewedAt);

    expect(outcome.schedule.reps).toBe(1);
    expect(Date.parse(outcome.schedule.due)).toBeGreaterThan(
      reviewedAt.getTime(),
    );
    expect(outcome.schedule.last_review).toBe(reviewedAt.toISOString());
  });

  it("previews increasing intervals for harder-to-easier ratings", () => {
    const now = new Date("2026-07-12T12:00:00.000Z");
    const preview = previewNextDue(createStoredSchedule(now), now);

    expect(preview.again.getTime()).toBeLessThanOrEqual(preview.hard.getTime());
    expect(preview.hard.getTime()).toBeLessThanOrEqual(preview.good.getTime());
    expect(preview.good.getTime()).toBeLessThan(preview.easy.getTime());
    expect(preview.good.toISOString()).toBe(
      scheduleReview(createStoredSchedule(now), "good", now).schedule.due,
    );
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
