import { describe, expect, it } from "vitest";
import { csvTemplate, MAX_IMPORT_ROWS, parseWordsCsv } from "./csv-import";

describe("parseWordsCsv", () => {
  it("parses the template", () => {
    const preview = parseWordsCsv(csvTemplate(), new Set());
    expect(preview.summary).toEqual({ total: 2, ready: 2, duplicates: 0, invalid: 0 });
    expect(preview.rows[0].draft).toEqual({
      lemma: "figure out",
      translation: "розібратися, зрозуміти",
      partOfSpeech: "phrasal verb",
      example: "I'm still trying to figure out how this works.",
    });
  });

  it("accepts Ukrainian headers and semicolons", () => {
    const preview = parseWordsCsv("слово;переклад\nhandle;впоратися", new Set());
    expect(preview.rows[0]).toMatchObject({ status: "ready", draft: { lemma: "handle", translation: "впоратися" } });
  });

  it("flags duplicates of the library and of earlier rows", () => {
    const preview = parseWordsCsv("word,translation\nDeadline,дедлайн\nissue,проблема\nissue,питання", new Set(["deadline"]));
    expect(preview.rows.map((row) => row.status)).toEqual(["duplicate", "ready", "duplicate"]);
    expect(preview.rows[2].duplicateOf).toBe("повторює рядок 3");
  });

  it("reports invalid rows and missing columns", () => {
    expect(parseWordsCsv("lemma_en,translation_uk\nhello,", new Set()).rows[0]).toMatchObject({
      status: "invalid",
      errors: ["Немає українського перекладу."],
    });
    expect(parseWordsCsv("foo,bar\n1,2", new Set()).rows[0].errors[0]).toMatch(/Не вистачає колонок/);
    expect(parseWordsCsv("", new Set()).rows[0].errors).toEqual(["CSV-файл порожній."]);
  });

  it("limits the number of rows", () => {
    const rows = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => `w${i},с${i}`);
    expect(parseWordsCsv(["lemma,translation", ...rows].join("\n"), new Set()).summary.invalid).toBe(1);
  });

  it("handles quoted cells with commas and quotes", () => {
    const preview = parseWordsCsv('lemma,translation,example\nsay,"казати, говорити","He said ""hi""."', new Set());
    expect(preview.rows[0].draft).toMatchObject({ translation: "казати, говорити", example: 'He said "hi".' });
  });
});
