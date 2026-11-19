import type { AnswerVerdict } from "./answer-check";
import type { FsrsState, ReviewRating } from "./types";

/**
 * Automatic rating of a typed answer.
 *
 *   wrong                         → Again
 *   typo / wrong form / synonym   → Hard   (recalled, but not cleanly)
 *   exact                         → Good
 *   exact and fast                → Easy   (only for cards already in Review)
 *
 * Why so conservative with Easy: in FSRS an Easy rating multiplies the next
 * interval and lowers difficulty for good, so unearned Easy ratings push
 * cards too far out and they come back forgotten. Easy therefore needs a
 * quick answer by a tight time budget that grows with the answer length,
 * and is never given to new or learning cards (it would skip the learning
 * steps). Silent answers (nothing typed) and long free-form answers are not
 * auto-rated: the learner picks "Не згадав" or "Згадав".
 */
export type AutoGradeInput = {
  verdict: AnswerVerdict;
  /** Time from showing the card to submitting, in ms. */
  elapsedMs: number;
  /** The expected answer, to scale the time budget. */
  answer: string;
  state: FsrsState;
};

/** Base reaction time plus a per-letter typing budget (phone keyboards). */
export const EASY_BASE_MS = 2500;
export const EASY_MS_PER_CHAR = 200;

export function easyTimeLimitMs(answer: string) {
  const letters = answer.replace(/\s+/g, "").length;
  return EASY_BASE_MS + EASY_MS_PER_CHAR * Math.min(letters, 40);
}

/** Returns null when the learner should rate the answer themselves. */
export function autoGrade({ verdict, elapsedMs, answer, state }: AutoGradeInput): ReviewRating | null {
  switch (verdict) {
    case "different":
      return "again";
    case "close":
    case "form":
    case "synonym":
      return "hard";
    case "exact":
      return state === "Review" && elapsedMs <= easyTimeLimitMs(answer) ? "easy" : "good";
    default:
      return null;
  }
}

export const ratingLabels: Record<ReviewRating, string> = {
  again: "Не згадав",
  hard: "Важко",
  good: "Добре",
  easy: "Легко",
};
