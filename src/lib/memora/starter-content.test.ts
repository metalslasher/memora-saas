import { describe, expect, it } from "vitest";
import { hasUkrainianSignal } from "./language-policy";
import { starterCards, starterNotes } from "./starter-content";

describe("starter content", () => {
  it("keeps the starter deck compact and complete", () => {
    expect(starterNotes).toHaveLength(6);
    expect(starterCards).toHaveLength(8);
  });

  it("does not contain mojibake artifacts", () => {
    const serialized = JSON.stringify({ starterCards, starterNotes });

    expect(serialized).not.toMatch(/[ÐÑ]/);
  });

  it("uses Ukrainian support text for prompts and explanations", () => {
    for (const card of starterCards) {
      expect(hasUkrainianSignal(card.explanation)).toBe(true);

      if (card.module === "qa") {
        expect(hasUkrainianSignal(card.prompt)).toBe(true);
        expect(hasUkrainianSignal(card.answer)).toBe(true);
      }
    }
  });
});
