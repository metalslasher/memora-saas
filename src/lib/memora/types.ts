import type { Database } from "@/lib/supabase/database.types";

type Enums = Database["public"]["Enums"];

export type CardKind = Enums["card_kind"];
export type CardStatus = Enums["card_status"];
export type WordSource = Enums["word_source"];
export type WordStatus = Enums["word_status"];
export type ReviewRating = Enums["review_rating"];
export type FsrsState = Enums["card_state"];

/** FSRS state of one card, stored column-by-column in `cards`. */
export type StoredSchedule = {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: FsrsState;
  last_review: string | null;
};

export type WordExample = {
  en: string;
  uk?: string;
};

/**
 * Learning content of a word. The same shape is used by `lexicon.content`
 * (shared, AI-enriched from batch 3) and `user_words.content` (the learner's
 * own words and overrides). Only `translations` and `examples` are filled by
 * the manual form today; the rest is reserved for enrichment.
 */
export type WordContent = {
  translations: string[];
  part_of_speech?: string;
  ipa?: string;
  examples: WordExample[];
  collocations?: string[];
  synonyms?: string[];
  cloze?: Array<{ text: string; answer: string }>;
  common_mistakes?: string[];
};

/** Fields of the manual "add word" form and CSV rows. */
export type WordDraft = {
  lemma: string;
  /** Ukrainian translations, comma separated. */
  translation: string;
  partOfSpeech?: string;
  example?: string;
};

/** Temporary knobs stored in `profiles.settings` until batch 2. */
export type LearningSettings = {
  dailyNewLimit: number;
  reviewButtons: "simple" | "advanced";
};

export type Profile = {
  id: string;
  timezone: string;
  dailyMinutes: number;
  goals: string[];
  settings: LearningSettings;
};

export type PracticeCard = {
  id: string;
  userWordId: string;
  kind: CardKind;
  lemma: string;
  content: WordContent;
  schedule: StoredSchedule;
};

export type PracticeSummary = {
  dueReviews: number;
  newReady: number;
  newToday: number;
  dailyNewLimit: number;
  nextDueAt: string | null;
  activeCards: number;
};

export type WordProgressLevel = 0 | 1 | 2 | 3;

export type WordListItem = {
  id: string;
  lemma: string;
  translation: string;
  status: WordStatus;
  source: WordSource;
  createdAt: string;
  progress: { label: string; level: WordProgressLevel };
  maxLapses: number;
};

export type WordCard = {
  id: string;
  kind: CardKind;
  status: CardStatus;
  schedule: StoredSchedule;
};

export type WordDetail = {
  id: string;
  lemma: string;
  status: WordStatus;
  source: WordSource;
  content: WordContent;
  createdAt: string;
  cards: WordCard[];
  reviews: { total: number; correct: number };
};

export type ReviewOutcome = {
  cardId: string;
  schedule: StoredSchedule;
  logId: string;
};

export type StreakSummary = {
  streak: number;
  reviewedToday: boolean;
  /** Local date (YYYY-MM-DD) in the learner's timezone. */
  today: string;
  /** Local dates of the current Monday–Sunday week with reviews. */
  weekDays: string[];
};
