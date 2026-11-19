import type { Json } from "@/lib/supabase/database.types";
import type { WordContent, WordDraft, WordExample } from "./types";

const MAX_LEMMA = 200;
const MAX_TEXT = 1000;
const MAX_LIST = 20;

export function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

/** "a, b; c" → ["a", "b", "c"], trimmed, de-duplicated, empty parts dropped. */
export function splitTranslations(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[,;]/)
        .map(cleanText)
        .filter(Boolean),
    ),
  ).slice(0, MAX_LIST);
}

/**
 * A cleaned draft. `accepted` / `synonyms` stay undefined when the form did
 * not have them (short add form, CSV), so stored lists are kept.
 */
export type NormalizedWordDraft = Required<Omit<WordDraft, "accepted" | "synonyms">> &
  Pick<WordDraft, "accepted" | "synonyms">;

export function normalizeWordDraft(draft: WordDraft): NormalizedWordDraft {
  const normalized: NormalizedWordDraft = {
    lemma: cleanText(draft.lemma),
    translation: cleanText(draft.translation),
    partOfSpeech: cleanText(draft.partOfSpeech ?? ""),
    example: cleanText(draft.example ?? ""),
  };
  if (draft.accepted !== undefined) normalized.accepted = cleanText(draft.accepted);
  if (draft.synonyms !== undefined) normalized.synonyms = cleanText(draft.synonyms);
  return normalized;
}

/** Returns Ukrainian error messages; empty when the draft is valid. */
export function wordDraftErrors(draft: WordDraft) {
  const normalized = normalizeWordDraft(draft);
  const errors: string[] = [];
  if (!normalized.lemma) errors.push("Немає англійського слова або фрази.");
  if (normalized.lemma.length > MAX_LEMMA) errors.push("Слово чи фраза задовгі (до 200 символів).");
  if (splitTranslations(normalized.translation).length === 0) {
    errors.push("Немає українського перекладу.");
  }
  if (normalized.example.length > MAX_TEXT) errors.push("Приклад задовгий (до 1000 символів).");
  if (normalized.partOfSpeech.length > 40) errors.push("Частина мови задовга.");
  if ((normalized.accepted ?? "").length > MAX_TEXT || (normalized.synonyms ?? "").length > MAX_TEXT) {
    errors.push("Список варіантів задовгий (до 1000 символів).");
  }
  return errors;
}

export function validateWordDraft(draft: WordDraft): NormalizedWordDraft {
  const errors = wordDraftErrors(draft);
  if (errors.length > 0) throw new Error(errors[0]);
  return normalizeWordDraft(draft);
}

/**
 * Applies a manual draft on top of existing content. Fields the form does not
 * edit (IPA, collocations, cloze sentences…) are preserved.
 */
export function contentFromDraft(
  draft: WordDraft,
  base: WordContent = { translations: [], examples: [] },
): WordContent {
  const normalized = normalizeWordDraft(draft);
  const previousFirst = base.examples[0];
  const examples: WordExample[] = normalized.example
    ? [
        previousFirst && previousFirst.en === normalized.example
          ? previousFirst
          : { en: normalized.example },
        ...base.examples.slice(1),
      ]
    : base.examples.slice(1);

  const next: WordContent = {
    ...base,
    translations: splitTranslations(normalized.translation),
    examples,
  };
  if (normalized.partOfSpeech) next.part_of_speech = normalized.partOfSpeech;
  else delete next.part_of_speech;
  // Absent from a draft (CSV rows, the short add form) = keep what is stored.
  for (const key of ["accepted", "synonyms"] as const) {
    const value = normalized[key];
    if (value === undefined) continue;
    const list = splitTranslations(value);
    if (list.length > 0) next[key] = list;
    else delete next[key];
  }
  return next;
}

export function draftFromContent(lemma: string, content: WordContent): Required<WordDraft> {
  return {
    lemma,
    translation: content.translations.join(", "),
    partOfSpeech: content.part_of_speech ?? "",
    example: content.examples[0]?.en ?? "",
    accepted: (content.accepted ?? []).join(", "),
    synonyms: (content.synonyms ?? []).join(", "),
  };
}

export function translationText(content: WordContent) {
  return content.translations.join(", ");
}

/** Reads untrusted JSON from the database into a well-formed WordContent. */
export function readWordContent(value: Json | unknown): WordContent {
  const record = isRecord(value) ? value : {};
  const content: WordContent = {
    translations: readStringList(record.translations),
    examples: readExamples(record.examples),
  };

  const partOfSpeech = cleanText(record.part_of_speech);
  if (partOfSpeech) content.part_of_speech = partOfSpeech;
  const ipa = cleanText(record.ipa);
  if (ipa) content.ipa = ipa;

  for (const key of ["accepted", "collocations", "synonyms", "common_mistakes"] as const) {
    const list = readStringList(record[key]);
    if (list.length > 0) content[key] = list;
  }

  if (Array.isArray(record.cloze)) {
    const cloze = record.cloze
      .filter(isRecord)
      .map((item) => ({ text: cleanText(item.text), answer: cleanText(item.answer) }))
      .filter((item) => item.text && item.answer)
      .slice(0, MAX_LIST);
    if (cloze.length > 0) content.cloze = cloze;
  }

  return content;
}

function readStringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map(cleanText)
    .filter((item) => item.length > 0 && item.length <= MAX_TEXT)
    .slice(0, MAX_LIST);
}

function readExamples(value: unknown): WordExample[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((item) => {
      const example: WordExample = { en: cleanText(item.en).slice(0, MAX_TEXT) };
      const uk = cleanText(item.uk).slice(0, MAX_TEXT);
      if (uk) example.uk = uk;
      return example;
    })
    .filter((item) => item.en)
    .slice(0, MAX_LIST);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
