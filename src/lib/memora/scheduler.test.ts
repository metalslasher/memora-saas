import { describe, expect, it } from "vitest";
import { createStoredSchedule, scheduleReview } from "./scheduler";

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
});
