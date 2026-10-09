import type { ReviewRating } from "./types";

export type AnswerVerdict =
  /** Nothing was typed. */
  | "empty"
  /** Same answer after normalisation (case, punctuation, articles). */
  | "exact"
  /** A small typo away from one of the accepted answers. */
  | "close"
  /** Long free-form answer: overlap is shown, the learner judges. */
  | "self"
  /** Clearly a different answer. */
  | "different";

export type AnswerCheck = {
  verdict: AnswerVerdict;
  /** 0..1 similarity to the best matching accepted answer. */
  similarity: number;
  suggestedRating: ReviewRating | null;
};

const LONG_ANSWER_WORDS = 6;

export function checkAnswer(response: string, answer: string): AnswerCheck {
  const typed = normalizeAnswer(response);
  if (!typed) return { verdict: "empty", similarity: 0, suggestedRating: null };

  const accepted = acceptedAnswers(answer);
  if (accepted.length === 0) {
    return { verdict: "self", similarity: 0, suggestedRating: null };
  }

  let best = 0;
  for (const candidate of accepted) {
    if (candidate === typed) {
      return { verdict: "exact", similarity: 1, suggestedRating: "good" };
    }
    best = Math.max(best, similarity(typed, candidate));
  }

  const longest = Math.max(...accepted.map(wordCount));
  if (longest > LONG_ANSWER_WORDS) {
    const overlap = Math.max(...accepted.map((item) => tokenOverlap(typed, item)));
    return {
      verdict: "self",
      similarity: Math.max(best, overlap),
      suggestedRating: null,
    };
  }

  const shortest = Math.min(...accepted.map((item) => item.length));
  const threshold = shortest <= 4 ? 0.75 : 0.8;
  if (best >= threshold) {
    return { verdict: "close", similarity: best, suggestedRating: "good" };
  }

  return { verdict: "different", similarity: best, suggestedRating: "again" };
}

/** Splits "a, b / c; d" style answers into normalised alternatives. */
export function acceptedAnswers(answer: string) {
  const normalizedFull = normalizeAnswer(answer);
  const parts = answer
    .split(/[;,/|]|\s+or\s+|\s+або\s+/i)
    .map(normalizeAnswer)
    .filter(Boolean);

  return Array.from(new Set([normalizedFull, ...parts].filter(Boolean)));
}

export function normalizeAnswer(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[’ʼ`´]/g, "'")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^\p{L}\p{N}'\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(to|a|an|the)\s+/, "");
}

function wordCount(value: string) {
  return value.split(" ").filter(Boolean).length;
}

function similarity(left: string, right: string) {
  const longest = Math.max(left.length, right.length);
  if (longest === 0) return 1;
  return 1 - levenshtein(left, right) / longest;
}

function tokenOverlap(typed: string, answer: string) {
  const answerTokens = new Set(answer.split(" ").filter((token) => token.length > 2));
  if (answerTokens.size === 0) return 0;
  const typedTokens = new Set(typed.split(" "));
  let hits = 0;
  for (const token of answerTokens) {
    if (typedTokens.has(token)) hits += 1;
  }
  return hits / answerTokens.size;
}

export function levenshtein(left: string, right: string) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost,
      );
    }
    previous = current;
  }

  return previous[right.length];
}
