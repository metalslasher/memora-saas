import {
  normalizeEnglishDraft,
  normalizeQaDraft,
  type EnglishDraft,
  type QaDraft,
} from "./card-generator";
import {
  findDuplicateNotes,
  normalizeLookupText,
  type DuplicateNoteMatch,
} from "./duplicates";
import type { ModuleType, Note } from "./types";

export type CsvImportDraft = EnglishDraft | QaDraft;

export type CsvImportRow = {
  rowNumber: number;
  status: "ready" | "duplicate" | "invalid";
  draft?: CsvImportDraft;
  errors: string[];
  duplicateMatches: DuplicateNoteMatch[];
  raw: Record<string, string>;
};

export type CsvImportPreview = {
  module: ModuleType;
  headers: string[];
  rows: CsvImportRow[];
  summary: {
    total: number;
    ready: number;
    duplicates: number;
    invalid: number;
  };
};

const englishHeaderAliases: Record<string, keyof EnglishDraft> = {
  lemma: "lemma",
  lemma_en: "lemma",
  word: "lemma",
  phrase: "lemma",
  english: "lemma",
  english_word: "lemma",
  english_phrase: "lemma",
  term: "lemma",
  слово: "lemma",
  фраза: "lemma",
  англійське_слово: "lemma",
  translation: "translation",
  translation_uk: "translation",
  meaning: "translation",
  ukrainian: "translation",
  ukrainian_meaning: "translation",
  значення: "translation",
  переклад: "translation",
  українське_значення: "translation",
  example: "example",
  example_en: "example",
  sentence: "example",
  приклад: "example",
};

const qaHeaderAliases: Record<string, keyof QaDraft> = {
  term: "term",
  qa_term: "term",
  concept: "term",
  поняття: "term",
  термін: "term",
  qa_термін: "term",
  definition: "definition",
  short_definition: "definition",
  explanation: "definition",
  meaning: "definition",
  пояснення: "definition",
  визначення: "definition",
  example: "example",
  приклад: "example",
};

export function parseCsvImport(
  text: string,
  module: ModuleType,
  existingNotes: Note[],
): CsvImportPreview {
  const normalizedText = text.replace(/^\uFEFF/, "").trim();
  if (!normalizedText) {
    return emptyPreview(module, ["CSV файл порожній."]);
  }

  const { delimiter, records } = parseWithDetectedDelimiter(normalizedText);
  void delimiter;

  if (records.length < 2) {
    return emptyPreview(module, ["CSV має містити рядок заголовків і хоча б один рядок даних."]);
  }

  const headers = records[0].map((header) => header.trim());
  const mappedHeaders = mapHeaders(headers, module);
  const missingHeaders = requiredFields(module).filter(
    (field) => !mappedHeaders.includes(field),
  );
  if (missingHeaders.length > 0) {
    const readable = missingHeaders
      .map((field) => labelField(module, field))
      .join(", ");

    return emptyPreview(module, [`Не вистачає колонок: ${readable}.`], headers);
  }

  const seenKeys = new Set<string>();
  const rows = records.slice(1).flatMap((record, index) => {
    const rowNumber = index + 2;
    if (record.every((cell) => cell.trim() === "")) return [];

    const raw = Object.fromEntries(
      headers.map((header, cellIndex) => [header, record[cellIndex]?.trim() ?? ""]),
    );
    const draft = draftFromRecord(record, mappedHeaders, module);
    const normalized =
      module === "english"
        ? normalizeEnglishDraft(draft as EnglishDraft)
        : normalizeQaDraft(draft as QaDraft);
    const errors = validateDraft(module, normalized);
    const key = module === "english"
      ? normalizeLookupText((normalized as EnglishDraft).lemma)
      : normalizeLookupText((normalized as QaDraft).term);
    const duplicateMatches =
      errors.length === 0
        ? findDuplicateNotes(existingNotes, duplicateCandidate(module, normalized), 3)
        : [];

    if (key && seenKeys.has(key)) {
      duplicateMatches.push({
        note: {
          id: `csv-row-${rowNumber}`,
          module,
          title: "інший рядок у цьому CSV",
          status: "active",
          source: "imported",
          tags: [module, "csv"],
          content: {},
          createdAt: new Date(0).toISOString(),
        },
        confidence: "exact",
        matchedOn: "CSV row",
      });
    }
    if (key) seenKeys.add(key);

    return [{
      rowNumber,
      status:
        errors.length > 0
          ? "invalid"
          : duplicateMatches.length > 0
            ? "duplicate"
            : "ready",
      draft: errors.length > 0 ? undefined : normalized,
      errors,
      duplicateMatches,
      raw,
    } satisfies CsvImportRow];
  });

  return {
    module,
    headers,
    rows,
    summary: summarizeRows(rows),
  };
}

export function csvTemplate(module: ModuleType) {
  if (module === "english") {
    return [
      "lemma_en,translation_uk,example_en",
      "flaky test,нестабільний тест,This flaky test fails only in CI.",
      "edge case,крайній випадок,This edge case breaks validation.",
    ].join("\n");
  }

  return [
    "term,short_definition,example",
    "Smoke testing,Швидка перевірка що критичні функції досі працюють,Після деплою запусти smoke tests.",
    "Regression testing,Перевірка що старий функціонал не зламався після змін,Після фікса checkout перевір payment і cart сценарії.",
  ].join("\n");
}

function emptyPreview(
  module: ModuleType,
  errors: string[],
  headers: string[] = [],
): CsvImportPreview {
  return {
    module,
    headers,
    rows: [{
      rowNumber: 1,
      status: "invalid",
      errors,
      duplicateMatches: [],
      raw: {},
    }],
    summary: {
      total: 1,
      ready: 0,
      duplicates: 0,
      invalid: 1,
    },
  };
}

function parseWithDetectedDelimiter(text: string) {
  const candidates = [",", ";", "\t"];
  const parsed = candidates.map((delimiter) => ({
    delimiter,
    records: parseCsvRecords(text, delimiter),
  }));

  return parsed
    .filter((item) => item.records.length > 0)
    .sort((a, b) => b.records[0].length - a.records[0].length)[0];
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
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (!quoted && char === delimiter) {
      record.push(cell);
      cell = "";
      continue;
    }

    if (!quoted && (char === "\n" || char === "\r")) {
      record.push(cell);
      records.push(record);
      record = [];
      cell = "";
      if (char === "\r" && next === "\n") index += 1;
      continue;
    }

    cell += char;
  }

  record.push(cell);
  records.push(record);

  return records.filter((row) => row.some((value) => value.trim() !== ""));
}

function mapHeaders(headers: string[], module: ModuleType) {
  const aliases = module === "english" ? englishHeaderAliases : qaHeaderAliases;

  return headers.map((header) => {
    const normalized = normalizeHeader(header);
    return aliases[normalized] ?? null;
  });
}

function draftFromRecord(
  record: string[],
  mappedHeaders: Array<keyof EnglishDraft | keyof QaDraft | null>,
  module: ModuleType,
): CsvImportDraft {
  if (module === "english") {
    const draft: EnglishDraft = { lemma: "", translation: "", example: "" };
    mappedHeaders.forEach((field, index) => {
      if (field && field in draft) draft[field as keyof EnglishDraft] = record[index] ?? "";
    });
    return draft;
  }

  const draft: QaDraft = { term: "", definition: "", example: "" };
  mappedHeaders.forEach((field, index) => {
    if (field && field in draft) draft[field as keyof QaDraft] = record[index] ?? "";
  });
  return draft;
}

function validateDraft(module: ModuleType, draft: CsvImportDraft) {
  if (module === "english") {
    const english = draft as EnglishDraft;
    return [
      english.lemma ? null : "Немає англійського слова або фрази.",
      english.translation ? null : "Немає українського значення.",
    ].filter(Boolean) as string[];
  }

  const qa = draft as QaDraft;
  return [
    qa.term ? null : "Немає QA терміна.",
    qa.definition ? null : "Немає українського пояснення.",
  ].filter(Boolean) as string[];
}

function duplicateCandidate(module: ModuleType, draft: CsvImportDraft) {
  return module === "english"
    ? {
        module,
        lemma: (draft as EnglishDraft).lemma,
        translation: (draft as EnglishDraft).translation,
      }
    : {
        module,
        term: (draft as QaDraft).term,
        definition: (draft as QaDraft).definition,
      };
}

function requiredFields(module: ModuleType) {
  return module === "english"
    ? (["lemma", "translation"] satisfies Array<keyof EnglishDraft>)
    : (["term", "definition"] satisfies Array<keyof QaDraft>);
}

function labelField(module: ModuleType, field: keyof EnglishDraft | keyof QaDraft) {
  const labels =
    module === "english"
      ? {
          lemma: "англійське слово або фраза",
          translation: "українське значення",
          example: "приклад",
        }
      : {
          term: "QA термін",
          definition: "українське пояснення",
          example: "приклад",
        };

  return labels[field as keyof typeof labels];
}

function summarizeRows(rows: CsvImportRow[]) {
  return {
    total: rows.length,
    ready: rows.filter((row) => row.status === "ready").length,
    duplicates: rows.filter((row) => row.status === "duplicate").length,
    invalid: rows.filter((row) => row.status === "invalid").length,
  };
}

function normalizeHeader(value: string) {
  return normalizeLookupText(value).replace(/\s+/g, "_");
}
