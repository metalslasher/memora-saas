import { isSameLemma } from "./word-forms";

export type AnswerVerdict =
  /** Nothing was typed. */
  | "empty"
  /** An accepted answer after normalisation (case, punctuation, articles, "to"). */
  | "exact"
  /** The right word in another form ("look" where "looking" was needed). */
  | "form"
  /** A synonym: right meaning, but not the word being learned. */
  | "synonym"
  /** A small typo away from an accepted answer. */
  | "close"
  /** Long free-form answer: overlap is shown, the learner judges. */
  | "self"
  /** Clearly a different answer. */
  | "different";

export type DiffPart = { text: string; ok: boolean };

export type AnswerCheck = {
  verdict: AnswerVerdict;
  /** 0..1 similarity to the closest accepted answer. */
  similarity: number;
  /** The accepted answer closest to what was typed (normalised). */
  closest: string | null;
  /** Character diff for typos and wrong forms; null when not useful. */
  diff: { typed: DiffPart[]; expected: DiffPart[] } | null;
};

export type AnswerSpec = {
  /** Expected answers; "a, b / c" style strings are split into alternatives. */
  answers: string[];
  /** Other spellings or forms that count as fully correct. */
  accepted?: string[];
  /** Words with the same meaning: correct, but not the target word. */
  synonyms?: string[];
  /** English lemma for word-form matching. */
  lemma?: string;
  /**
   * Cloze: the sentence needs one particular form, so another form of the
   * lemma is "form", not "exact". Otherwise any form of the lemma is exact.
   */
  strictForm?: boolean;
};

const LONG_ANSWER_WORDS = 6;

export function checkAnswer(response: string, spec: AnswerSpec): AnswerCheck {
  const typed = normalizeAnswer(response);
  const none = { similarity: 0, closest: null, diff: null };
  if (!typed) return { verdict: "empty", ...none };

  const correct = unique([...spec.answers, ...(spec.accepted ?? [])].flatMap(acceptedAnswers));
  if (correct.length === 0) return { verdict: "self", ...none };

  if (correct.includes(typed)) {
    return { verdict: "exact", similarity: 1, closest: typed, diff: null };
  }

  const { best, closest } = closestAnswer(typed, correct);
  const lemma = spec.lemma ? normalizeAnswer(spec.lemma) : "";
  const isForm =
    (lemma !== "" && isSameLemma(typed, lemma)) || correct.some((answer) => isSameLemma(typed, answer));
  if (isForm) {
    return spec.strictForm
      ? { verdict: "form", similarity: best, closest, diff: diffAnswer(typed, closest) }
      : { verdict: "exact", similarity: 1, closest, diff: null };
  }

  const synonyms = unique((spec.synonyms ?? []).flatMap(acceptedAnswers));
  if (synonyms.some((synonym) => synonym === typed || isSameLemma(typed, synonym))) {
    return { verdict: "synonym", similarity: best, closest, diff: null };
  }

  const longest = Math.max(...correct.map(wordCount));
  if (longest > LONG_ANSWER_WORDS) {
    const overlap = Math.max(...correct.map((item) => tokenOverlap(typed, item)));
    return { verdict: "self", similarity: Math.max(best, overlap), closest, diff: null };
  }

  const shortest = Math.min(...correct.map((item) => item.length));
  const threshold = shortest <= 4 ? 0.75 : 0.8;
  const verdict = best >= threshold ? "close" : "different";
  return { verdict, similarity: best, closest, diff: diffAnswer(typed, closest) };
}

/** Splits "a, b / c; d" style answers into normalised alternatives. */
export function acceptedAnswers(answer: string) {
  const normalizedFull = normalizeAnswer(answer);
  const parts = answer
    .split(/[;,/|]|\s+or\s+|\s+або\s+/i)
    .map(normalizeAnswer)
    .filter(Boolean);

  return unique([normalizedFull, ...parts].filter(Boolean));
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

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function closestAnswer(typed: string, answers: string[]) {
  let best = -1;
  let closest = answers[0];
  for (const answer of answers) {
    const score = similarity(typed, answer);
    if (score > best) {
      best = score;
      closest = answer;
    }
  }
  return { best: Math.max(0, best), closest };
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

function levenshteinTable(left: string, right: string) {
  const table = Array.from({ length: left.length + 1 }, (_, i) =>
    Array.from({ length: right.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      table[i][j] = Math.min(table[i - 1][j] + 1, table[i][j - 1] + 1, table[i - 1][j - 1] + cost);
    }
  }
  return table;
}

export function levenshtein(left: string, right: string) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  return levenshteinTable(left, right)[left.length][right.length];
}

/**
 * Character diff between what was typed and the expected answer: letters
 * that match are `ok`, the rest are marked on both sides (extra or wrong
 * letters in the typed text, missing or different letters in the answer).
 * Skipped for very different strings, where highlighting is just noise.
 */
export function diffAnswer(typed: string, expected: string): AnswerCheck["diff"] {
  if (!typed || !expected || typed.length > 80 || expected.length > 80) return null;
  if (similarity(typed, expected) < 0.4) return null;

  const table = levenshteinTable(typed, expected);
  const typedMarks: boolean[] = [];
  const expectedMarks: boolean[] = [];
  let i = typed.length;
  let j = expected.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && typed[i - 1] === expected[j - 1] && table[i][j] === table[i - 1][j - 1]) {
      typedMarks[i - 1] = true;
      expectedMarks[j - 1] = true;
      i -= 1;
      j -= 1;
    } else if (i > 0 && j > 0 && table[i][j] === table[i - 1][j - 1] + 1) {
      typedMarks[i - 1] = false;
      expectedMarks[j - 1] = false;
      i -= 1;
      j -= 1;
    } else if (i > 0 && table[i][j] === table[i - 1][j] + 1) {
      typedMarks[i - 1] = false;
      i -= 1;
    } else {
      expectedMarks[j - 1] = false;
      j -= 1;
    }
  }

  return { typed: groupParts(typed, typedMarks), expected: groupParts(expected, expectedMarks) };
}

function groupParts(text: string, marks: boolean[]): DiffPart[] {
  const parts: DiffPart[] = [];
  for (let index = 0; index < text.length; index += 1) {
    const ok = marks[index] ?? false;
    const last = parts.at(-1);
    if (last && last.ok === ok) last.text += text[index];
    else parts.push({ text: text[index], ok });
  }
  return parts;
}
