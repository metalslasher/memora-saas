import { exerciseOrder } from "../card-render";
import { knownWordKinds, startingKinds } from "../exercise-unlock";
import { lemmaKey } from "../duplicates";
import type {
  WordContent,
  WordDetail,
  WordListItem,
  WordSource,
  WordStatus,
} from "../types";
import { contentFromDraft, readWordContent, translationText, type NormalizedWordDraft } from "../word-content";
import { wordProgress } from "../word-progress";
import { check, isUniqueViolation, maybe, must, scheduleColumns, scheduleFromRow, type Db } from "./db";

const wordListColumns =
  "id,lemma,status,source,content,created_at,cards(status,reps,lapses,scheduled_days,state)";

type WordListRow = {
  id: string;
  lemma: string;
  status: WordStatus;
  source: WordSource;
  content: unknown;
  created_at: string;
  cards: Array<{
    status: "active" | "paused";
    reps: number;
    lapses: number;
    scheduled_days: number;
    state: "New" | "Learning" | "Review" | "Relearning";
  }>;
};

export function toWordListItem(row: WordListRow): WordListItem {
  return {
    id: row.id,
    lemma: row.lemma,
    translation: translationText(readWordContent(row.content)),
    status: row.status,
    source: row.source,
    createdAt: row.created_at,
    progress: wordProgress(row.cards),
    maxLapses: Math.max(0, ...row.cards.map((card) => card.lapses)),
  };
}

/** The whole library with a compact progress summary per word. */
export async function listWords(db: Db): Promise<WordListItem[]> {
  const rows = must(
    await db.from("user_words").select(wordListColumns).order("created_at", { ascending: false }),
  );
  return rows.map(toWordListItem);
}

export async function getWordDetail(db: Db, id: string): Promise<WordDetail | null> {
  const [wordResult, totalResult, correctResult] = await Promise.all([
    db
      .from("user_words")
      .select(`id,lemma,status,source,content,created_at,cards(id,kind,status,${scheduleColumns})`)
      .eq("id", id)
      .maybeSingle(),
    db.from("review_logs").select("id", { count: "exact", head: true }).eq("user_word_id", id),
    db
      .from("review_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_word_id", id)
      .eq("was_correct", true),
  ]);

  const word = maybe(wordResult);
  if (totalResult.error) throw totalResult.error;
  if (correctResult.error) throw correctResult.error;
  if (!word) return null;

  return {
    id: word.id,
    lemma: word.lemma,
    status: word.status,
    source: word.source,
    content: readWordContent(word.content),
    createdAt: word.created_at,
    cards: word.cards
      .map((card) => ({
        id: card.id,
        kind: card.kind,
        status: card.status,
        schedule: scheduleFromRow(card),
      }))
      .sort((a, b) => exerciseOrder.indexOf(a.kind) - exerciseOrder.indexOf(b.kind)),
    reviews: { total: totalResult.count ?? 0, correct: correctResult.count ?? 0 },
  };
}

export type NewWord = {
  lemma: string;
  content: WordContent;
  source: WordSource;
  lexiconId?: string | null;
  /** Program word the test credited as known: starts with recall, not recognition. */
  assumedKnown?: boolean;
};

const kindsFor = (word: { assumedKnown?: boolean }) => (word.assumedKnown ? knownWordKinds : startingKinds);

/**
 * Inserts words with their starting card (recognition, or recall for words
 * assumed known; the other exercises are unlocked by practice). If the cards cannot be created the words are
 * removed again, so no word is left without cards.
 */
export async function insertWordsWithCards(db: Db, words: NewWord[]) {
  if (words.length === 0) return [];
  const inserted = must(
    await db
      .from("user_words")
      .insert(
        words.map((word) => ({
          lemma: word.lemma,
          content: word.content,
          source: word.source,
          lexicon_id: word.lexiconId ?? null,
          assumed_known: word.assumedKnown ?? false,
        })),
      )
      .select(wordListColumns),
  );

  const cards = inserted.flatMap((word, index) =>
    kindsFor(words[index]).map((kind) => ({ user_word_id: word.id, kind })),
  );
  const { error } = await db.from("cards").insert(cards);
  if (error) {
    await db.from("user_words").delete().in("id", inserted.map((word) => word.id));
    throw error;
  }

  return inserted.map((row, index) =>
    toWordListItem({
      ...row,
      cards: kindsFor(words[index]).map(() => ({
        status: "active" as const,
        reps: 0,
        lapses: 0,
        scheduled_days: 0,
        state: "New" as const,
      })),
    }),
  );
}

/**
 * Adds a word from the form. `base` is the AI draft the form was filled from:
 * the edited fields go on top, the rest (more examples, forms…) is kept.
 */
export async function addWord(
  db: Db,
  draft: NormalizedWordDraft,
  base?: { content: WordContent; lexiconId: string | null },
): Promise<WordListItem> {
  try {
    const [word] = await insertWordsWithCards(db, [
      {
        lemma: draft.lemma,
        content: contentFromDraft(draft, base?.content),
        source: "manual",
        lexiconId: base?.lexiconId ?? null,
      },
    ]);
    return word;
  } catch (error) {
    if (isUniqueViolation(error)) throw new Error(`«${draft.lemma}» уже є у твоїх словах.`);
    throw error;
  }
}

/** Applies the edit form; fields the form does not show are preserved. */
export async function updateWord(db: Db, id: string, draft: NormalizedWordDraft) {
  const current = must(await db.from("user_words").select("content").eq("id", id).single());
  const content = contentFromDraft(draft, readWordContent(current.content));
  const { data, error } = await db
    .from("user_words")
    .update({ lemma: draft.lemma, content })
    .eq("id", id)
    .select("lemma,content")
    .single();
  if (error) {
    if (isUniqueViolation(error)) throw new Error(`«${draft.lemma}» уже є у твоїх словах.`);
    throw error;
  }
  return { lemma: data.lemma, content: readWordContent(data.content) };
}

export async function setWordStatus(db: Db, id: string, status: WordStatus) {
  check(await db.from("user_words").update({ status }).eq("id", id));
}

export async function deleteWord(db: Db, id: string) {
  check(await db.from("user_words").delete().eq("id", id));
}

export async function deleteAllWords(db: Db, userId: string) {
  check(await db.from("user_words").delete().eq("user_id", userId));
}

/** lemmaKey() of every word in the library, for duplicate checks. */
export async function listLemmaKeys(db: Db) {
  const rows = must(await db.from("user_words").select("lemma"));
  return new Set(rows.map((row) => lemmaKey(row.lemma)));
}
