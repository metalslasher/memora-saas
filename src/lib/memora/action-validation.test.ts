import { describe, expect, it } from "vitest";
import {
  validateEnglishDraft,
  validateEnglishImportDrafts,
  validateItemStatus,
  validateProfileDraft,
  validateQaDraft,
  validateQaImportDrafts,
  validateReviewInput,
  validateSettings,
} from "./action-validation";

describe("action validation", () => {
  it("normalizes valid note drafts", () => {
    expect(
      validateEnglishDraft({
        lemma: " flaky   test ",
        translation: " нестабільний тест ",
        example: "",
      }),
    ).toMatchObject({
      lemma: "flaky test",
      translation: "нестабільний тест",
    });

    expect(
      validateQaDraft({
        term: " Regression   testing ",
        definition: " Перевірка, що старий функціонал не зламався. ",
        example: "",
      }),
    ).toMatchObject({
      term: "Regression testing",
      definition: "Перевірка, що старий функціонал не зламався.",
    });
  });

  it("rejects incomplete note drafts", () => {
    expect(() =>
      validateEnglishDraft({ lemma: "", translation: "значення", example: "" }),
    ).toThrow("Заповни");
    expect(() =>
      validateQaDraft({ term: "Smoke testing", definition: "", example: "" }),
    ).toThrow("Заповни");
  });

  it("validates import batches", () => {
    expect(
      validateEnglishImportDrafts([
        {
          lemma: " flaky test ",
          translation: " нестабільний тест ",
          example: "",
        },
      ]),
    ).toHaveLength(1);

    expect(() => validateQaImportDrafts([])).toThrow("Немає рядків");
    expect(() =>
      validateEnglishImportDrafts(
        Array.from({ length: 201 }, (_, index) => ({
          lemma: `word ${index}`,
          translation: "значення",
          example: "",
        })),
      ),
    ).toThrow("до 200");
  });

  it("validates review input", () => {
    expect(
      validateReviewInput({
        cardId: " card-1 ",
        rating: "good",
        responseText: " answer ",
        elapsedMs: 1200.4,
      }),
    ).toEqual({
      cardId: "card-1",
      rating: "good",
      responseText: "answer",
      elapsedMs: 1200,
    });
  });

  it("validates settings and statuses", () => {
    expect(validateItemStatus("active")).toBe("active");
    expect(() => validateItemStatus("bad" as "active")).toThrow("статус");

    expect(
      validateSettings({
        desiredRetention: 0.9,
        dailyNewLimit: 8,
        reviewButtons: "simple",
        studyMode: "daily",
      }),
    ).toMatchObject({
      desiredRetention: 0.9,
      dailyNewLimit: 8,
    });
  });

  it("validates profile settings", () => {
    expect(
      validateProfileDraft({
        locale: "uk-UA",
        timezone: "Europe/Kiev",
        level: "intermediate",
        dailyMinutes: 30,
        primaryGoal: " QA interview confidence ",
      }),
    ).toEqual({
      locale: "uk-UA",
      timezone: "Europe/Kiev",
      level: "intermediate",
      dailyMinutes: 30,
      primaryGoal: "QA interview confidence",
    });

    expect(() =>
      validateProfileDraft({
        locale: "en-US",
        timezone: "Europe/Kiev",
        level: "",
        dailyMinutes: 30,
        primaryGoal: "",
      }),
    ).toThrow();
    expect(() =>
      validateProfileDraft({
        locale: "uk-UA",
        timezone: "Europe/Kiev",
        level: "",
        dailyMinutes: 4,
        primaryGoal: "",
      }),
    ).toThrow();
  });
});
