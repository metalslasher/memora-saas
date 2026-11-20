import { describe, expect, it } from "vitest";
import { kindsToUnlock, lockedKinds } from "./exercise-unlock";
import { createStoredSchedule } from "./scheduler";
import type { StoredSchedule, WordContent } from "./types";

const content: WordContent = {
  translations: ["надійний"],
  examples: [{ en: "We need a more reliable way to track this." }],
};
const review = (scheduledDays: number): StoredSchedule => ({
  ...createStoredSchedule(),
  state: "Review",
  reps: 2,
  scheduled_days: scheduledDays,
});
const learning: StoredSchedule = { ...createStoredSchedule(), state: "Learning", reps: 1 };

describe("exercise unlocking", () => {
  it("opens recall once recognition graduates to a day or more", () => {
    const base = { kind: "recognition" as const, lemma: "reliable", content };
    expect(kindsToUnlock({ ...base, rating: "good", after: learning })).toEqual([]);
    expect(kindsToUnlock({ ...base, rating: "good", after: review(1) })).toEqual(["recall"]);
    expect(kindsToUnlock({ ...base, rating: "again", after: review(1) })).toEqual([]);
  });

  it("opens cloze and listening once recall is in Review", () => {
    const base = { kind: "recall" as const, rating: "good" as const, lemma: "reliable", content };
    expect(kindsToUnlock({ ...base, after: learning })).toEqual([]);
    expect(kindsToUnlock({ ...base, after: review(3) })).toEqual(["cloze", "listening"]);
  });

  it("skips cloze without a matching example and listening for long phrases", () => {
    const after = review(3);
    expect(
      kindsToUnlock({ kind: "recall", rating: "good", after, lemma: "reliable", content: { ...content, examples: [] } }),
    ).toEqual(["listening"]);
    expect(
      kindsToUnlock({
        kind: "recall",
        rating: "hard",
        after,
        lemma: "keep an eye on the ball",
        content: { translations: ["стежити"], examples: [] },
      }),
    ).toEqual([]);
  });

  it("does not unlock anything from the later exercises", () => {
    expect(kindsToUnlock({ kind: "cloze", rating: "easy", after: review(9), lemma: "reliable", content })).toEqual([]);
  });

  it("lists exercises the word will still get", () => {
    expect(lockedKinds(["recognition"], "reliable", content)).toEqual(["recall", "cloze", "listening"]);
    expect(lockedKinds(["recognition", "recall", "cloze", "listening"], "reliable", content)).toEqual([]);
  });
});
