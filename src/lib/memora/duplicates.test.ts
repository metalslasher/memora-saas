import { describe, expect, it } from "vitest";
import { findSimilarWords, lemmaKey, normalizeLookupText } from "./duplicates";

const words = [
  { id: "1", lemma: "figure out" },
  { id: "2", lemma: "Deadline" },
  { id: "3", lemma: "look forward to" },
];

describe("duplicates", () => {
  it("normalises lookup text and lemma keys", () => {
    expect(normalizeLookupText("  Café,  Déjà-vu! ")).toBe("cafe deja vu");
    expect(lemmaKey("  Look   Forward ")).toBe("look forward");
  });

  it("finds exact duplicates by the database key", () => {
    expect(findSimilarWords(words, "deadline").exact?.id).toBe("2");
  });

  it("finds close matches", () => {
    const result = findSimilarWords(words, "look forward");
    expect(result.exact).toBeNull();
    expect(result.close.map((word) => word.id)).toEqual(["3"]);
    expect(findSimilarWords(words, "figure out!").close.map((word) => word.id)).toEqual(["1"]);
    expect(findSimilarWords(words, "cat").close).toEqual([]);
  });
});
