import type { CardType, ModuleType } from "./types";

export type EnglishDraft = {
  lemma: string;
  translation: string;
  partOfSpeech?: string;
  example: string;
};

export type QaDraft = {
  term: string;
  definition: string;
  example: string;
};

export type GeneratedCardTemplate = {
  module: ModuleType;
  type: CardType;
  priority: number;
  prompt: string;
  answer: string;
  explanation: string;
  example?: string;
  tags: string[];
};

export function normalizeEnglishDraft(draft: EnglishDraft): EnglishDraft {
  return {
    lemma: cleanText(draft.lemma),
    translation: cleanText(draft.translation),
    partOfSpeech: cleanText(draft.partOfSpeech ?? ""),
    example: cleanText(draft.example),
  };
}

export function normalizeQaDraft(draft: QaDraft): QaDraft {
  return {
    term: cleanText(draft.term),
    definition: cleanText(draft.definition),
    example: cleanText(draft.example),
  };
}

export function englishContentFromDraft(draft: EnglishDraft) {
  const normalized = normalizeEnglishDraft(draft);

  return {
    lemma_en: normalized.lemma,
    translation_uk: normalized.translation,
    part_of_speech: normalized.partOfSpeech || "phrase",
    example_en: normalized.example,
  };
}

export function qaContentFromDraft(draft: QaDraft) {
  const normalized = normalizeQaDraft(draft);

  return {
    term: normalized.term,
    short_definition: normalized.definition,
    example: normalized.example,
  };
}

export function generateEnglishCards(
  draft: EnglishDraft,
): GeneratedCardTemplate[] {
  const normalized = normalizeEnglishDraft(draft);
  const baseTags = ["english", "user"];

  if (!normalized.lemma || !normalized.translation) return [];

  return [
    {
      module: "english",
      type: "productive_translation",
      priority: 80,
      prompt: `Як сказати англійською: ${normalized.translation}?`,
      answer: normalized.lemma,
      explanation:
        "Активне пригадування: спочатку українське значення, потім англійське слово або фраза.",
      example: normalized.example,
      tags: baseTags,
    },
    {
      module: "english",
      type: "receptive_translation",
      priority: 60,
      prompt: `Що українською означає "${normalized.lemma}"?`,
      answer: normalized.translation,
      explanation:
        "Пасивне пригадування: перевіряємо, чи впізнаєш англійське слово і його українське значення.",
      example: normalized.example,
      tags: baseTags,
    },
  ];
}

export function generateQaCards(draft: QaDraft): GeneratedCardTemplate[] {
  const normalized = normalizeQaDraft(draft);
  const baseTags = ["qa", "user"];

  if (!normalized.term || !normalized.definition) return [];

  return [
    {
      module: "qa",
      type: "term_definition",
      priority: 80,
      prompt: `Поясни українською: що таке ${normalized.term}?`,
      answer: normalized.definition,
      explanation:
        "QA термін можна лишати англійською, але пояснення має бути зрозумілим українською.",
      example: normalized.example,
      tags: baseTags,
    },
    {
      module: "qa",
      type: "definition_term",
      priority: 65,
      prompt: `Який QA термін відповідає цьому поясненню: ${normalized.definition}`,
      answer: normalized.term,
      explanation:
        "Зворотне пригадування: за українським поясненням потрібно згадати професійний термін.",
      example: normalized.example,
      tags: baseTags,
    },
  ];
}

function cleanText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}
