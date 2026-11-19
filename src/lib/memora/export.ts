import type { WordContent, WordSource, WordStatus } from "./types";

export type ExportWord = {
  lemma: string;
  content: WordContent;
  source: WordSource;
  status: WordStatus;
};

/** Same columns as the CSV import, plus source and status. */
export function wordsToCsv(words: ExportWord[]) {
  const rows = [
    ["lemma_en", "translation_uk", "part_of_speech", "example_en", "source", "status"],
    ...words.map((word) => [
      word.lemma,
      word.content.translations.join(", "),
      word.content.part_of_speech ?? "",
      word.content.examples[0]?.en ?? "",
      word.source,
      word.status,
    ]),
  ];

  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value: string) {
  const clean = value.replace(/\r?\n/g, " ").trim();
  return /[",\n;]/.test(clean) ? `"${clean.replace(/"/g, '""')}"` : clean;
}
