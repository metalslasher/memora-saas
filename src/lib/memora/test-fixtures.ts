import { createReviewSchedule, createStoredSchedule } from "./scheduler";
import { starterCards, starterNotes } from "./starter-content";
import type { MemoraState, Note, StudyCard } from "./types";

function id(prefix: string, value: string) {
  return `${prefix}-${value}`;
}

function isoNow() {
  return new Date().toISOString();
}

function note(noteData: Omit<Note, "createdAt" | "status" | "source">): Note {
  return {
    ...noteData,
    status: "active",
    source: "seed",
    createdAt: isoNow(),
  };
}

function card(cardData: Omit<StudyCard, "schedule" | "status">): StudyCard {
  return {
    ...cardData,
    status: "active",
    schedule: createStoredSchedule(new Date()),
  };
}

function scheduledCard(
  cardData: Omit<StudyCard, "schedule" | "status">,
  scheduledDays: number,
): StudyCard {
  return {
    ...cardData,
    status: "active",
    schedule: createReviewSchedule(new Date(), scheduledDays),
  };
}

export function createInitialState(): MemoraState {
  const notes = starterNotes.map((starterNote) =>
    note({
      id: id("note", starterNote.key),
      module: starterNote.module,
      title: starterNote.title,
      tags: starterNote.tags,
      content: starterNote.content,
    }),
  );

  const cards = starterCards.map((starterCard) => {
    const baseCard = {
      id: id("card", starterCard.key),
      noteId: id("note", starterCard.noteKey),
      module: starterCard.module,
      type: starterCard.type,
      priority: starterCard.priority,
      prompt: starterCard.prompt,
      answer: starterCard.answer,
      explanation: starterCard.explanation,
      example: starterCard.example,
      tags: starterCard.tags,
    };

    return starterCard.scheduledDays
      ? scheduledCard(baseCard, starterCard.scheduledDays)
      : card(baseCard);
  });

  return {
    version: 1,
    settings: {
      desiredRetention: 0.9,
      dailyNewLimit: 8,
      reviewButtons: "simple",
      studyMode: "daily",
    },
    notes,
    cards,
    reviewLogs: [],
    imports: [],
  };
}
