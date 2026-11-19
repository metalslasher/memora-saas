export type WordRef = { id: string; lemma: string };

export type SimilarWords = {
  /** Same lemma after normalisation: cannot be added twice. */
  exact: WordRef | null;
  /** Lemmas that contain each other ("figure out" / "figure it out"). */
  close: WordRef[];
};

export function normalizeLookupText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Database uniqueness key: unique (user_id, lower(lemma)). */
export function lemmaKey(lemma: string) {
  return lemma.trim().replace(/\s+/g, " ").toLowerCase();
}

export function findSimilarWords(words: WordRef[], lemma: string, limit = 3): SimilarWords {
  const key = lemmaKey(lemma);
  const needle = normalizeLookupText(lemma);
  if (!needle) return { exact: null, close: [] };

  let exact: WordRef | null = null;
  const close: WordRef[] = [];

  for (const word of words) {
    if (lemmaKey(word.lemma) === key) {
      exact = word;
      continue;
    }
    const existing = normalizeLookupText(word.lemma);
    if (existing === needle) {
      close.unshift(word);
    } else if (
      needle.length >= 4 &&
      existing.length >= 4 &&
      (existing.includes(needle) || needle.includes(existing))
    ) {
      close.push(word);
    }
  }

  return { exact, close: close.slice(0, limit) };
}
