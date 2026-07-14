import { describe, expect, it } from "vitest";
import { createInitialState } from "./seed";
import { addEnglishNote, getDueQueue, summarizeState, suspendCard } from "./store";

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

  it("summarizes due cards and empty retention safely", () => {
    const state = createInitialState();
    const summary = summarizeState(state, new Date(Date.now() + 60 * 60 * 1000));

    expect(summary.totalDue).toBeGreaterThan(0);
    expect(summary.dueReviews).toBeGreaterThan(0);
    expect(summary.newAvailable).toBeGreaterThan(0);
    expect(summary.retention).toBeNull();
  });
});
