import { describe, expect, it } from "vitest";
import {
  calibrate,
  cleanGoals,
  feedLists,
  feedNeed,
  isAssumedKnown,
  listFloor,
  planFeed,
  startingPosition,
  type Candidate,
  type FirstReview,
  type ProgramList,
} from "./program";
import type { PracticeSummary } from "./types";

const noTest = { known: new Set<string>(), unknown: new Set<string>() };

function list(name: ProgramList, count: number, start = 1, frequency?: (rank: number) => number | null): Candidate[] {
  return Array.from({ length: count }, (_, index) => ({
    lexiconId: `${name}-${index}`,
    lemma: `${name}-${start + index}`,
    list: name,
    listRank: start + index,
    frequencyRank: frequency ? frequency(start + index) : start + index,
  }));
}

const summary = (patch: Partial<PracticeSummary> = {}): PracticeSummary => ({
  dueWords: 0,
  reviewsToday: 0,
  newReady: 0,
  newToday: 0,
  dailyMinutes: 15,
  nextDueAt: null,
  activeCards: 0,
  dayStart: new Date().toISOString(),
  ...patch,
});

describe("starting position", () => {
  it("takes the vocabulary as the known boundary and starts the core at half of it", () => {
    expect(startingPosition(3000)).toEqual({ knownRank: 3000, programRank: 1500 });
  });
  it("keeps the core start inside NGSL and above grammar words", () => {
    expect(startingPosition(9000).programRank).toBe(2300);
    expect(startingPosition(0)).toEqual({ knownRank: 0, programRank: 100 });
  });
  it("floors per list", () => {
    expect(listFloor("ngsl", 1500)).toBe(1500);
    expect(listFloor("ngsl", 10)).toBe(100);
    expect(listFloor("ngsl_spoken", 1500)).toBe(100);
    expect(listFloor("theme_work", 1500)).toBe(1);
  });
});

describe("feed need", () => {
  it("tops the unstarted pool up to today's pace plus 5 spare", () => {
    // 15 minutes, no reviews → 6 words today.
    expect(feedNeed(summary())).toBe(11);
    expect(feedNeed(summary({ newReady: 4 }))).toBe(7);
    expect(feedNeed(summary({ newToday: 6 }))).toBe(5);
    expect(feedNeed(summary({ newReady: 20 }))).toBe(0);
  });
});

describe("goals", () => {
  it("keeps known goals in a fixed order", () => {
    expect(cleanGoals(["travel", "nope", "work"])).toEqual(["work", "travel"]);
    expect(cleanGoals("work")).toEqual([]);
  });
  it("reads the core and each goal's lists once", () => {
    expect(feedLists(["general"])).toEqual(["ngsl"]);
    expect(feedLists(["work", "talk"])).toEqual(["ngsl", "theme_work", "bsl", "theme_talk", "ngsl_spoken"]);
  });
});

describe("planFeed", () => {
  it("takes only core words for the general goal", () => {
    const plan = planFeed({ need: 4, goals: ["general"], candidates: { ngsl: list("ngsl", 10, 500) }, knownRank: 0, test: noTest });
    expect(plan.map((word) => word.candidate.lemma)).toEqual(["ngsl-500", "ngsl-501", "ngsl-502", "ngsl-503"]);
  });

  it("mixes a third of themed words, round-robin between goal lists", () => {
    const plan = planFeed({
      need: 6,
      goals: ["work", "travel"],
      candidates: {
        ngsl: list("ngsl", 10, 500),
        theme_work: list("theme_work", 5),
        bsl: list("bsl", 5),
        theme_travel: list("theme_travel", 5),
      },
      knownRank: 0,
      test: noTest,
    });
    const lists = plan.map((word) => word.candidate.list);
    expect(lists.filter((name) => name === "ngsl")).toHaveLength(4);
    expect(lists.slice(0, 2)).toEqual(["theme_work", "bsl"]);
  });

  it("fills from the other side when one runs out", () => {
    const plan = planFeed({
      need: 5,
      goals: ["travel"],
      candidates: { ngsl: list("ngsl", 1, 2800), theme_travel: list("theme_travel", 10) },
      knownRank: 0,
      test: noTest,
    });
    expect(plan).toHaveLength(5);
    expect(plan.filter((word) => word.candidate.list === "theme_travel")).toHaveLength(4);
  });

  it("does not pick the same lemma from two lists", () => {
    const shared: Candidate = { lexiconId: "x", lemma: "meeting", list: "bsl", listRank: 1, frequencyRank: 900 };
    const plan = planFeed({
      need: 3,
      goals: ["work"],
      candidates: { ngsl: [{ ...shared, list: "ngsl" }, ...list("ngsl", 3, 600)], bsl: [shared, ...list("bsl", 2, 2)] },
      knownRank: 0,
      test: noTest,
    });
    expect(plan.filter((word) => word.candidate.lemma === "meeting")).toHaveLength(1);
    expect(plan).toHaveLength(3);
  });

  it("returns nothing when nothing is needed", () => {
    expect(planFeed({ need: 0, goals: [], candidates: { ngsl: list("ngsl", 3) }, knownRank: 0, test: noTest })).toEqual([]);
  });
});

describe("assumed known", () => {
  const word = (frequencyRank: number | null, list: ProgramList = "ngsl"): Candidate => ({
    lexiconId: "1",
    lemma: "reliable",
    list,
    listRank: 1,
    frequencyRank,
  });
  it("uses the frequency boundary", () => {
    expect(isAssumedKnown(word(2500), 3000, noTest)).toBe(true);
    expect(isAssumedKnown(word(3500), 3000, noTest)).toBe(false);
    expect(isAssumedKnown(word(null), 3000, noTest)).toBe(false);
  });
  it("lets the test answers override it", () => {
    expect(isAssumedKnown(word(5000), 3000, { known: new Set(["reliable"]), unknown: new Set() })).toBe(true);
    expect(isAssumedKnown(word(100), 3000, { known: new Set(), unknown: new Set(["reliable"]) })).toBe(false);
  });
  it("never assumes themed phrases", () => {
    expect(isAssumedKnown(word(10, "theme_talk"), 3000, noTest)).toBe(false);
  });
});

describe("calibration", () => {
  const reviews = (assumedKnown: boolean, ratings: FirstReview["rating"][]) =>
    ratings.map((rating) => ({ assumedKnown, rating }));

  it("moves down when known words are failed", () => {
    const result = calibrate({
      reviews: reviews(true, ["again", "again", "again", "good", "good", "good", "good", "good"]),
      knownRank: 3000,
      programRank: 1500,
    });
    expect(result).toMatchObject({ changed: true, knownRank: 2800, programRank: 1300 });
  });

  it("moves up when new words are already recognised", () => {
    const result = calibrate({
      reviews: reviews(false, ["good", "good", "easy", "good", "good", "good", "good", "again"]),
      knownRank: 3000,
      programRank: 2200,
    });
    expect(result).toMatchObject({ changed: true, knownRank: 3200, programRank: 2300 });
  });

  it("waits for enough samples", () => {
    expect(calibrate({ reviews: reviews(true, ["again", "again"]), knownRank: 3000, programRank: 1500 }).changed).toBe(false);
  });

  it("keeps the position when results are mixed", () => {
    const result = calibrate({
      reviews: [
        ...reviews(true, ["again", "good", "good", "good", "good", "good", "good", "good"]),
        ...reviews(false, ["again", "again", "good", "good", "again", "good", "again", "good"]),
      ],
      knownRank: 3000,
      programRank: 1500,
    });
    expect(result.changed).toBe(false);
  });
});
