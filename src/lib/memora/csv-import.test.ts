import { describe, expect, it } from "vitest";
import { parseCsvImport } from "./csv-import";
import type { Note } from "./types";

const existingEnglishNote: Note = {
  id: "note-existing-flaky",
  module: "english",
  title: "flaky test",
  status: "active",
  source: "user",
  tags: ["english", "user"],
  content: {
    lemma_en: "flaky test",
    translation_uk: "нестабільний тест",
  },
  createdAt: new Date(0).toISOString(),
};

describe("csv import", () => {
  it("parses English CSV rows and marks existing duplicates", () => {
    const preview = parseCsvImport(
      [
        "lemma_en,translation_uk,part_of_speech,example_en",
        "flaky test,нестабільний тест,phrase,This flaky test fails only in CI.",
        "edge case,крайній випадок,phrase,This edge case breaks validation.",
      ].join("\n"),
      "english",
      [existingEnglishNote],
    );

    expect(preview.summary).toEqual({
      total: 2,
      ready: 1,
      duplicates: 1,
      invalid: 0,
    });
    expect(preview.rows[0].status).toBe("duplicate");
    expect(preview.rows[1].draft).toMatchObject({
      lemma: "edge case",
      translation: "крайній випадок",
      partOfSpeech: "phrase",
    });
  });

  it("supports semicolon-delimited QA CSV with quoted separators", () => {
    const preview = parseCsvImport(
      [
        "term;short_definition;example",
        '"Smoke testing";"Швидка перевірка, що критичні функції працюють";"Після деплою: run smoke tests."',
      ].join("\n"),
      "qa",
      [],
    );

    expect(preview.summary.ready).toBe(1);
    expect(preview.rows[0].draft).toMatchObject({
      term: "Smoke testing",
      definition: "Швидка перевірка, що критичні функції працюють",
      example: "Після деплою: run smoke tests.",
    });
  });

  it("reports missing required headers and invalid rows", () => {
    const missingHeader = parseCsvImport("lemma_en,example_en\nbug,text", "english", []);

    expect(missingHeader.summary.invalid).toBe(1);
    expect(missingHeader.rows[0].errors[0]).toContain("Не вистачає колонок");

    const invalidRow = parseCsvImport(
      "term,short_definition\nRegression testing,",
      "qa",
      [],
    );

    expect(invalidRow.summary.invalid).toBe(1);
    expect(invalidRow.rows[0].errors).toContain("Немає українського пояснення.");
  });
});
