import {
  createEmptyCard,
  fsrs,
  Rating,
  State,
  type Card,
  type CardInput,
  type Grade,
} from "ts-fsrs";
import type { FsrsState, ReviewRating, StoredSchedule } from "./types";

const scheduler = fsrs({
  request_retention: 0.9,
  maximum_interval: 36500,
  enable_fuzz: false,
  enable_short_term: true,
  learning_steps: ["10m", "30m"],
  relearning_steps: ["10m", "1d"],
});

const ratingMap: Record<ReviewRating, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

function stateName(state: State): FsrsState {
  return State[state] as FsrsState;
}

export function createStoredSchedule(now = new Date()): StoredSchedule {
  return toStoredSchedule(createEmptyCard(now));
}

export function createReviewSchedule(
  now = new Date(),
  scheduledDays = 3,
): StoredSchedule {
  const lastReview = new Date(now);
  lastReview.setDate(lastReview.getDate() - scheduledDays);

  const due = new Date(now);
  due.setMinutes(due.getMinutes() - 20);

  return {
    due: due.toISOString(),
    stability: Math.max(1.2, scheduledDays + 0.4),
    difficulty: 5.6,
    elapsed_days: scheduledDays,
    scheduled_days: scheduledDays,
    learning_steps: 0,
    reps: 3,
    lapses: 0,
    state: "Review",
    last_review: lastReview.toISOString(),
  };
}

export function scheduleReview(
  schedule: StoredSchedule,
  rating: ReviewRating,
  reviewedAt = new Date(),
) {
  const result = scheduler.next(toCardInput(schedule), reviewedAt, ratingMap[rating]);

  return {
    schedule: toStoredSchedule(result.card),
    scheduledDays: result.log.scheduled_days,
  };
}

export function getRetrievability(schedule: StoredSchedule, now = new Date()) {
  if (schedule.state === "New") {
    return 1;
  }

  try {
    return scheduler.get_retrievability(toCardInput(schedule), now, false);
  } catch {
    return 0.9;
  }
}

function toCardInput(schedule: StoredSchedule): CardInput {
  return {
    due: schedule.due,
    stability: schedule.stability,
    difficulty: schedule.difficulty,
    elapsed_days: schedule.elapsed_days,
    scheduled_days: schedule.scheduled_days,
    learning_steps: schedule.learning_steps,
    reps: schedule.reps,
    lapses: schedule.lapses,
    state: schedule.state,
    last_review: schedule.last_review ?? null,
  };
}

function toStoredSchedule(card: Card): StoredSchedule {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: stateName(card.state),
    last_review: card.last_review?.toISOString() ?? null,
  };
}
