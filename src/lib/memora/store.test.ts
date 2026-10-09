import { describe, expect, it } from "vitest";
import { createInitialState } from "./seed";
import {
  addEnglishNote,
  countHeldBackNew,
  countNewIntroducedToday,
  getDueQueue,
  remainingNewToday,
  summarizeState,
  suspendCard,
} from "./store";

describe("store queue helpers", () => {
  it("orders due review cards before new cards", () => {
    const state = createInitialState();
    const queue = getDueQueue(
      state,
      "daily",
      new Date(Date.now() + 60 * 60 * 1000),
    );

    const firstNewIndex = queue.findIndex((card) => card.schedule.reps === 0);
    const lastReviewIndex = queue.findLastIndex((card) => card.schedule.reps > 0);

    expect(queue.length).toBeGreaterThan(0);
    expect(firstNewIndex).toBeGreaterThan(0);
    expect(lastReviewIndex).toBeLessThan(firstNewIndex);
  });

  it("filters suspended cards out of the due queue", () => {
    const state = createInitialState();
    const cardId = state.cards[0].id;
    const nextState = suspendCard(state, cardId);

    expect(
      getDueQueue(nextState, "daily", new Date(Date.now() + 60 * 60 * 1000)).some(
        (card) => card.id === cardId,
      ),
    ).toBe(false);
  });

  it("adds English notes through the shared generator", () => {
    const state = createInitialState();
    const nextState = addEnglishNote(state, {
      lemma: " flaky   test ",
      translation: " нестабільний тест ",
      example: " This flaky test fails only in CI. ",
    });
    const addedNote = nextState.notes.at(-1);
    const addedCards = nextState.cards.filter(
      (card) => card.noteId === addedNote?.id,
    );

    expect(addedNote).toMatchObject({
      title: "flaky test",
      content: {
        lemma_en: "flaky test",
        translation_uk: "нестабільний тест",
      },
    });
    expect(addedCards.map((card) => card.type)).toEqual([
      "productive_translation",
      "receptive_translation",
    ]);
    expect(addedCards[0].prompt).toBe(
      "Як сказати англійською: нестабільний тест?",
    );
  });

  it("caps new cards by the daily limit and counts what is held back", () => {
    const base = createInitialState();
    const now = new Date(Date.now() + 60 * 60 * 1000);
    const state = { ...base, settings: { ...base.settings, dailyNewLimit: 1 } };
    const readyNew = getDueQueue(
      { ...base, settings: { ...base.settings, dailyNewLimit: 50 } },
      "daily",
      now,
    ).filter((card) => card.schedule.reps === 0).length;

    const queue = getDueQueue(state, "daily", now);
    expect(queue.filter((card) => card.schedule.reps === 0)).toHaveLength(1);
    expect(countHeldBackNew(state, "daily", now)).toBe(readyNew - 1);

    const extended = getDueQueue(state, "daily", now, { extraNew: 1 });
    expect(extended.filter((card) => card.schedule.reps === 0)).toHaveLength(2);
  });

  it("subtracts cards first reviewed today from the new-card allowance", () => {
    const base = createInitialState();
    const now = new Date(Date.now() + 60 * 60 * 1000);
    const newCard = base.cards.find((card) => card.schedule.reps === 0)!;
    const state = {
      ...base,
      settings: { ...base.settings, dailyNewLimit: 2 },
      reviewLogs: [
        {
          id: "log-1",
          cardId: newCard.id,
          noteId: newCard.noteId,
          module: newCard.module,
          rating: "good" as const,
          responseText: "x",
          elapsedMs: 1000,
          reviewedAt: new Date(now.getTime() - 1000).toISOString(),
          dueBefore: newCard.schedule.due,
          dueAfter: now.toISOString(),
          wasCorrect: true,
        },
      ],
    };

    expect(countNewIntroducedToday(state, now)).toBe(1);
    expect(remainingNewToday(state, now)).toBe(1);
  });

  it("puts every English card into the English mode", () => {
    const state = createInitialState();
    const englishCards = state.cards.filter(
      (card) => card.module === "english" && card.status === "active",
    );
    const queue = getDueQueue(
      { ...state, settings: { ...state.settings, dailyNewLimit: 50 } },
      "english-productive",
      new Date(Date.now() + 60 * 60 * 1000),
    );

    expect(queue.every((card) => card.module === "english")).toBe(true);
    expect(queue).toHaveLength(englishCards.length);
  });

  it("summarizes due cards and empty retention safely", () => {
    const state = createInitialState();
    const summary = summarizeState(state, new Date(Date.now() + 60 * 60 * 1000));

    expect(summary.totalDue).toBeGreaterThan(0);
    expect(summary.dueReviews).toBeGreaterThan(0);
    expect(summary.newAvailable).toBeGreaterThan(0);
    expect(summary.retention).toBeNull();
  });
});
