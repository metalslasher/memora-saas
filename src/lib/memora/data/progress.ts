import { parseProgressStats, type ProgressStats } from "../progress";
import type { CardKind, ReviewRating } from "../types";
import { must, type Db } from "./db";
import { getStreak } from "./goal";

export async function getProgressStats(db: Db, profile: { timezone: string; dailyMinutes: number }): Promise<ProgressStats> {
  const [stats, streak] = await Promise.all([
    db.rpc("get_progress_stats", { p_tz: profile.timezone }).then(must),
    getStreak(db, profile),
  ]);
  return { ...parseProgressStats(stats), streak };
}

export type WeakCard = {
  userWordId: string;
  lemma: string;
  kind: CardKind;
  lapses: number;
};

/** Active cards that were forgotten most often. */
export async function listWeakCards(db: Db, limit = 8): Promise<WeakCard[]> {
  const rows = must(
    await db
      .from("cards")
      .select("kind,lapses,user_word_id,user_words(lemma)")
      .eq("status", "active")
      .gt("lapses", 0)
      .order("lapses", { ascending: false })
      .limit(limit),
  );
  return rows.map((row) => ({
    userWordId: row.user_word_id,
    lemma: row.user_words?.lemma ?? "",
    kind: row.kind,
    lapses: row.lapses,
  }));
}

export type RecentReview = {
  id: string;
  userWordId: string;
  lemma: string;
  kind: CardKind | null;
  rating: ReviewRating;
  wasCorrect: boolean;
  reviewedAt: string;
};

export async function listRecentReviews(db: Db, limit = 15): Promise<RecentReview[]> {
  const rows = must(
    await db
      .from("review_logs")
      .select("id,rating,was_correct,reviewed_at,user_word_id,cards(kind),user_words(lemma)")
      .order("reviewed_at", { ascending: false })
      .limit(limit),
  );
  return rows.map((row) => ({
    id: row.id,
    userWordId: row.user_word_id,
    lemma: row.user_words?.lemma ?? "",
    kind: row.cards?.kind ?? null,
    rating: row.rating,
    wasCorrect: row.was_correct,
    reviewedAt: row.reviewed_at,
  }));
}
