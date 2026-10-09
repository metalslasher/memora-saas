import { describe, expect, it } from "vitest";
import { acceptedAnswers, checkAnswer, normalizeAnswer } from "./answer-check";

describe("answer check", () => {
  it("treats case, punctuation and leading articles as equal", () => {
    expect(normalizeAnswer("  To Deploy! ")).toBe("deploy");
    expect(checkAnswer("the bug", "Bug").verdict).toBe("exact");
  });

  it("accepts any listed alternative", () => {
    expect(acceptedAnswers("дефект, баг / помилка")).toEqual(
      expect.arrayContaining(["дефект", "баг", "помилка"]),
    );
    expect(checkAnswer("баг", "дефект, баг").verdict).toBe("exact");
  });

  it("forgives a small typo", () => {
    const result = checkAnswer("regresion", "regression");
    expect(result.verdict).toBe("close");
    expect(result.suggestedRating).toBe("good");
  });

  it("flags a clearly different short answer", () => {
    const result = checkAnswer("feature", "bug");
    expect(result.verdict).toBe("different");
    expect(result.suggestedRating).toBe("again");
  });

  it("lets the learner judge long free-form explanations", () => {
    const result = checkAnswer(
      "перевірка що старий функціонал не зламався",
      "Перевірка, що вже робочий функціонал не зламався після змін у коді.",
    );
    expect(result.verdict).toBe("self");
    expect(result.suggestedRating).toBeNull();
    expect(result.similarity).toBeGreaterThan(0.3);
  });

  it("reports empty input", () => {
    expect(checkAnswer("   ", "bug").verdict).toBe("empty");
  });
});
