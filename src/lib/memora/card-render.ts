import type { AnswerSpec } from "./answer-check";
import { findCloze, type ClozeMatch } from "./cloze";
import type { CardKind, WordContent, WordExample } from "./types";
import { translationText } from "./word-content";

export type CardLanguage = "en" | "uk";

/**
 * What the learner sees for one card. Prompts are not stored per card: they
 * are derived here from the word content and the card kind, so editing a
 * word updates all of its cards at once.
 */
export type RenderedCard = {
  /** The exercise actually shown (a cloze without a sentence falls back to recall). */
  kind: CardKind;
  /** Short instruction above the cue. */
  instruction: string;
  /** The main text to react to; empty for listening (the cue is audio). */
  cue: string;
  cueLanguage: CardLanguage;
  /** Extra context shown with the question (example, sentence with a gap…). */
  context: { text: string; language: CardLanguage } | null;
  /** Small grammar hint shown with the question. */
  hint: string | null;
  /** Text to pronounce: the cue for listening, the word for recognition. */
  audio: string | null;
  /** Expected answer (comma-separated alternatives are all accepted). */
  answer: string;
  answerLanguage: CardLanguage;
  /** How a typed answer is checked. */
  check: AnswerSpec;
  /**
   * Recognition answers are free Ukrainian translations: a typed answer is
   * compared for a hint, but the learner always rates it.
   */
  selfGraded: boolean;
  /** Shown only after the answer is revealed. */
  example: WordExample | null;
  /** Ukrainian meaning, shown after the answer for English-answer cards. */
  meaning: string | null;
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

/** Order of exercises on a word, from passive to active. */
export const exerciseOrder: CardKind[] = ["recognition", "recall", "cloze", "listening", "sentence", "speaking"];

/** Phrases longer than this are not dictated in the listening exercise. */
const MAX_LISTENING_WORDS = 4;

export function canListen(lemma: string) {
  const words = lemma.trim().split(/\s+/).filter(Boolean);
  return words.length > 0 && words.length <= MAX_LISTENING_WORDS && lemma.length <= 40;
}

/**
 * The gapped sentence for a word: an enriched cloze sentence if the content
 * has one, otherwise the first example that contains the word.
 */
export function clozeFor(lemma: string, content: WordContent): (ClozeMatch & { example: WordExample | null }) | null {
  const stored = content.cloze?.find((item) => item.text.includes("_"));
  if (stored) return { text: stored.text, answer: stored.answer, example: null };

  for (const example of content.examples) {
    const match = findCloze(lemma, example.en);
    if (match) return { ...match, example };
  }
  return null;
}

export function renderCard(kind: CardKind, lemma: string, content: WordContent): RenderedCard {
  const translations = translationText(content);
  const example = content.examples[0] ?? null;
  const partOfSpeech = content.part_of_speech ?? null;
  const englishCheck: AnswerSpec = {
    answers: [lemma],
    accepted: content.accepted,
    synonyms: content.synonyms,
    lemma,
  };

  if (kind === "recognition") {
    return {
      kind,
      instruction: "Що це означає?",
      cue: lemma,
      cueLanguage: "en",
      context: example ? { text: example.en, language: "en" } : null,
      hint: null,
      audio: lemma,
      answer: translations,
      answerLanguage: "uk",
      check: { answers: content.translations },
      selfGraded: true,
      example,
      meaning: null,
      partOfSpeech,
    };
  }

  const cloze = kind === "cloze" || kind === "recall" ? clozeFor(lemma, content) : null;

  if (kind === "cloze" && cloze) {
    const shownExample = cloze.example ?? example;
    return {
      kind,
      instruction: "Встав пропущене слово",
      cue: cloze.text,
      cueLanguage: "en",
      context: cloze.example?.uk ? { text: cloze.example.uk, language: "uk" } : null,
      hint: partOfSpeech,
      audio: null,
      answer: cloze.answer,
      answerLanguage: "en",
      check: { ...englishCheck, answers: [cloze.answer], strictForm: true },
      selfGraded: false,
      example: shownExample,
      meaning: translations,
      partOfSpeech,
    };
  }

  if (kind === "listening") {
    return {
      kind,
      instruction: "Напиши, що почуєш",
      cue: "",
      cueLanguage: "en",
      context: null,
      hint: null,
      audio: lemma,
      answer: lemma,
      answerLanguage: "en",
      check: { ...englishCheck, synonyms: undefined },
      selfGraded: false,
      example,
      meaning: translations,
      partOfSpeech,
    };
  }

  // Production: the word is given, the learner writes or says a sentence with
  // it (the practice shows these with their own card, production-card.tsx).
  if (kind === "sentence" || kind === "speaking") {
    return {
      kind,
      instruction: kind === "sentence" ? "Напиши своє речення з цим словом" : "Скажи вголос речення з цим словом",
      cue: lemma,
      cueLanguage: "en",
      context: translations ? { text: translations, language: "uk" } : null,
      hint: partOfSpeech,
      audio: lemma,
      answer: lemma,
      answerLanguage: "en",
      check: englishCheck,
      selfGraded: false,
      example,
      meaning: translations,
      partOfSpeech,
    };
  }

  // "recall" — and the fallback for a cloze card whose word lost its example.
  return {
    kind: "recall",
    instruction: "Як це англійською?",
    cue: translations,
    cueLanguage: "uk",
    context: cloze ? { text: cloze.text, language: "en" } : null,
    hint: partOfSpeech,
    audio: null,
    answer: lemma,
    answerLanguage: "en",
    check: englishCheck,
    selfGraded: false,
    example: cloze?.example ?? example,
    meaning: null,
    partOfSpeech,
  };
}
