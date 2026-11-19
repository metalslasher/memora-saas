import { describe, expect, it } from "vitest";
import { renderCard } from "./card-render";

const content = {
  translations: ["розібратися", "зрозуміти"],
  part_of_speech: "phrasal verb",
  examples: [{ en: "I'm still trying to figure it out.", uk: "Я досі намагаюся розібратися." }],
};

describe("renderCard", () => {
  it("renders recognition as English cue → Ukrainian answer", () => {
    expect(renderCard("recognition", "figure out", content)).toEqual({
      instruction: "Що це означає?",
      cue: "figure out",
      cueLanguage: "en",
      answer: "розібратися, зрозуміти",
      answerLanguage: "uk",
      example: content.examples[0],
      partOfSpeech: "phrasal verb",
    });
  });

  it("renders recall as Ukrainian cue → English answer", () => {
    const card = renderCard("recall", "figure out", content);
    expect(card.instruction).toBe("Як сказати англійською?");
    expect(card.cue).toBe("розібратися, зрозуміти");
    expect(card.answer).toBe("figure out");
    expect(card.answerLanguage).toBe("en");
  });

  it("handles words without examples", () => {
    expect(renderCard("recall", "handle", { translations: ["впоратися"], examples: [] }).example).toBeNull();
  });
});
