import { kindsToUnlock } from "../exercise-unlock";
import { MAX_NEW_WORDS, newWordAllowance } from "../pace";
import { limitProductionCards } from "../production";
import { isNewWordCard } from "../queue";
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
import { getProductionAllowance } from "./production";

export async function getPracticeSummary(db: Db, timezone: string): Promise<PracticeSummary> {
  const rows = must(await db.rpc("get_practice_overview", { p_tz: timezone }));
  const row = rows[0];
  return {
    dueWords: row?.due_words ?? 0,
    reviewsToday: row?.reviews_today ?? 0,
    newReady: row?.new_ready ?? 0,
    newToday: row?.new_today ?? 0,
    dailyMinutes: row?.daily_minutes ?? 15,
    nextDueAt: row?.next_due_at ?? null,
    activeCards: row?.active_cards ?? 0,
    dayStart: row?.day_start ?? new Date().toISOString(),
  };
}

/**
 * Cards for one practice session: reviews available today plus as many new
 * words as today's pace allows (+ `extraNew` the learner asked for), and
 * writing/speaking exercises within their daily quota (production.ts).
 */
export async function getPracticeSession(
  db: Db,
  profile: { id: string; timezone: string; dailyMinutes: number; speakingEnabled: boolean },
  extraNew = 0,
  /** An already running summary request (the /app layout loads one). */
  summaryRequest?: Promise<PracticeSummary>,
): Promise<{ cards: PracticeCard[]; summary: PracticeSummary }> {
  const [summary, rows, allowance] = await Promise.all([
    summaryRequest ?? getPracticeSummary(db, profile.timezone),
    db.rpc("get_practice_cards", { p_tz: profile.timezone, p_new_words: MAX_NEW_WORDS + extraNew }).then(must),
    getProductionAllowance(db, profile),
  ]);
  const cards: PracticeCard[] = rows.map((row) => ({
    id: row.id,
    userWordId: row.user_word_id,
    kind: row.kind,
    lemma: row.lemma,
    content: readWordContent(row.content),
    schedule: scheduleFromRow(row),
    wordReviewedAt: row.word_reviewed_at ?? null,
  }));

  let newAllowance = newWordAllowance(summary, extraNew);
  const kept = limitProductionCards(cards, allowance).filter((card) => {
    if (!isNewWordCard(card)) return true;
    if (newAllowance <= 0) return false;
    newAllowance -= 1;
    return true;
  });
  return { cards: kept, summary };
}

export async function setCardStatus(db: Db, cardId: string, status: CardStatus) {
  check(await db.from("cards").update({ status }).eq("id", cardId));
}

/**
 * Schedules one card with FSRS, records the review and unlocks the word's
 * next exercises when the card has earned them (cards are created lazily).
 */
export async function gradeCard(
  db: Db,
  input: { cardId: string; rating: ReviewRating; responseText: string; elapsedMs: number; countedMs?: number },
): Promise<ReviewOutcome> {
  const card = must(
    await db
      .from("cards")
      .select(`id,user_word_id,kind,${scheduleColumns},user_words(lemma,content)`)
      .eq("id", input.cardId)
      .single(),
  );
  const before = scheduleFromRow(card);
  const reviewedAt = new Date();
  const { schedule } = scheduleReview(card.id, before, input.rating, reviewedAt);

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
        counted_ms: input.countedMs ?? 0,
        response_text: input.responseText,
        was_correct: input.rating !== "again",
        schedule_before: before,
        schedule_after: schedule,
      })
      .select("id")
      .single(),
  );

  const word = card.user_words;
  const unlocked = word
    ? kindsToUnlock({
        kind: card.kind,
        rating: input.rating,
        after: schedule,
        lemma: word.lemma,
        content: readWordContent(word.content),
      })
    : [];
  if (unlocked.length > 0) {
    check(
      await db
        .from("cards")
        .upsert(
          unlocked.map((kind) => ({ user_word_id: card.user_word_id, kind })),
          { onConflict: "user_word_id,kind", ignoreDuplicates: true },
        ),
    );
  }

  return { cardId: card.id, schedule, logId: log.id, unlocked };
}

/**
 * Restores the schedule saved before a review, removes that review and the
 * exercises it unlocked (cards created by it and not practised since).
 */
export async function undoReview(
  db: Db,
  logId: string,
): Promise<{ cardId: string; schedule: StoredSchedule }> {
  const log = must(
    await db
      .from("review_logs")
      .select("id,card_id,user_word_id,reviewed_at,schedule_before")
      .eq("id", logId)
      .single(),
  );
  const schedule = readStoredSchedule(log.schedule_before);
  if (!schedule) throw new Error("Цю оцінку вже не можна скасувати.");

  check(await db.from("cards").update(scheduleToRow(schedule)).eq("id", log.card_id));
  check(await db.from("review_logs").delete().eq("id", logId));
  check(
    await db
      .from("cards")
      .delete()
      .eq("user_word_id", log.user_word_id)
      .neq("id", log.card_id)
      .eq("reps", 0)
      .gte("created_at", log.reviewed_at),
  );

  return { cardId: log.card_id, schedule };
}

/**
 * Forgets all reviews: every word starts again from recognition (unlocked
 * exercises are removed), words stay.
 */
export async function resetProgress(db: Db, userId: string) {
  check(await db.from("review_logs").delete().eq("user_id", userId));
  check(await db.from("cards").delete().eq("user_id", userId).neq("kind", "recognition"));
  // Words the test took as known started with recall: they start over from recognition too.
  const known = must(await db.from("user_words").select("id").eq("user_id", userId).eq("assumed_known", true));
  if (known.length > 0) {
    check(
      await db
        .from("cards")
        .upsert(
          known.map((word) => ({ user_word_id: word.id, kind: "recognition" as const })),
          { onConflict: "user_word_id,kind", ignoreDuplicates: true },
        ),
    );
    check(await db.from("user_words").update({ assumed_known: false }).eq("user_id", userId).eq("assumed_known", true));
  }
  check(
    await db
      .from("cards")
      .update({
        state: "New",
        due: new Date().toISOString(),
        stability: 0,
        difficulty: 0,
        scheduled_days: 0,
        learning_steps: 0,
        reps: 0,
        lapses: 0,
        last_review: null,
      })
      .eq("user_id", userId),
  );
}
