import { describe, expect, it } from "vitest";
import { canListen, clozeFor, renderCard } from "./card-render";
import type { WordContent } from "./types";

const content: WordContent = {
  translations: ["розібратися", "зрозуміти"],
  part_of_speech: "phrasal verb",
  synonyms: ["work out"],
  examples: [{ en: "I'm still trying to figure it out.", uk: "Я досі намагаюся розібратися." }],
};

describe("renderCard", () => {
  it("renders recognition: English word with its example → Ukrainian meaning, self-rated", () => {
    const card = renderCard("recognition", "figure out", content);
    expect(card).toMatchObject({
      kind: "recognition",
      instruction: "Що це означає?",
      cue: "figure out",
      cueLanguage: "en",
      context: { text: "I'm still trying to figure it out.", language: "en" },
      audio: "figure out",
      answer: "розібратися, зрозуміти",
      answerLanguage: "uk",
      selfGraded: true,
    });
  });

  it("renders recall: Ukrainian meaning + gapped sentence → English word", () => {
    const card = renderCard("recall", "figure out", content);
    expect(card).toMatchObject({
      kind: "recall",
      instruction: "Як це англійською?",
      cue: "розібратися, зрозуміти",
      context: { text: "I'm still trying to _____ it _____.", language: "en" },
      hint: "phrasal verb",
      answer: "figure out",
      selfGraded: false,
    });
    expect(card.check).toMatchObject({ answers: ["figure out"], synonyms: ["work out"], lemma: "figure out" });
  });

  it("renders cloze: the sentence with a gap → the exact form", () => {
    const card = renderCard("cloze", "look forward to", {
      translations: ["чекати з нетерпінням"],
      examples: [{ en: "I'm really looking forward to the weekend.", uk: "Я дуже чекаю на вихідні." }],
    });
    expect(card).toMatchObject({
      kind: "cloze",
      cue: "I'm really _____ the weekend.",
      context: { text: "Я дуже чекаю на вихідні.", language: "uk" },
      answer: "looking forward to",
      meaning: "чекати з нетерпінням",
    });
    expect(card.check.strictForm).toBe(true);
  });

  it("falls back to recall when the cloze sentence is gone", () => {
    const card = renderCard("cloze", "handle", { translations: ["впоратися"], examples: [] });
    expect(card.kind).toBe("recall");
    expect(card.context).toBeNull();
    expect(card.example).toBeNull();
  });

  it("renders listening: audio only → the word, no synonyms", () => {
    const card = renderCard("listening", "figure out", content);
    expect(card).toMatchObject({ kind: "listening", cue: "", audio: "figure out", answer: "figure out" });
    expect(card.check.synonyms).toBeUndefined();
  });

  it("prefers an enriched cloze sentence", () => {
    expect(
      clozeFor("reliable", {
        translations: ["надійний"],
        examples: [{ en: "A reliable car." }],
        cloze: [{ text: "She's the most _____ person on the team.", answer: "reliable" }],
      })?.text,
    ).toBe("She's the most _____ person on the team.");
  });

  it("limits listening to short phrases", () => {
    expect(canListen("look forward to")).toBe(true);
    expect(canListen("keep an eye on the ball")).toBe(false);
  });
});
