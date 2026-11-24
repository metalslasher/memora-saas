import { describe, expect, it } from "vitest";
import {
  answer,
  bandShares,
  buildChecks,
  cefrFromVocab,
  confirmationRate,
  correctedShare,
  readTestResult,
  rebuildTest,
  scoreTest,
  startTest,
  type TestPool,
  type TestState,
} from "./vocab-test";
import { vocabTestPool } from "./vocab-test-pool";

function seeded(seed = 1) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const pool: TestPool = {
  bands: Array.from({ length: 10 }, (_, index) => ({
    band: index + 1,
    words: Array.from({ length: 8 }, (_, n) => ({
      word: `w${index + 1}x${n}`,
      uk: `слово ${index + 1}-${n}`,
      rank: index * 1000 + n + 1,
    })),
  })),
  pseudowords: Array.from({ length: 40 }, (_, n) => `pseudo${n}`),
};

/** Runs the test with a learner who knows bands ≤ `knows` and says yes to pseudowords if `guesses`. */
function run(knows: number, guesses = false, random = seeded()) {
  let state: TestState = startTest(pool, random);
  while (!state.done) {
    const item = state.items[state.answers.length];
    const yes = item.kind === "real" ? item.band <= knows : guesses;
    state = answer(state, yes, pool, random);
  }
  return state;
}

describe("correction for guessing", () => {
  it("is the hit rate without false alarms", () => {
    expect(correctedShare(4, 5, 0)).toBeCloseTo(0.8);
  });
  it("discounts false alarms", () => {
    expect(correctedShare(5, 5, 0.5)).toBe(1);
    expect(correctedShare(3, 5, 0.5)).toBeCloseTo(0.2);
    expect(correctedShare(2, 5, 0.5)).toBe(0);
    expect(correctedShare(5, 5, 1)).toBe(0);
  });
  it("corrects the meaning check for 4 options", () => {
    expect(confirmationRate(4, 4)).toBe(1);
    expect(confirmationRate(1, 4)).toBe(0);
    expect(confirmationRate(3, 4)).toBeCloseTo(2 / 3);
    expect(confirmationRate(0, 2)).toBe(1);
  });
});

describe("adaptive yes/no", () => {
  it("starts with a block of 5 real words and 2 pseudowords from band 1", () => {
    const state = startTest(pool, seeded());
    expect(state.items).toHaveLength(7);
    expect(state.items.filter((item) => item.kind === "pseudo")).toHaveLength(2);
    expect(state.items.every((item) => item.kind === "pseudo" || item.band === 1)).toBe(true);
  });

  it("skips a band when the current one is known and stops after two weak bands", () => {
    const state = run(4);
    expect(state.bands).toEqual([1, 3, 5, 4, 6]);
    expect(state.done).toBe(true);
  });

  it("a beginner stops after two bands", () => {
    expect(run(0).bands).toEqual([1, 2]);
  });

  it("never repeats a word", () => {
    const state = run(10);
    const words = state.items.map((item) => item.word);
    expect(new Set(words).size).toBe(words.length);
  });
});

describe("scoring", () => {
  it("estimates the vocabulary of a learner who knows the first bands", () => {
    const state = run(4);
    const result = scoreTest(state, []);
    expect(result.vocab).toBe(4000);
    expect(result.bands.slice(0, 4)).toEqual([1, 1, 1, 1]);
    expect(result.bands.slice(4)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it("gives zero when the learner says yes to everything", () => {
    const result = scoreTest(run(10, true), []);
    expect(result.vocab).toBe(0);
    expect(result.falseAlarm).toBe(1);
  });

  it("scales the bands by the corrected meaning check", () => {
    const state = run(4);
    const checks = [
      { word: "a", correct: true },
      { word: "b", correct: true },
      { word: "c", correct: true },
      { word: "d", correct: false },
    ];
    expect(scoreTest(state, checks).vocab).toBe(Math.round((4000 * (2 / 3)) / 50) * 50);
  });

  it("lists confirmed and rejected words", () => {
    const state = run(4);
    const yesWords = state.items.filter((item, index) => item.kind === "real" && state.answers[index]);
    const result = scoreTest(state, [
      { word: yesWords[0].word, correct: true },
      { word: yesWords[1].word, correct: false },
    ]);
    expect(result.known).toEqual([yesWords[0].word]);
    expect(result.unknown).toContain(yesWords[1].word);
    expect(result.unknown.some((word) => word.startsWith("w6"))).toBe(true);
  });

  it("maps vocabulary to an approximate CEFR level", () => {
    expect(cefrFromVocab(1000)).toBe("A1");
    expect(cefrFromVocab(3000)).toBe("B1");
    expect(cefrFromVocab(6000)).toBe("C2");
  });

  it("reads a stored result defensively", () => {
    expect(readTestResult(null)).toBeNull();
    expect(readTestResult({ vocab: 3000, bands: [1, 0.5] })?.known).toEqual([]);
  });
});

describe("meaning checks", () => {
  it("asks about yes answers only, with 4 distinct options and the right one among them", () => {
    const state = run(4);
    const checks = buildChecks(state, pool, seeded(3));
    expect(checks.length).toBeGreaterThan(0);
    expect(checks.length).toBeLessThanOrEqual(12);
    for (const check of checks) {
      expect(check.options).toHaveLength(4);
      expect(new Set(check.options).size).toBe(4);
      expect(check.options[check.answer]).toBe(pool.bands[check.band - 1].words.find((w) => w.word === check.word)?.uk);
      expect(check.band).toBeLessThanOrEqual(4);
    }
  });
});

describe("the real pool", () => {
  it("has enough words per band and clean pseudowords", () => {
    for (const band of vocabTestPool.bands) {
      expect(band.words.length).toBeGreaterThanOrEqual(7);
      expect(new Set(band.words.map((word) => word.uk)).size).toBe(band.words.length);
      for (const word of band.words) {
        expect(word.rank).toBeGreaterThan((band.band - 1) * 1000);
        expect(word.rank).toBeLessThanOrEqual(band.band * 1000);
      }
    }
    const real = new Set(vocabTestPool.bands.flatMap((band) => band.words.map((word) => word.word)));
    expect(vocabTestPool.pseudowords.length).toBeGreaterThanOrEqual(40);
    expect(vocabTestPool.pseudowords.some((word) => real.has(word))).toBe(false);
  });

  it("runs a full test without running out of words", () => {
    let state = startTest(vocabTestPool, seeded(7));
    while (!state.done) {
      const item = state.items[state.answers.length];
      state = answer(state, item.kind === "real", vocabTestPool, seeded(state.answers.length));
    }
    expect(bandShares(state).map((share) => share.band)).toEqual([1, 3, 5, 7, 9, 10]);
    expect(scoreTest(state, []).vocab).toBe(10000);
  });
});

describe("server re-scoring", () => {
  it("rebuilds the test from answers, ignoring unknown and repeated words", () => {
    const state = run(4);
    const answers = state.items.map((item, index) => ({ word: item.word, yes: state.answers[index] }));
    const rebuilt = rebuildTest(pool, [...answers, { word: "hacked", yes: true }, answers[0]], [
      { word: answers.find((entry) => entry.yes && entry.word.startsWith("w"))!.word, correct: true },
      { word: "pseudo0", correct: true },
    ]);
    expect(rebuilt.state.items).toHaveLength(state.items.length);
    expect(scoreTest(rebuilt.state, []).vocab).toBe(scoreTest(state, []).vocab);
    expect(rebuilt.checks).toHaveLength(1);
  });
});
