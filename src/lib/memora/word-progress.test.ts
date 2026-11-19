import { describe, expect, it } from "vitest";
import type { CardStatus, FsrsState } from "./types";
import { cardStage, wordProgress } from "./word-progress";

function card(patch: { status?: CardStatus; reps?: number; scheduled_days?: number; state?: FsrsState } = {}) {
  return { status: "active" as CardStatus, reps: 0, scheduled_days: 0, state: "New" as FsrsState, ...patch };
}

describe("word progress", () => {
  it("summarises a word by its weakest active card", () => {
    expect(wordProgress([])).toEqual({ label: "—", level: 0 });
    expect(wordProgress([card(), card()])).toEqual({ label: "нове", level: 0 });
    expect(
      wordProgress([card({ reps: 3, scheduled_days: 30, state: "Review" }), card({ reps: 1, scheduled_days: 1 })]).level,
    ).toBe(1);
    expect(
      wordProgress([card({ reps: 3, scheduled_days: 30, state: "Review" }), card({ status: "paused" })]).level,
    ).toBe(3);
  });

  it("buckets cards into stages like the database does", () => {
    expect(cardStage(card())).toBe("new");
    expect(cardStage(card({ reps: 2, state: "Relearning" }))).toBe("learning");
    expect(cardStage(card({ reps: 2, state: "Review", scheduled_days: 5 }))).toBe("young");
    expect(cardStage(card({ reps: 5, state: "Review", scheduled_days: 21 }))).toBe("mature");
  });
});
