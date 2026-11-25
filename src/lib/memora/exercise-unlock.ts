import { canListen, clozeFor } from "./card-render";
import type { CardKind, ReviewRating, StoredSchedule, WordContent } from "./types";

/**
 * Gradual unlocking of exercises on one word, from passive to active:
 *
 * 1. A new word starts with `recognition` only (en→uk).
 * 2. `recall` (uk→en) opens once recognition is first passed with an
 *    interval of at least one day — the word has left the learning steps.
 * 3. `cloze` and `listening` open once `recall` reaches the Review state.
 *    Cloze needs an example sentence that contains the word; listening is
 *    skipped for long phrases.
 * 4. `sentence` (own sentence, AI feedback) opens once `recall` is passed in
 *    Review with an interval of a week or more: the word is recalled reliably,
 *    so producing it is the next step (pushed output) and not a guess.
 * 5. `speaking` opens once `sentence` is passed in Review — writing first,
 *    then the harder real-time version. Both cost an AI call per review, so
 *    they come only for mature words; the 7-day threshold is a heuristic.
 *
 * Cards are created lazily (inserted into `cards` when unlocked), so a new
 * word costs one card until the learner actually knows it passively.
 * Checked after every review, so a cloze also appears later if the word
 * gets an example sentence.
 */
export const startingKinds: CardKind[] = ["recognition"];
/**
 * Program words the vocabulary test credited as passively known skip step 1
 * and start with recall; cloze/listening follow by the same rule (step 3).
 */
export const knownWordKinds: CardKind[] = ["recall"];

/** Recall interval (days) after which the word gets the own-sentence exercise. */
export const SENTENCE_UNLOCK_DAYS = 7;

export function kindsToUnlock(input: {
  kind: CardKind;
  rating: ReviewRating;
  after: StoredSchedule;
  lemma: string;
  content: WordContent;
}): CardKind[] {
  const { kind, rating, after, lemma, content } = input;
  if (rating === "again") return [];

  if (kind === "recognition") {
    return after.state === "Review" && after.scheduled_days >= 1 ? ["recall"] : [];
  }

  if (kind === "recall" && after.state === "Review") {
    const kinds: CardKind[] = [];
    if (clozeFor(lemma, content)) kinds.push("cloze");
    if (canListen(lemma)) kinds.push("listening");
    if (after.scheduled_days >= SENTENCE_UNLOCK_DAYS) kinds.push("sentence");
    return kinds;
  }

  if (kind === "sentence" && after.state === "Review") return ["speaking"];

  return [];
}

/**
 * Exercises the word does not have yet, for the "will unlock later" hint.
 * `production` adds the AI exercises (`speaking` only when it is switched on).
 */
export function lockedKinds(
  existing: CardKind[],
  lemma: string,
  content: WordContent,
  production: { sentence: boolean; speaking: boolean } = { sentence: false, speaking: false },
): CardKind[] {
  const planned: CardKind[] = ["recognition", "recall"];
  if (clozeFor(lemma, content)) planned.push("cloze");
  if (canListen(lemma)) planned.push("listening");
  if (production.sentence) planned.push("sentence");
  if (production.speaking) planned.push("speaking");
  return planned.filter((kind) => !existing.includes(kind));
}
