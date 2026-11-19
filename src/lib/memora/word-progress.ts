import type { CardStatus, FsrsState, WordProgressLevel } from "./types";

type CardProgressInput = {
  status: CardStatus;
  reps: number;
  scheduled_days: number;
  state: FsrsState;
};

/** Coarse progress of a word from its active cards (weakest card wins). */
export function wordProgress(cards: CardProgressInput[]): { label: string; level: WordProgressLevel } {
  const active = cards.filter((card) => card.status === "active");
  if (active.length === 0) return { label: "—", level: 0 };
  if (active.every((card) => card.reps === 0)) return { label: "нове", level: 0 };
  const minDays = Math.min(...active.map((card) => card.scheduled_days));
  if (minDays >= 21) return { label: "закріплено", level: 3 };
  if (minDays >= 3) return { label: "вчиться", level: 2 };
  return { label: "початок", level: 1 };
}

export type CardStage = "new" | "learning" | "young" | "mature";

/** Same buckets as get_progress_stats(). */
export function cardStage(card: Pick<CardProgressInput, "reps" | "state" | "scheduled_days">): CardStage {
  if (card.reps === 0) return "new";
  if (card.state === "Learning" || card.state === "Relearning") return "learning";
  return card.scheduled_days >= 21 ? "mature" : "young";
}
