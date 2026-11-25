import { describe, expect, it } from "vitest";
import {
  dailyProductionQuota,
  heardWord,
  limitProductionCards,
  ratingFromFeedback,
  sentenceIdea,
  sentenceIdeas,
} from "./production";
import { createStoredSchedule } from "./scheduler";
import type { CardKind, PracticeCard } from "./types";

const card = (id: string, kind: CardKind): PracticeCard => ({
  id,
  userWordId: `w-${id}`,
  kind,
  lemma: "reliable",
  content: { translations: ["надійний"], examples: [] },
  schedule: createStoredSchedule(),
  wordReviewedAt: null,
});

describe("production exercises", () => {
  it("scales the daily quota with the practice minutes", () => {
    expect(dailyProductionQuota(5)).toBe(2);
    expect(dailyProductionQuota(10)).toBe(2);
    expect(dailyProductionQuota(15)).toBe(3);
    expect(dailyProductionQuota(20)).toBe(4);
    expect(dailyProductionQuota(30)).toBe(6);
    expect(dailyProductionQuota(120)).toBe(10);
  });

  it("keeps only the allowed number of production cards per kind", () => {
    const cards = [
      card("a", "recall"),
      card("b", "sentence"),
      card("c", "speaking"),
      card("d", "sentence"),
      card("e", "speaking"),
      card("f", "cloze"),
    ];
    expect(limitProductionCards(cards, { sentence: 1, speaking: 0 }).map((item) => item.id)).toEqual(["a", "b", "f"]);
    expect(limitProductionCards(cards, { sentence: 5, speaking: 5 })).toHaveLength(6);
  });

  it("rates from the feedback and never gives Easy", () => {
    expect(ratingFromFeedback({ verdict: "wrong", mistakes: [] })).toBe("again");
    expect(ratingFromFeedback({ verdict: "minor", mistakes: [] })).toBe("hard");
    expect(ratingFromFeedback({ verdict: "good", mistakes: [{ wrong: "a", right: "b", why: "c" }] })).toBe("hard");
    expect(ratingFromFeedback({ verdict: "good", mistakes: [] })).toBe("good");
  });

  it("finds the target word in a transcript in any form", () => {
    expect(heardWord("My car is pretty reliable.", "reliable")).toBe(true);
    expect(heardWord("I'm looking forward to it", "look forward to")).toBe(true);
    expect(heardWord("she went home early", "go")).toBe(true);
    expect(heardWord("My car is pretty relay bull", "reliable")).toBe(false);
    expect(heardWord("unreliable people", "reliable")).toBe(false);
    expect(heardWord("", "reliable")).toBe(false);
    expect(heardWord("He's got a lot of stuff", "get", ["got"])).toBe(true);
  });

  it("picks a stable idea per review that changes between reviews", () => {
    expect(sentenceIdea("card-1", 0)).toBe(sentenceIdea("card-1", 0));
    const ideas = new Set(Array.from({ length: 12 }, (_, reps) => sentenceIdea("card-1", reps)));
    expect(ideas.size).toBeGreaterThan(3);
    expect(sentenceIdeas).toContain(sentenceIdea("x", 3));
  });
});
