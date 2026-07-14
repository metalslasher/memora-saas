import { describe, expect, it } from "vitest";
import {
  englishContentFromDraft,
  generateEnglishCards,
  generateQaCards,
  qaContentFromDraft,
} from "./card-generator";
import { hasUkrainianSignal } from "./language-policy";

describe("card generator", () => {
  it("normalizes English drafts and generates two recall cards", () => {
    const draft = {
      lemma: "  flaky   test ",
      translation: "  нестабільний тест ",
      example: "  This flaky test fails only in CI. ",
    };

    expect(englishContentFromDraft(draft)).toMatchObject({
      lemma_en: "flaky test",
      translation_uk: "нестабільний тест",
      part_of_speech: "phrase",
      example_en: "This flaky test fails only in CI.",
    });

    const cards = generateEnglishCards(draft);

    expect(cards).toHaveLength(2);
    expect(cards.map((card) => card.type)).toEqual([
      "productive_translation",
      "receptive_translation",
    ]);
    expect(cards[0]).toMatchObject({
      prompt: "Як сказати англійською: нестабільний тест?",
      answer: "flaky test",
      tags: ["english", "user"],
    });
    expect(hasUkrainianSignal(cards[0].explanation)).toBe(true);
    expect(cards[1]).toMatchObject({
      prompt: 'Що українською означає "flaky test"?',
      answer: "нестабільний тест",
    });
    expect(hasUkrainianSignal(cards[1].explanation)).toBe(true);
  });

  it("normalizes QA drafts and generates forward and reverse cards", () => {
    const draft = {
      term: "  Smoke   testing ",
      definition: "  Швидка перевірка, що критичні функції досі працюють. ",
      example: "  Після деплою запусти smoke tests. ",
    };

    expect(qaContentFromDraft(draft)).toMatchObject({
      term: "Smoke testing",
      short_definition: "Швидка перевірка, що критичні функції досі працюють.",
      example: "Після деплою запусти smoke tests.",
    });

    const cards = generateQaCards(draft);

    expect(cards).toHaveLength(2);
    expect(cards.map((card) => card.type)).toEqual([
      "term_definition",
      "definition_term",
    ]);
    expect(cards[0].prompt).toBe(
      "Поясни українською: що таке Smoke testing?",
    );
    expect(hasUkrainianSignal(cards[0].explanation)).toBe(true);
    expect(cards[1]).toMatchObject({
      prompt:
        "Який QA термін відповідає цьому поясненню: Швидка перевірка, що критичні функції досі працюють.",
      answer: "Smoke testing",
      tags: ["qa", "user"],
    });
    expect(hasUkrainianSignal(cards[1].explanation)).toBe(true);
  });

  it("does not generate incomplete cards", () => {
    expect(
      generateEnglishCards({ lemma: "bug", translation: "", example: "" }),
    ).toEqual([]);
    expect(
      generateQaCards({ term: "", definition: "A definition", example: "" }),
    ).toEqual([]);
  });
});
