"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  gradeCardAction,
  loadPracticeAction,
  setCardStatusAction,
  undoReviewAction,
} from "@/lib/memora/actions/practice";
import { heldBackNew, MAX_COUNTED_CARD_MS, sessionOptions } from "@/lib/memora/pace";
import { buildPracticeQueue, nextDueAt } from "@/lib/memora/queue";
import { scheduleReview } from "@/lib/memora/scheduler";
import type { CardKind, PracticeCard, PracticeSummary, ReviewRating, StoredSchedule } from "@/lib/memora/types";
import { useShell } from "../app-shell";
import { formatError } from "../utils";

export type SessionStats = {
  reviewed: number;
  correct: number;
  startedAt: number;
  /** Time spent on cards, idle time capped per card. */
  activeMs: number;
};

type LastReview = {
  cardId: string;
  previousSchedule: StoredSchedule;
  wasCorrect: boolean;
  countedMs: number;
  /** Resolves to the server log id, or null when the write failed. */
  serverLogId: Promise<string | null>;
  /** Identifies the review, so a late server reply after undo is ignored. */
  token: object;
};

function orderOf(cards: PracticeCard[], offset = 0) {
  return new Map(cards.map((card, index) => [card.id, offset + index]));
}

function defaultSessionMinutes(dailyMinutes: number) {
  return sessionOptions(dailyMinutes).includes(dailyMinutes) ? dailyMinutes : 10;
}

/**
 * Client state of one practice session: the cards it holds, optimistic
 * grading (the next card appears instantly, server writes run in an ordered
 * background chain), undo, pause, skip, the session timer and "more new
 * words". `canPlayAudio` = false hides listening exercises (no speech on
 * this device), `canRecord` = false hides speak-aloud (no microphone API).
 */
export function usePracticeSession(
  initialCards: PracticeCard[],
  initialSummary: PracticeSummary,
  { canPlayAudio, canRecord }: { canPlayAudio: boolean; canRecord: boolean },
) {
  const { showToast, setDueCount, markReviewed, applyGoal, streak } = useShell();
  /** Today's goal as confirmed by the server (the screen may show it earlier, optimistically). */
  const goalMetRef = useRef(streak.goalMet);
  const [cards, setCards] = useState(initialCards);
  const [newOrder, setNewOrder] = useState(() => orderOf(initialCards));
  const [summary, setSummary] = useState(initialSummary);
  const [extraNew, setExtraNew] = useState(0);
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(() => new Set());
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [revealedAfterMs, setRevealedAfterMs] = useState<number | null>(null);
  const [shownAt, setShownAt] = useState(() => Date.now());
  const [session, setSession] = useState<SessionStats>(() => ({
    reviewed: 0,
    correct: 0,
    startedAt: Date.now(),
    activeMs: 0,
  }));
  const [sessionMinutes, setSessionMinutes] = useState(() => defaultSessionMinutes(initialSummary.dailyMinutes));
  const [lastReview, setLastReview] = useState<LastReview | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const reviewChainRef = useRef<Promise<unknown>>(Promise.resolve());
  /** Reviews undone in this session: their late server replies are ignored. */
  const undoneRef = useRef(new WeakSet<object>());

  // Re-evaluate the queue every minute so learning steps come back on time.
  useEffect(() => {
    const interval = window.setInterval(() => setClock(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const now = useMemo(() => new Date(clock), [clock]);
  const dayStart = useMemo(() => new Date(summary.dayStart), [summary.dayStart]);
  const playable = useMemo(
    () =>
      cards.filter(
        (card) => (canPlayAudio || card.kind !== "listening") && (canRecord || card.kind !== "speaking"),
      ),
    [canPlayAudio, canRecord, cards],
  );
  const queue = useMemo(
    () => buildPracticeQueue(playable, now, { dayStart, newOrder, skipped }),
    [dayStart, newOrder, now, playable, skipped],
  );
  const isTimeUp = session.activeMs >= sessionMinutes * 60_000;
  const activeCard = isTimeUp ? null : (queue.find((card) => card.id === activeCardId) ?? queue[0] ?? null);
  const isRevealed = revealedAfterMs !== null;

  useEffect(() => setDueCount(queue.length), [queue.length, setDueCount]);

  const resetCardUi = useCallback(() => {
    setActiveCardId(null);
    setResponseText("");
    setRevealedAfterMs(null);
    setShownAt(Date.now());
    setClock(Date.now());
  }, []);

  const updateSchedule = useCallback((cardId: string, schedule: StoredSchedule) => {
    setCards((current) => current.map((card) => (card.id === cardId ? { ...card, schedule } : card)));
  }, []);

  /** Re-syncs with the server after a failed write. */
  const reload = useCallback(
    async (extra: number) => {
      await reviewChainRef.current.catch(() => undefined);
      const result = await loadPracticeAction(extra);
      if (!result.ok) {
        showToast("error", result.error);
        return;
      }
      setCards(result.data.cards);
      setNewOrder(orderOf(result.data.cards));
      setSummary(result.data.summary);
      resetCardUi();
    },
    [resetCardUi, showToast],
  );

  function reveal() {
    if (!activeCard || isRevealed) return;
    setActiveCardId(activeCard.id);
    setRevealedAfterMs(Date.now() - shownAt);
  }

  /** `response` replaces the typed text (speaking: the transcript). */
  function grade(rating: ReviewRating, responseOverride?: string) {
    const card = activeCard;
    if (!card) return;

    const reviewedAt = new Date();
    const elapsedMs = Math.min(revealedAfterMs ?? reviewedAt.getTime() - shownAt, 30 * 60_000);
    const countedMs = Math.min(reviewedAt.getTime() - shownAt, MAX_COUNTED_CARD_MS);
    const response = (responseOverride ?? responseText).trim();
    const { schedule } = scheduleReview(card.id, card.schedule, rating, reviewedAt);
    const wasCorrect = rating !== "again";

    updateSchedule(card.id, schedule);
    setSession((current) => ({
      ...current,
      reviewed: current.reviewed + 1,
      correct: current.correct + (wasCorrect ? 1 : 0),
      activeMs: current.activeMs + countedMs,
    }));
    markReviewed(countedMs);
    resetCardUi();

    const token = {};
    const serverLogId = reviewChainRef.current
      .catch(() => undefined)
      .then(() => gradeCardAction({
          cardId: card.id,
          rating,
          responseText: response,
          elapsedMs,
          countedMs,
          goalMet: goalMetRef.current,
        }))
      .then((result) => {
        if (!result.ok) throw new Error(result.error);
        if (!undoneRef.current.has(token)) updateSchedule(result.data.cardId, result.data.schedule);
        if (result.data.goal) goalMetRef.current = result.data.goal.met;
        applyGoal(result.data.goal);
        return result.data.logId;
      })
      .catch((error: unknown) => {
        showToast("error", `Оцінку не збережено: ${formatError(error)}`);
        void reload(extraNew);
        return null;
      });

    reviewChainRef.current = serverLogId;
    setLastReview({ cardId: card.id, previousSchedule: card.schedule, wasCorrect, countedMs, serverLogId, token });
  }

  async function undo() {
    const review = lastReview;
    if (!review) return;

    setLastReview(null);
    undoneRef.current.add(review.token);
    updateSchedule(review.cardId, review.previousSchedule);
    markReviewed(-review.countedMs);
    setSession((current) => ({
      ...current,
      reviewed: Math.max(0, current.reviewed - 1),
      correct: Math.max(0, current.correct - (review.wasCorrect ? 1 : 0)),
      activeMs: Math.max(0, current.activeMs - review.countedMs),
    }));
    setActiveCardId(review.cardId);
    setResponseText("");
    setRevealedAfterMs(null);
    setShownAt(Date.now());

    // Serialized with grades: a quick next grade must not reach the server
    // before this undo (it would be rolled back or applied to a stale card).
    const undone = reviewChainRef.current
      .catch(() => undefined)
      .then(async () => {
        const logId = await review.serverLogId;
        if (!logId) return;
        const result = await undoReviewAction(logId, goalMetRef.current);
        if (!result.ok) throw new Error(result.error);
        if (result.data.goal) goalMetRef.current = result.data.goal.met;
        applyGoal(result.data.goal);
      })
      .catch((error: unknown) => {
        showToast("error", `Не вдалося скасувати: ${formatError(error)}`);
        void reload(extraNew);
      });
    reviewChainRef.current = undone;
    await undone;
  }

  /** Hides a card for the rest of this session without rating it. */
  function skip(cardId: string) {
    setSkipped((current) => new Set([...current, cardId]));
    resetCardUi();
  }

  /** Hides every card of these exercises for the rest of the session (AI limit, no microphone). */
  function skipKinds(kinds: CardKind[]) {
    setSkipped((current) => new Set([...current, ...cards.filter((card) => kinds.includes(card.kind)).map((card) => card.id)]));
    resetCardUi();
  }

  async function pause(cardId: string) {
    const card = cards.find((item) => item.id === cardId);
    if (!card) return;
    setCards((current) => current.filter((item) => item.id !== cardId));
    if (lastReview?.cardId === cardId) setLastReview(null);
    resetCardUi();

    const result = await setCardStatusAction(cardId, "paused");
    if (!result.ok) {
      showToast("error", result.error);
      setCards((current) => [...current, card]);
      return;
    }

    showToast("info", "Картку поставлено на паузу.", {
      actionLabel: "Повернути",
      onAction: () => {
        void setCardStatusAction(cardId, "active").then((restore) => {
          if (restore.ok) setCards((current) => (current.some((item) => item.id === cardId) ? current : [...current, card]));
          else showToast("error", restore.error);
        });
      },
    });
  }

  /** Adds `count` more new words beyond today's pace. */
  async function learnMore(count: number) {
    if (isLoadingMore) return;
    const extra = extraNew + count;
    setIsLoadingMore(true);
    try {
      await reviewChainRef.current.catch(() => undefined);
      const result = await loadPracticeAction(extra);
      if (!result.ok) throw new Error(result.error);
      setExtraNew(extra);
      setSummary(result.data.summary);
      const known = new Set(cards.map((card) => card.id));
      const added = result.data.cards.filter((card) => !known.has(card.id));
      setCards((current) => [...current, ...added]);
      setNewOrder((current) => new Map([...current, ...orderOf(added, current.size)]));
      if (isTimeUp) setSessionMinutes((minutes) => minutes + 5);
      resetCardUi();
    } catch (error) {
      showToast("error", formatError(error));
    } finally {
      setIsLoadingMore(false);
    }
  }

  return {
    activeCard,
    queue,
    summary,
    session,
    sessionMinutes,
    isTimeUp,
    responseText,
    isRevealed,
    /** Time from showing the card to checking the answer. */
    revealedAfterMs,
    isLoadingMore,
    canUndo: lastReview !== null,
    heldBackNew: heldBackNew(summary, extraNew),
    nextDue: nextDueAt(cards, now, summary.nextDueAt),
    /** Typing pins the card, so a queue refresh cannot swap it mid-answer. */
    setResponseText: (value: string) => {
      if (activeCard && activeCardId !== activeCard.id) setActiveCardId(activeCard.id);
      setResponseText(value);
    },
    setSessionMinutes,
    extendSession: (minutes: number) => setSessionMinutes((current) => current + minutes),
    reveal,
    grade,
    skip,
    skipKinds,
    undo: () => void undo(),
    pause: (cardId: string) => void pause(cardId),
    learnMore: (count: number) => void learnMore(count),
  };
}

export type PracticeSession = ReturnType<typeof usePracticeSession>;
