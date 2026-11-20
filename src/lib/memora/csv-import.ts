import { lemmaKey, normalizeLookupText } from "./duplicates";
import type { WordDraft } from "./types";
import { normalizeWordDraft, wordDraftErrors, type NormalizedWordDraft } from "./word-content";

export const MAX_IMPORT_ROWS = 200;

export type CsvImportRow = {
  rowNumber: number;
  status: "ready" | "duplicate" | "invalid";
  draft?: NormalizedWordDraft;
  errors: string[];
  /** Why the row is a duplicate: an existing word or an earlier CSV row. */
  duplicateOf?: string;
};

export type CsvImportPreview = {
  rows: CsvImportRow[];
  summary: { total: number; ready: number; duplicates: number; invalid: number };
};

const headerAliases: Record<string, keyof WordDraft> = {
  lemma: "lemma",
  lemma_en: "lemma",
  word: "lemma",
  phrase: "lemma",
  english: "lemma",
  english_word: "lemma",
  english_phrase: "lemma",
  слово: "lemma",
  фраза: "lemma",
  англійське_слово: "lemma",
  translation: "translation",
  translation_uk: "translation",
  translations: "translation",
  meaning: "translation",
  ukrainian: "translation",
  значення: "translation",
  переклад: "translation",
  part_of_speech: "partOfSpeech",
  pos: "partOfSpeech",
  частина_мови: "partOfSpeech",
  example: "example",
  example_en: "example",
  sentence: "example",
  приклад: "example",
};

/**
 * Parses a CSV of words (comma, semicolon or tab separated). `existingLemmas`
 * holds lemmaKey() values of the learner's library for duplicate detection.
 */
export function parseWordsCsv(text: string, existingLemmas: ReadonlySet<string>): CsvImportPreview {
  const normalizedText = text.replace(/^﻿/, "").trim();
  if (!normalizedText) return failedPreview("CSV-файл порожній.");

  const records = parseWithDetectedDelimiter(normalizedText);
  if (records.length < 2) {
    return failedPreview("У CSV має бути рядок із заголовками і хоча б один рядок слів.");
  }

  const fields = records[0].map((header) => headerAliases[normalizeHeader(header)] ?? null);
  const missing: string[] = [];
  if (!fields.includes("lemma")) missing.push("англійське слово (lemma_en)");
  if (!fields.includes("translation")) missing.push("переклад (translation_uk)");
  if (missing.length > 0) return failedPreview(`Не вистачає колонок: ${missing.join(", ")}.`);

  const dataRecords = records.slice(1);
  if (dataRecords.length > MAX_IMPORT_ROWS) {
    return failedPreview(`За один раз можна імпортувати до ${MAX_IMPORT_ROWS} рядків.`);
  }

  const seen = new Map<string, number>();
  const rows: CsvImportRow[] = dataRecords.map((record, index) => {
    const rowNumber = index + 2;
    const draft: WordDraft = { lemma: "", translation: "", partOfSpeech: "", example: "" };
    fields.forEach((field, cellIndex) => {
      if (field) draft[field] = record[cellIndex] ?? "";
    });
    const normalized = normalizeWordDraft(draft);
    const errors = wordDraftErrors(normalized);
    if (errors.length > 0) return { rowNumber, status: "invalid", errors };

    const key = lemmaKey(normalized.lemma);
    const earlierRow = seen.get(key);
    if (!seen.has(key)) seen.set(key, rowNumber);
    if (existingLemmas.has(key)) {
      return { rowNumber, status: "duplicate", draft: normalized, errors: [], duplicateOf: "уже є у твоїх словах" };
    }
    if (earlierRow !== undefined) {
      return { rowNumber, status: "duplicate", draft: normalized, errors: [], duplicateOf: `повторює рядок ${earlierRow}` };
    }
    return { rowNumber, status: "ready", draft: normalized, errors: [] };
  });

  return { rows, summary: summarize(rows) };
}

export function csvTemplate() {
  return [
    "lemma_en,translation_uk,part_of_speech,example_en",
    "figure out,\"розібратися, зрозуміти\",phrasal verb,I'm still trying to figure out how this works.",
    "reliable,надійний,adjective,We need a more reliable way to track this.",
  ].join("\n");
}

function failedPreview(message: string): CsvImportPreview {
  const rows: CsvImportRow[] = [{ rowNumber: 1, status: "invalid", errors: [message] }];
  return { rows, summary: summarize(rows) };
}

function summarize(rows: CsvImportRow[]) {
  return {
    total: rows.length,
    ready: rows.filter((row) => row.status === "ready").length,
    duplicates: rows.filter((row) => row.status === "duplicate").length,
    invalid: rows.filter((row) => row.status === "invalid").length,
  };
}

function parseWithDetectedDelimiter(text: string) {
  const candidates = [",", ";", "\t"].map((delimiter) => parseCsvRecords(text, delimiter));
  return candidates
    .filter((records) => records.length > 0)
    .sort((a, b) => b[0].length - a[0].length)[0] ?? [];
}

function parseCsvRecords(text: string, delimiter: string) {
  const records: string[][] = [];
  let record: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && char === delimiter) {
      record.push(cell);
      cell = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      record.push(cell);
      records.push(record);
      record = [];
      cell = "";
      if (char === "\r" && next === "\n") index += 1;
    } else {
      cell += char;
    }
  }

  record.push(cell);
  records.push(record);
  return records.filter((row) => row.some((value) => value.trim() !== ""));
}

function normalizeHeader(value: string) {
  return normalizeLookupText(value).replace(/\s+/g, "_");
}
