import type { Json } from "@/lib/supabase/database.types";
import { createBackupDocument, type BackupDocument, type BackupWord } from "../backup";
import { wordsToCsv } from "../export";
import { readStoredSchedule } from "../scheduler";
import { readWordContent } from "../word-content";
import { must, scheduleColumns, scheduleFromRow, type Db } from "./db";

/** The whole library with cards and review history, as a backup document. */
export async function exportBackup(db: Db): Promise<BackupDocument> {
  const rows = must(
    await db
      .from("user_words")
      .select(
        `lemma,source,status,content,created_at,cards(kind,status,${scheduleColumns},review_logs(rating,reviewed_at,elapsed_ms,response_text,was_correct,schedule_before,schedule_after))`,
      )
      .order("created_at", { ascending: true }),
  );

  const words: BackupWord[] = rows.map((word) => ({
    lemma: word.lemma,
    source: word.source,
    status: word.status,
    content: readWordContent(word.content),
    created_at: word.created_at,
    cards: word.cards.map((card) => ({
      ...scheduleFromRow(card),
      kind: card.kind,
      status: card.status,
      reviews: card.review_logs.flatMap((log) => {
        const before = readStoredSchedule(log.schedule_before);
        const after = readStoredSchedule(log.schedule_after);
        if (!before || !after) return [];
        return [
          {
            rating: log.rating,
            reviewed_at: log.reviewed_at,
            elapsed_ms: log.elapsed_ms,
            response_text: log.response_text,
            was_correct: log.was_correct,
            schedule_before: before,
            schedule_after: after,
          },
        ];
      }),
    })),
  }));

  return createBackupDocument(words);
}

/** Replaces the library atomically (one database transaction). */
export async function restoreBackup(db: Db, backup: BackupDocument) {
  return must(await db.rpc("restore_words_backup", { p_words: backup.words as unknown as Json }));
}

export async function exportWordsCsv(db: Db) {
  const rows = must(
    await db
      .from("user_words")
      .select("lemma,source,status,content")
      .order("created_at", { ascending: true }),
  );
  return wordsToCsv(
    rows.map((row) => ({ ...row, content: readWordContent(row.content) })),
  );
}

export async function countLibrary(db: Db) {
  const [words, reviews] = await Promise.all([
    db.from("user_words").select("id", { count: "exact", head: true }),
    db.from("review_logs").select("id", { count: "exact", head: true }),
  ]);
  if (words.error) throw words.error;
  if (reviews.error) throw reviews.error;
  return { words: words.count ?? 0, reviews: reviews.count ?? 0 };
}
