import type { CardKind, WordContent, WordExample } from "./types";
import { translationText } from "./word-content";

export type CardLanguage = "en" | "uk";

/**
 * What the learner sees for one card. Prompts are not stored per card: they
 * are derived here from the word content and the card kind, so editing a
 * word updates all of its cards at once.
 */
export type RenderedCard = {
  /** Short instruction above the cue. */
  instruction: string;
  /** The main text to react to. */
  cue: string;
  cueLanguage: CardLanguage;
  /** Expected answer (comma-separated alternatives are all accepted). */
  answer: string;
  answerLanguage: CardLanguage;
  /** Shown only after the answer is revealed. */
  example: WordExample | null;
  partOfSpeech: string | null;
};

export const cardKindLabels: Record<CardKind, string> = {
  recognition: "впізнати",
  recall: "згадати",
  cloze: "пропуск у реченні",
  listening: "на слух",
  sentence: "своє речення",
  speaking: "вголос",
};

export function renderCard(kind: CardKind, lemma: string, content: WordContent): RenderedCard {
  const translations = translationText(content);
  const base = {
    example: content.examples[0] ?? null,
    partOfSpeech: content.part_of_speech ?? null,
  };

  if (kind === "recognition") {
    return {
      ...base,
      instruction: "Що це означає?",
      cue: lemma,
      cueLanguage: "en",
      answer: translations,
      answerLanguage: "uk",
    };
  }

  // "recall" — and, until batch 2 adds dedicated exercises, any other kind.
  return {
    ...base,
    instruction: "Як сказати англійською?",
    cue: translations,
    cueLanguage: "uk",
    answer: lemma,
    answerLanguage: "en",
  };
}

/** The two directions every manually added word is trained in. */
export const defaultCardKinds: CardKind[] = ["recognition", "recall"];
