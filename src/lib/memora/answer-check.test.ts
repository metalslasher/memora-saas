import { describe, expect, it } from "vitest";
import { acceptedAnswers, checkAnswer, diffAnswer, normalizeAnswer } from "./answer-check";

describe("answer check", () => {
  it("normalises case, punctuation, articles and to", () => {
    expect(checkAnswer("the bug", { answers: ["Bug"] }).verdict).toBe("exact");
    expect(checkAnswer("To handle", { answers: ["handle"] }).verdict).toBe("exact");
    expect(normalizeAnswer("  It’s (informal) OK! ")).toBe("it's ok");
  });

  it("accepts any listed alternative and extra accepted spellings", () => {
    expect(checkAnswer("баг", { answers: ["дефект, баг"] }).verdict).toBe("exact");
    expect(checkAnswer("okay", { answers: ["OK"], accepted: ["okay"] }).verdict).toBe("exact");
    expect(acceptedAnswers("x / y; z or w")).toEqual(["x y z or w", "x", "y", "z", "w"]);
  });

  it("accepts word forms in recall, but flags the wrong form in a cloze", () => {
    expect(checkAnswer("handled", { answers: ["handle"], lemma: "handle" }).verdict).toBe("exact");
    expect(checkAnswer("went", { answers: ["go"], lemma: "go" }).verdict).toBe("exact");
    expect(checkAnswer("looking forward to", { answers: ["look forward to"], lemma: "look forward to" }).verdict).toBe(
      "exact",
    );

    const cloze = checkAnswer("look forward to", {
      answers: ["looking forward to"],
      lemma: "look forward to",
      strictForm: true,
    });
    expect(cloze.verdict).toBe("form");
    expect(cloze.diff).not.toBeNull();
  });

  it("recognises synonyms as correct but not the target word", () => {
    const result = checkAnswer("dependable", { answers: ["reliable"], synonyms: ["dependable", "trustworthy"] });
    expect(result.verdict).toBe("synonym");
  });

  it("treats a small typo as close and shows the difference", () => {
    const result = checkAnswer("regresion", { answers: ["regression"] });
    expect(result.verdict).toBe("close");
    expect(result.diff?.expected).toEqual([
      { text: "regre", ok: true },
      { text: "s", ok: false },
      { text: "sion", ok: true },
    ]);
  });

  it("rejects a clearly different answer", () => {
    const result = checkAnswer("feature", { answers: ["bug"] });
    expect(result.verdict).toBe("different");
    expect(result.diff).toBeNull(); // too different to highlight
  });

  it("leaves long free-form answers to the learner", () => {
    const result = checkAnswer("I am trying to understand it", {
      answers: ["I am still trying to figure out how this whole thing works"],
    });
    expect(result.verdict).toBe("self");
  });

  it("handles empty input", () => {
    expect(checkAnswer("   ", { answers: ["bug"] }).verdict).toBe("empty");
  });

  it("diffs typed and expected text letter by letter", () => {
    expect(diffAnswer("handel", "handle")).toEqual({
      typed: [
        { text: "hand", ok: true },
        { text: "el", ok: false },
      ],
      expected: [
        { text: "hand", ok: true },
        { text: "le", ok: false },
      ],
    });
  });
});
