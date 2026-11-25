import type { CardKind, PracticeCard, ReviewRating } from "./types";
import { phraseForms } from "./word-forms";

/**
 * Production exercises ("pushed output"): the learner writes or says their
 * own sentence with a word they already know, and AI gives short feedback.
 * They are the only exercises that cost money per review, so they are dosed:
 * only mature words get them (exercise-unlock.ts) and a daily quota caps them.
 */
export const productionKinds = ["sentence", "speaking"] as const satisfies readonly CardKind[];
export type ProductionKind = (typeof productionKinds)[number];

export function isProductionKind(kind: CardKind): kind is ProductionKind {
  return kind === "sentence" || kind === "speaking";
}

export const MAX_SENTENCE_LENGTH = 300;
/** Recording limit of "Скажи вголос" (a sentence takes 3–8 s). */
export const MAX_RECORDING_SECONDS = 15;
/** Upload limit for one recording (32 kbps Opus × 15 s ≈ 60 KB; server actions take 1 MB). */
export const MAX_AUDIO_BYTES = 900_000;

/**
 * Daily quota per exercise kind (rolling 24 h, the same window as the rate
 * limits in the database). It scales with the minutes the learner chose, so
 * production stays about a third of the practice time (≈ 50 s per sentence):
 * 5–10 min → 2, 15 min → 3, 20 min → 4, 30 min → 6, never more than 10.
 * A heuristic — calibrate on real review times.
 */
export function dailyProductionQuota(dailyMinutes: number) {
  return Math.min(10, Math.max(2, Math.round(dailyMinutes / 5)));
}

export type ProductionAllowance = Record<ProductionKind, number>;

export const noProduction: ProductionAllowance = { sentence: 0, speaking: 0 };

/**
 * Keeps at most `allowance[kind]` production cards of each kind (the server
 * returns due cards in due order, so the most overdue stay). The rest wait
 * for another day: the queue then shows the word's other exercises.
 */
export function limitProductionCards(cards: PracticeCard[], allowance: ProductionAllowance) {
  const left = { ...allowance };
  return cards.filter((card) => {
    if (!isProductionKind(card.kind)) return true;
    if (left[card.kind] <= 0) return false;
    left[card.kind] -= 1;
    return true;
  });
}

/** Feedback on one sentence, as returned by the AI (ai/feedback.ts). */
export type SentenceFeedback = {
  /** good — no real mistakes; minor — the word is used right, other mistakes; wrong — the word is missing or misused. */
  verdict: "good" | "minor" | "wrong";
  mistakes: Array<{ wrong: string; right: string; why: string }>;
  /** The learner's sentence the way a native speaker would say it. */
  natural: string;
  /** Short Ukrainian comment. */
  comment: string;
};

/**
 * FSRS rating from the feedback, like the auto-grade of typed answers:
 * word missing or misused → Again, other mistakes → Hard, fine → Good.
 * Easy is never given automatically (a free sentence has no speed signal,
 * and an unearned Easy pushes the card too far out).
 */
export function ratingFromFeedback(feedback: Pick<SentenceFeedback, "verdict" | "mistakes">): ReviewRating {
  if (feedback.verdict === "wrong") return "again";
  if (feedback.verdict === "minor" || feedback.mistakes.length > 0) return "hard";
  return "good";
}

function normalizeWords(text: string) {
  return ` ${text
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

/**
 * Whether the transcript contains the target word in any form — the
 * transcription model only writes the word when it understood it, so this is
 * a rough proxy of pronunciation (an experiment, not a pronunciation score).
 */
export function heardWord(transcript: string, lemma: string, forms: string[] = []) {
  const text = normalizeWords(transcript);
  if (text.trim() === "") return false;
  const candidates = new Set([...phraseForms(lemma), ...forms.map((form) => form.toLowerCase())]);
  for (const candidate of candidates) {
    const clean = normalizeWords(candidate).trim();
    if (clean && text.includes(` ${clean} `)) return true;
  }
  return false;
}

/**
 * Ideas for the sentence, so the learner does not stare at an empty field.
 * Generic on purpose: they fit almost any word, and they are free (no AI call
 * to invent a situation per card).
 */
export const sentenceIdeas = [
  "про себе або свій день",
  "запитання до друга",
  "про роботу чи навчання",
  "про плани на вихідні",
  "порада комусь",
  "про те, що сталося вчора",
  "про людину, яку знаєш",
  "про місто, де живеш",
  "про те, що тебе дратує",
  "про улюблену їжу чи місце",
] as const;

function hash(text: string) {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

/** A different idea on every review of the card, stable while it is on screen. */
export function sentenceIdea(cardId: string, reps: number) {
  return sentenceIdeas[hash(`${cardId}:${reps}`) % sentenceIdeas.length];
}
