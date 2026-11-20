import { describe, expect, it } from "vitest";
import { autoGrade, easyTimeLimitMs } from "./auto-grade";

const base = { answer: "reliable", state: "Review" as const, elapsedMs: 10_000 };

describe("autoGrade", () => {
  it("maps verdicts to ratings", () => {
    expect(autoGrade({ ...base, verdict: "different" })).toBe("again");
    expect(autoGrade({ ...base, verdict: "close" })).toBe("hard");
    expect(autoGrade({ ...base, verdict: "form" })).toBe("hard");
    expect(autoGrade({ ...base, verdict: "synonym" })).toBe("hard");
    expect(autoGrade({ ...base, verdict: "exact" })).toBe("good");
  });

  it("leaves silent and free-form answers to the learner", () => {
    expect(autoGrade({ ...base, verdict: "empty" })).toBeNull();
    expect(autoGrade({ ...base, verdict: "self" })).toBeNull();
  });

  it("gives Easy only for a fast exact answer on a card in Review", () => {
    const fast = easyTimeLimitMs("reliable");
    expect(fast).toBe(2500 + 8 * 200);
    expect(autoGrade({ ...base, verdict: "exact", elapsedMs: fast })).toBe("easy");
    expect(autoGrade({ ...base, verdict: "exact", elapsedMs: fast + 1 })).toBe("good");
    expect(autoGrade({ ...base, verdict: "exact", elapsedMs: 1000, state: "New" })).toBe("good");
    expect(autoGrade({ ...base, verdict: "exact", elapsedMs: 1000, state: "Relearning" })).toBe("good");
  });

  it("scales the time budget with the answer length, ignoring spaces", () => {
    expect(easyTimeLimitMs("look forward to")).toBe(2500 + 13 * 200);
    expect(easyTimeLimitMs("x".repeat(100))).toBe(2500 + 40 * 200);
  });
});
