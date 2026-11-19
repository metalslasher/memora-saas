import { describe, expect, it } from "vitest";
import { lemmaKey } from "./duplicates";
import { starterWords } from "./starter-content";
import { wordDraftErrors } from "./word-content";

describe("starter words", () => {
  it("is a small set of valid, unique English words with examples", () => {
    expect(starterWords.length).toBeGreaterThanOrEqual(8);
    expect(starterWords.length).toBeLessThanOrEqual(12);
    expect(new Set(starterWords.map((word) => lemmaKey(word.lemma))).size).toBe(starterWords.length);
    for (const word of starterWords) {
      expect(wordDraftErrors({ lemma: word.lemma, translation: word.content.translations.join(", ") })).toEqual([]);
      expect(word.content.examples[0]?.en).toBeTruthy();
      expect(word.content.examples[0]?.uk).toBeTruthy();
    }
  });
});
