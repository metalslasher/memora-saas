import { readStoredSchedule, scheduleReview } from "../scheduler";
import type {
  CardStatus,
  PracticeCard,
  PracticeSummary,
  ReviewOutcome,
  ReviewRating,
  StoredSchedule,
} from "../types";
import { readWordContent } from "../word-content";
import { check, must, scheduleColumns, scheduleFromRow, scheduleToRow, type Db } from "./db";

export async function getPracticeSummary(db: Db, timezone: string): Promise<PracticeSummary> {
  const rows = must(await db.rpc("get_practice_summary", { p_tz: timezone }));
  const row = rows[0];
  return {
    dueReviews: row?.due_reviews ?? 0,
    newReady: row?.new_ready ?? 0,
    newToday: row?.new_today ?? 0,
    dailyNewLimit: row?.daily_new_limit ?? 0,
    nextDueAt: row?.next_due_at ?? null,
    activeCards: row?.active_cards ?? 0,
  };
}

/** Due reviews plus today's allowance of new cards, with word content. */
export async function getPracticeQueue(
  db: Db,
  timezone: string,
  extraNew = 0,
): Promise<PracticeCard[]> {
  const rows = must(
    await db.rpc("get_practice_queue", { p_tz: timezone, p_extra_new: extraNew }),
  );
  return rows.map((row) => ({
    id: row.id,
    userWordId: row.user_word_id,
    kind: row.kind,
    lemma: row.lemma,
    content: readWordContent(row.content),
    schedule: scheduleFromRow(row),
  }));
}

export async function setCardStatus(db: Db, cardId: string, status: CardStatus) {
  check(await db.from("cards").update({ status }).eq("id", cardId));
}

/** Schedules one card with FSRS and records the review. */
export async function gradeCard(
  db: Db,
  input: { cardId: string; rating: ReviewRating; responseText: string; elapsedMs: number },
): Promise<ReviewOutcome> {
  const card = must(
    await db
      .from("cards")
      .select(`id,user_word_id,${scheduleColumns}`)
      .eq("id", input.cardId)
      .single(),
  );
  const before = scheduleFromRow(card);
  const reviewedAt = new Date();
  const { schedule } = scheduleReview(before, input.rating, reviewedAt);

  check(await db.from("cards").update(scheduleToRow(schedule)).eq("id", card.id));

  const log = must(
    await db
      .from("review_logs")
      .insert({
        card_id: card.id,
        user_word_id: card.user_word_id,
        rating: input.rating,
        reviewed_at: reviewedAt.toISOString(),
        elapsed_ms: input.elapsedMs,
        response_text: input.responseText,
        was_correct: input.rating !== "again",
        schedule_before: before,
        schedule_after: schedule,
      })
      .select("id")
      .single(),
  );

  return { cardId: card.id, schedule, logId: log.id };
}

/** Restores the schedule saved before a review and removes that review. */
export async function undoReview(
  db: Db,
  logId: string,
): Promise<{ cardId: string; schedule: StoredSchedule }> {
  const log = must(
    await db.from("review_logs").select("id,card_id,schedule_before").eq("id", logId).single(),
  );
  const schedule = readStoredSchedule(log.schedule_before);
  if (!schedule) throw new Error("Цю оцінку вже не можна скасувати.");

  check(await db.from("cards").update(scheduleToRow(schedule)).eq("id", log.card_id));
  check(await db.from("review_logs").delete().eq("id", logId));

  return { cardId: log.card_id, schedule };
}

/** Forgets all reviews: every card starts from scratch, words stay. */
export async function resetProgress(db: Db, userId: string) {
  check(await db.from("review_logs").delete().eq("user_id", userId));
  check(
    await db
      .from("cards")
      .update({
        state: "New",
        due: new Date().toISOString(),
        stability: 0,
        difficulty: 0,
        elapsed_days: 0,
        scheduled_days: 0,
        learning_steps: 0,
        reps: 0,
        lapses: 0,
        last_review: null,
      })
      .eq("user_id", userId),
  );
}
