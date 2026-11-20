import {
  dateChrono,
  defineScheduler,
  Rating,
  schedulerDesiredRetentionMiddleware,
  schedulerFuzzingMiddleware,
  schedulerLearningStepsMiddleware,
  schedulerMaximumIntervalMiddleware,
  schedulerMonotonicIntervalMiddleware,
  schedulerScheduledDaysMiddleware,
  schedulerStatsMiddleware,
  type Grade,
} from "ts-fsrs";
import { FSRS6Model, migrateFSRS6Parameters } from "ts-fsrs/models/fsrs-6";
import type { FsrsState, ReviewRating, StoredSchedule } from "./types";

const learningSteps = ["10m", "30m"] as const;
const relearningSteps = ["10m", "1d"] as const;

/**
 * FSRS-6 scheduler built synchronously from the same model and middleware
 * stack `DefaultScheduler({ version: "FSRS-6" })` uses (that factory is
 * async, and the client needs a sync scheduler for optimistic grading).
 * Fuzz is seeded with cardId + reps, so the client and the server compute
 * the same interval for the same review.
 */
const scheduler = defineScheduler({ model: FSRS6Model, chrono: dateChrono })
  .use(
    schedulerDesiredRetentionMiddleware,
    schedulerFuzzingMiddleware,
    schedulerStatsMiddleware,
    schedulerScheduledDaysMiddleware,
    schedulerLearningStepsMiddleware,
    schedulerMaximumIntervalMiddleware,
    schedulerMonotonicIntervalMiddleware,
  )
  .create({
    config: {
      fractionalDays: false,
      weights: migrateFSRS6Parameters(),
      enableShortTerm: true,
      numRelearningSteps: relearningSteps.length,
      desiredRetention: 0.9,
      learningSteps: [...learningSteps],
      relearningSteps: [...relearningSteps],
      allowModelOverride: false,
      enableFuzz: true,
      maximumInterval: 36500,
    },
  });

type SchedulerCard = ReturnType<typeof scheduler.newCard>;

const ratingMap: Record<ReviewRating, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

const fsrsStates: FsrsState[] = ["New", "Learning", "Review", "Relearning"];

export function createStoredSchedule(now = new Date()): StoredSchedule {
  return {
    due: now.toISOString(),
    stability: 0,
    difficulty: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: 0,
    lapses: 0,
    state: "New",
    last_review: null,
  };
}

/** Parses a schedule stored as JSON (review log snapshots, backups). */
export function readStoredSchedule(value: unknown): StoredSchedule | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const state = raw.state as FsrsState;
  if (typeof raw.due !== "string" || !Number.isFinite(Date.parse(raw.due))) return null;
  if (!fsrsStates.includes(state)) return null;
  const lastReview =
    typeof raw.last_review === "string" && Number.isFinite(Date.parse(raw.last_review))
      ? raw.last_review
      : null;
  const number = (key: string, integer: boolean) => {
    const parsed = Number(raw[key] ?? 0);
    const safe = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    return integer ? Math.round(safe) : safe;
  };

  return {
    due: raw.due,
    stability: number("stability", false),
    difficulty: number("difficulty", false),
    scheduled_days: number("scheduled_days", true),
    learning_steps: number("learning_steps", true),
    reps: number("reps", true),
    lapses: number("lapses", true),
    state,
    last_review: lastReview,
  };
}

export function scheduleReview(
  cardId: string,
  schedule: StoredSchedule,
  rating: ReviewRating,
  reviewedAt = new Date(),
) {
  const result = scheduler.review({
    card: toSchedulerCard(cardId, schedule),
    grade: ratingMap[rating],
    now: reviewedAt,
  });
  return { schedule: toStoredSchedule(result.card), scheduledDays: result.card.scheduledDays };
}

/** Next due date for every possible rating, used to label grade buttons. */
export function previewNextDue(
  cardId: string,
  schedule: StoredSchedule,
  now = new Date(),
): Record<ReviewRating, Date> {
  const byGrade = new Map<number, Date>();
  for (const item of scheduler.preview({ card: toSchedulerCard(cardId, schedule), now })) {
    byGrade.set(item.grade, item.card.dueAt);
  }
  const pick = (rating: ReviewRating) => byGrade.get(ratingMap[rating]) ?? now;
  return { again: pick("again"), hard: pick("hard"), good: pick("good"), easy: pick("easy") };
}

/** Compact Ukrainian interval label: "10 хв", "5 год", "3 дн", "2 міс", "1,5 р". */
export function formatInterval(from: Date, to: Date) {
  const minutes = Math.max(1, Math.round((to.getTime() - from.getTime()) / 60000));
  if (minutes < 60) return `${minutes} хв`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} год`;

  const days = Math.round(hours / 24);
  if (days < 31) return `${days} дн`;

  const months = days / 30.4;
  if (months < 12) return `${Math.round(months)} міс`;

  const years = Math.round((days / 365) * 10) / 10;
  return `${years.toString().replace(".", ",")} р`;
}

/**
 * Probability of recalling the card now, by the FSRS-6 forgetting curve
 * with the scheduler's own parameters. New cards count as 1 (nothing to
 * forget yet). Used to order due reviews: most forgotten first.
 */
export function getRetrievability(schedule: StoredSchedule, now = new Date()) {
  if (schedule.state === "New" || !schedule.last_review || schedule.stability <= 0) return 1;
  const elapsedDays = Math.max(0, (now.getTime() - Date.parse(schedule.last_review)) / 86_400_000);
  const value = scheduler.model.forgettingCurve(
    { stability: schedule.stability, difficulty: schedule.difficulty },
    elapsedDays,
  );
  return Number.isFinite(value) ? value : 0.9;
}

function toSchedulerCard(cardId: string, schedule: StoredSchedule): SchedulerCard {
  const state = Math.max(0, fsrsStates.indexOf(schedule.state)) as SchedulerCard["state"];
  return {
    cardId,
    dueAt: new Date(schedule.due),
    lastReviewAt: schedule.last_review ? new Date(schedule.last_review) : null,
    stability: schedule.stability,
    difficulty: schedule.difficulty,
    state,
    scheduleStatus: state === 0 ? "new" : state === 2 ? "review" : "learning",
    reps: schedule.reps,
    lapses: schedule.lapses,
    scheduledDays: schedule.scheduled_days,
    learningStep: schedule.learning_steps,
  } as SchedulerCard;
}

function toStoredSchedule(card: SchedulerCard): StoredSchedule {
  return {
    due: card.dueAt.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    scheduled_days: card.scheduledDays,
    learning_steps: card.learningStep,
    reps: card.reps,
    lapses: card.lapses,
    state: fsrsStates[card.state] ?? "New",
    last_review: card.lastReviewAt ? card.lastReviewAt.toISOString() : null,
  };
}
