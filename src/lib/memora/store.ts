import {
  englishContentFromDraft,
  generateEnglishCards,
  normalizeEnglishDraft,
  type EnglishDraft,
  type GeneratedCardTemplate,
} from "./card-generator";
import { createStoredSchedule, getRetrievability } from "./scheduler";
import type {
  MemoraState,
  Note,
  QueueSummary,
  ReviewLog,
  StudyCard,
  StudyMode,
} from "./types";

export type QueueOptions = {
  /** Extra new cards the learner explicitly asked for on top of the daily limit. */
  extraNew?: number;
};

export function getDueQueue(
  state: MemoraState,
  mode: StudyMode,
  now = new Date(),
  options: QueueOptions = {},
) {
  const nowMs = now.getTime();

  const due = state.cards
    .filter((card) => card.status === "active")
    .filter((card) => new Date(card.schedule.due).getTime() <= nowMs)
    .filter((card) => matchesMode(card, mode))
    .sort((a, b) => {
      const aIsReview = a.schedule.reps > 0 ? 0 : 1;
      const bIsReview = b.schedule.reps > 0 ? 0 : 1;
      if (aIsReview !== bIsReview) return aIsReview - bIsReview;

      const aRetrievability = getRetrievability(a.schedule, now);
      const bRetrievability = getRetrievability(b.schedule, now);
      if (aRetrievability !== bRetrievability) {
        return aRetrievability - bRetrievability;
      }

      return b.priority - a.priority;
    });

  const newAllowance = remainingNewToday(state, now) + (options.extraNew ?? 0);
  let newTaken = 0;

  return due.filter((card) => {
    if (card.schedule.reps > 0) return true;
    if (newTaken >= newAllowance) return false;
    newTaken += 1;
    return true;
  });
}

/** Cards whose first ever review happened on the learner's current local day. */
export function countNewIntroducedToday(state: MemoraState, now = new Date()) {
  const dayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const firstReviewByCard = new Map<string, number>();

  for (const log of state.reviewLogs) {
    const time = Date.parse(log.reviewedAt);
    if (!Number.isFinite(time)) continue;
    const current = firstReviewByCard.get(log.cardId);
    if (current === undefined || time < current) {
      firstReviewByCard.set(log.cardId, time);
    }
  }

  let count = 0;
  for (const time of firstReviewByCard.values()) {
    if (time >= dayStart && time <= now.getTime()) count += 1;
  }

  return count;
}

export function remainingNewToday(state: MemoraState, now = new Date()) {
  return Math.max(
    0,
    state.settings.dailyNewLimit - countNewIntroducedToday(state, now),
  );
}

/** New cards that are ready but held back by today's limit. */
export function countHeldBackNew(
  state: MemoraState,
  mode: StudyMode,
  now = new Date(),
  options: QueueOptions = {},
) {
  const nowMs = now.getTime();
  const readyNew = state.cards.filter(
    (card) =>
      card.status === "active" &&
      card.schedule.reps === 0 &&
      new Date(card.schedule.due).getTime() <= nowMs &&
      matchesMode(card, mode),
  ).length;
  const allowed = remainingNewToday(state, now) + (options.extraNew ?? 0);

  return Math.max(0, readyNew - allowed);
}

/** Earliest moment an already-studied active card in this mode becomes due. */
export function nextDueAt(state: MemoraState, mode: StudyMode, now = new Date()) {
  const nowMs = now.getTime();
  let next: number | null = null;

  for (const card of state.cards) {
    if (card.status !== "active" || card.schedule.reps === 0) continue;
    if (!matchesMode(card, mode)) continue;
    const due = Date.parse(card.schedule.due);
    if (due > nowMs && (next === null || due < next)) next = due;
  }

  return next === null ? null : new Date(next);
}

export function summarizeState(
  state: MemoraState,
  now = new Date(),
  options: QueueOptions = {},
): QueueSummary {
  const dueCards = getDueQueue(state, state.settings.studyMode, now, options);
  const dueReviews = dueCards.filter((card) => card.schedule.reps > 0).length;
  const newAvailable = dueCards.filter((card) => card.schedule.reps === 0).length;
  const retention = calculateRetention(state.reviewLogs);
  const desiredRetentionGap =
    retention === null ? null : retention - state.settings.desiredRetention;
  const lapses = state.reviewLogs.filter((log) => log.rating === "again").length;
  const matureCards = state.cards.filter(
    (card) => card.schedule.scheduled_days >= 21,
  ).length;
  const leeches = state.cards.filter((card) => card.schedule.lapses >= 4).length;

  return {
    dueReviews,
    newAvailable,
    totalDue: dueCards.length,
    estimatedMinutes: Math.max(1, Math.ceil(dueCards.length * 0.75)),
    retention,
    desiredRetentionGap,
    lapses,
    matureCards,
    leeches,
  };
}

export function addEnglishNote(state: MemoraState, draft: EnglishDraft): MemoraState {
  const now = new Date();
  const normalized = normalizeEnglishDraft(draft);
  const noteId = `note-user-english-${crypto.randomUUID()}`;
  const baseTags = ["english", "user"];

  const note: Note = {
    id: noteId,
    module: "english",
    title: normalized.lemma,
    status: "active",
    source: "user",
    tags: baseTags,
    createdAt: now.toISOString(),
    content: englishContentFromDraft(normalized),
  };

  const cards = generateEnglishCards(normalized).map((card) =>
    makeUserCard(noteId, card),
  );

  return {
    ...state,
    notes: [...state.notes, note],
    cards: [...state.cards, ...cards],
  };
}

export function suspendCard(state: MemoraState, cardId: string): MemoraState {
  return {
    ...state,
    cards: state.cards.map((card) =>
      card.id === cardId ? { ...card, status: "suspended" } : card,
    ),
  };
}

function calculateRetention(logs: ReviewLog[]) {
  if (logs.length === 0) return null;

  const correct = logs.filter((log) => log.wasCorrect).length;
  return correct / logs.length;
}

export function matchesMode(card: StudyCard, mode: StudyMode) {
  if (mode === "daily") return true;
  // "english-productive" is the stored id of the English-only mode.
  if (mode === "english-productive") return card.module === "english";
  return card.module === "qa";
}

function makeUserCard(
  noteId: string,
  card: GeneratedCardTemplate,
): StudyCard {
  return {
    ...card,
    noteId,
    id: `card-user-${crypto.randomUUID()}`,
    schedule: createStoredSchedule(),
    status: "active",
  };
}
