import { wordForms } from "./word-forms";

/**
 * "From a text": the learner taps the words they do not know. Adjacent tapped
 * words (separated by spaces only) become one phrase ("figure" + "out").
 */
export type TextToken = { text: string; isWord: boolean };

export const MAX_TEXT_LENGTH = 3000;

const wordPattern = /[A-Za-z]+(?:['’][A-Za-z]+)*(?:-[A-Za-z]+)*/g;

export function tokenizeText(text: string): TextToken[] {
  const tokens: TextToken[] = [];
  let last = 0;
  for (const match of text.matchAll(wordPattern)) {
    const start = match.index ?? 0;
    if (start > last) tokens.push({ text: text.slice(last, start), isWord: false });
    tokens.push({ text: match[0], isWord: true });
    last = start + match[0].length;
  }
  if (last < text.length) tokens.push({ text: text.slice(last), isWord: false });
  return tokens;
}

function normalizeWord(word: string) {
  return word.toLowerCase().replace(/’/g, "'");
}

/** Every form of the single-word lemmas already in the library. */
export function knownWordForms(lemmas: string[]) {
  const known = new Set<string>();
  for (const lemma of lemmas) {
    const clean = normalizeWord(lemma.trim());
    if (!clean || /\s/.test(clean)) continue;
    for (const form of wordForms(clean)) known.add(form);
  }
  return known;
}

export function isKnownWord(word: string, known: Set<string>) {
  return known.has(normalizeWord(word));
}

export type PickedPhrase = { input: string; context: string; indices: number[] };

/** The sentence that contains tokens first…last (context for the right sense). */
function sentenceAround(tokens: TextToken[], first: number, last: number) {
  const text = tokens.map((token) => token.text).join("");
  const offset = (index: number) => tokens.slice(0, index).reduce((sum, token) => sum + token.text.length, 0);
  const from = offset(first);
  const to = offset(last) + tokens[last].text.length;
  let start = from;
  while (start > 0 && !/[.!?\n]/.test(text[start - 1])) start -= 1;
  let end = to;
  while (end < text.length && !/[.!?\n]/.test(text[end])) end += 1;
  if (end < text.length && text[end] !== "\n") end += 1;
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

/** Groups the tapped token indices into phrases, in text order, without repeats. */
export function pickedPhrases(tokens: TextToken[], selected: Set<number>): PickedPhrase[] {
  const groups: number[][] = [];
  let current: number[] = [];
  tokens.forEach((token, index) => {
    if (token.isWord) {
      if (selected.has(index)) current.push(index);
      else if (current.length > 0) {
        groups.push(current);
        current = [];
      }
    } else if (current.length > 0 && !/^[ \t]+$/.test(token.text)) {
      groups.push(current);
      current = [];
    }
  });
  if (current.length > 0) groups.push(current);

  const seen = new Set<string>();
  const phrases: PickedPhrase[] = [];
  for (const indices of groups) {
    const input = indices.map((index) => tokens[index].text).join(" ");
    const key = normalizeWord(input);
    if (seen.has(key)) continue;
    seen.add(key);
    phrases.push({ input, context: sentenceAround(tokens, indices[0], indices.at(-1)!), indices });
  }
  return phrases;
}
