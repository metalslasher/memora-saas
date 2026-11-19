"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  gradeCardAction,
  loadPracticeAction,
  setCardStatusAction,
  undoReviewAction,
} from "@/lib/memora/actions/practice";
import { buildPracticeQueue, heldBackNew, nextDueAt } from "@/lib/memora/queue";
import { scheduleReview } from "@/lib/memora/scheduler";
import type { PracticeCard, PracticeSummary, ReviewRating, StoredSchedule } from "@/lib/memora/types";
import { useShell } from "../app-shell";
import { formatError } from "../utils";

export type SessionStats = { reviewed: number; correct: number; startedAt: number };

type LastReview = {
  cardId: string;
  previousSchedule: StoredSchedule;
  wasCorrect: boolean;
  /** Resolves to the server log id, or null when the write failed. */
  serverLogId: Promise<string | null>;
};

function orderOf(cards: PracticeCard[], offset = 0) {
  return new Map(cards.map((card, index) => [card.id, offset + index]));
}

/**
 * Client state of one practice session: the cards it holds, optimistic
 * grading (the next card appears instantly, server writes run in an ordered
 * background chain), undo, pause and "more new cards".
 */
export function usePracticeSession(initialCards: PracticeCard[], initialSummary: PracticeSummary) {
  const { showToast, setDueCount, markReviewed } = useShell();
  const [cards, setCards] = useState(initialCards);
  const [newOrder, setNewOrder] = useState(() => orderOf(initialCards));
  const [summary, setSummary] = useState(initialSummary);
  const [extraNew, setExtraNew] = useState(0);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [isRevealed, setIsRevealed] = useState(false);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [session, setSession] = useState<SessionStats>(() => ({ reviewed: 0, correct: 0, startedAt: Date.now() }));
  const [lastReview, setLastReview] = useState<LastReview | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const reviewChainRef = useRef<Promise<unknown>>(Promise.resolve());

  // Re-evaluate the queue every minute so learning steps come back on time.
  useEffect(() => {
    const interval = window.setInterval(() => setClock(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const now = useMemo(() => new Date(clock), [clock]);
  const queue = useMemo(() => buildPracticeQueue(cards, now, newOrder), [cards, newOrder, now]);
  const activeCard = queue.find((card) => card.id === activeCardId) ?? queue[0] ?? null;

  useEffect(() => setDueCount(queue.length), [queue.length, setDueCount]);

  const resetCardUi = useCallback(() => {
    setActiveCardId(null);
    setResponseText("");
    setIsRevealed(false);
    setStartedAt(Date.now());
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

  function grade(rating: ReviewRating) {
    const card = activeCard;
    if (!card) return;

    const reviewedAt = new Date();
    const elapsedMs = Math.min(reviewedAt.getTime() - startedAt, 30 * 60_000);
    const response = responseText.trim();
    const { schedule } = scheduleReview(card.schedule, rating, reviewedAt);
    const wasCorrect = rating !== "again";

    updateSchedule(card.id, schedule);
    setSession((current) => ({
      ...current,
      reviewed: current.reviewed + 1,
      correct: current.correct + (wasCorrect ? 1 : 0),
    }));
    markReviewed();
    resetCardUi();

    const serverLogId = reviewChainRef.current
      .catch(() => undefined)
      .then(() => gradeCardAction({ cardId: card.id, rating, responseText: response, elapsedMs }))
      .then((result) => {
        if (!result.ok) throw new Error(result.error);
        updateSchedule(result.data.cardId, result.data.schedule);
        return result.data.logId;
      })
      .catch((error: unknown) => {
        showToast("error", `Оцінку не збережено: ${formatError(error)}`);
        void reload(extraNew);
        return null;
      });

    reviewChainRef.current = serverLogId;
    setLastReview({ cardId: card.id, previousSchedule: card.schedule, wasCorrect, serverLogId });
  }

  async function undo() {
    const review = lastReview;
    if (!review) return;

    setLastReview(null);
    updateSchedule(review.cardId, review.previousSchedule);
    setSession((current) => ({
      ...current,
      reviewed: Math.max(0, current.reviewed - 1),
      correct: Math.max(0, current.correct - (review.wasCorrect ? 1 : 0)),
    }));
    setActiveCardId(review.cardId);
    setResponseText("");
    setIsRevealed(false);
    setStartedAt(Date.now());

    const logId = await review.serverLogId;
    if (!logId) return;
    const result = await undoReviewAction(logId);
    if (!result.ok) {
      showToast("error", `Не вдалося скасувати: ${result.error}`);
      void reload(extraNew);
    }
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

  /** Adds `count` more new cards beyond today's limit. */
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
    responseText,
    isRevealed,
    isLoadingMore,
    canUndo: lastReview !== null,
    heldBackNew: heldBackNew(summary, extraNew),
    nextDue: nextDueAt(cards, now, summary.nextDueAt),
    setResponseText,
    reveal: () => setIsRevealed(true),
    grade,
    undo: () => void undo(),
    pause: (cardId: string) => void pause(cardId),
    learnMore: (count: number) => void learnMore(count),
  };
}

export type PracticeSession = ReturnType<typeof usePracticeSession>;
