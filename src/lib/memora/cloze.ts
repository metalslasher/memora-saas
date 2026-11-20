import { wordForms } from "./word-forms";

export type ClozeMatch = {
  /** Sentence with every matched word of the lemma replaced by "_____". */
  text: string;
  /** The matched words as they appear in the sentence ("looking forward to"). */
  answer: string;
};

export const CLOZE_BLANK = "_____";

const LEADING_PARTICLE = /^(to|a|an|the)\s+/i;
/** Separable phrasal verbs: "figure it out" — up to two words may sit between parts. */
const MAX_GAP_WORDS = 2;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function alternation(forms: Iterable<string>) {
  return [...forms]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|");
}

/**
 * Finds the word or phrase in an example sentence, allowing an inflected
 * first word (or last word for nouns) and a short gap inside separable
 * phrasal verbs. Returns null when the lemma is not in the sentence — then
 * no cloze card is built for this example.
 */
export function findCloze(lemma: string, sentence: string): ClozeMatch | null {
  const tokens = lemma.trim().replace(LEADING_PARTICLE, "").toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || !sentence.trim()) return null;
  if (tokens.some((token) => !/^[a-z][a-z'-]*$/.test(token))) return null;

  const attempts: string[][] = [tokens.map((token, index) => (index === 0 ? alternation(wordForms(token)) : escapeRegExp(token)))];
  if (tokens.length > 1) {
    attempts.push(
      tokens.map((token, index) =>
        index === tokens.length - 1 ? alternation(wordForms(token)) : escapeRegExp(token),
      ),
    );
  }

  const gap = `((?:\\s+[\\w'’-]+){0,${MAX_GAP_WORDS}}?)\\s+`;
  for (const parts of attempts) {
    const body = parts.map((part, index) => (index === 0 ? `(${part})` : `${gap}(${part})`)).join("");
    const pattern = new RegExp(`(^|[^\\p{L}'’-])${body}(?=$|[^\\p{L}'’-])`, "iu");
    const match = pattern.exec(sentence);
    if (!match) continue;

    // Groups: 1 = prefix char, then (word), [(gap), (word)]…
    // Adjacent words share one blank; words split by a gap get one each.
    const words: string[] = [];
    const pieces: string[] = [match[1]];
    let joinWithPrevious = false;
    for (let group = 2; group < match.length; group += 1) {
      const isGap = (group - 2) % 2 === 1;
      if (isGap) {
        const gapText = match[group] ?? "";
        joinWithPrevious = gapText === "";
        if (!joinWithPrevious) pieces.push(`${gapText} `);
      } else {
        words.push(match[group]);
        if (!joinWithPrevious) pieces.push(CLOZE_BLANK);
      }
    }
    const start = match.index;
    const end = start + match[0].length;
    return {
      text: `${sentence.slice(0, start)}${pieces.join("")}${sentence.slice(end)}`,
      answer: words.join(" "),
    };
  }

  return null;
}
