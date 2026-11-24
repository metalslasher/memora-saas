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
    return kinds;
  }

  return [];
}

/** Exercises the word does not have yet, for the "will unlock later" hint. */
export function lockedKinds(existing: CardKind[], lemma: string, content: WordContent): CardKind[] {
  const planned: CardKind[] = ["recognition", "recall"];
  if (clozeFor(lemma, content)) planned.push("cloze");
  if (canListen(lemma)) planned.push("listening");
  return planned.filter((kind) => !existing.includes(kind));
}
