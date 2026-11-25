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
 * own words and overrides). The manual form fills translations, part of
 * speech, the first example, accepted variants and synonyms; AI enrichment
 * (`lib/memora/ai/enrichment.ts`) fills the rest except cloze/collocations.
 */
export type WordContent = {
  translations: string[];
  /** Other spellings/forms of the word that count as fully correct ("OK, okay"). */
  accepted?: string[];
  part_of_speech?: string;
  ipa?: string;
  examples: WordExample[];
  collocations?: string[];
  /** English synonyms: accepted in recall, but rated Hard (not the target word). */
  synonyms?: string[];
  cloze?: Array<{ text: string; answer: string }>;
  common_mistakes?: string[];
  /** Short Ukrainian explanation of the meaning (AI). */
  explanation?: string;
  /** Inflected forms ("went", "gone", "going") (AI). */
  forms?: string[];
  cefr?: Cefr;
  /** How common the word is in everyday American English (AI). */
  frequency?: WordFrequency;
};

export const cefrLevels = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type Cefr = (typeof cefrLevels)[number];
export const wordFrequencies = ["high", "medium", "low"] as const;
export type WordFrequency = (typeof wordFrequencies)[number];

/** Fields of the manual "add word" form and CSV rows. */
export type WordDraft = {
  lemma: string;
  /** Ukrainian translations, comma separated. */
  translation: string;
  partOfSpeech?: string;
  example?: string;
  /** Other correct spellings/forms, comma separated. */
  accepted?: string;
  /** English synonyms, comma separated. */
  synonyms?: string;
};

export type Profile = {
  id: string;
  timezone: string;
  dailyMinutes: number;
  goals: string[];
  /** Set when onboarding (test → goals → minutes) is done; the daily feed runs only then. */
  onboardedAt: string | null;
  programRank: number | null;
  knownRank: number | null;
  calibratedAt: string | null;
  /** Vocabulary test result (vocab-test.ts), raw jsonb. */
  levelEstimate: unknown;
  /** "Говоріння": the speak-aloud exercise is served. */
  speakingEnabled: boolean;
  /** Daily push reminder (needs a subscribed device) and its window in local hours: start inclusive, end exclusive. */
  remindersEnabled: boolean;
  reminderStart: number;
  reminderEnd: number;
};

export type PracticeCard = {
  id: string;
  userWordId: string;
  kind: CardKind;
  lemma: string;
  content: WordContent;
  schedule: StoredSchedule;
  /** Latest review of any card of the same word (sibling burying). */
  wordReviewedAt: string | null;
};

export type PracticeSummary = {
  /** Words with a card to review now (one card per word, burying applied). */
  dueWords: number;
  /** Reviews done today (local day), not counting first looks at new words. */
  reviewsToday: number;
  /** Words waiting for their first look. */
  newReady: number;
  /** Words introduced today. */
  newToday: number;
  dailyMinutes: number;
  nextDueAt: string | null;
  activeCards: number;
  /** Start of the learner's local day (ISO). */
  dayStart: string;
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
  /** Exercises this review unlocked on the word. */
  unlocked: CardKind[];
};

export type StreakSummary = {
  /** Current streak (daily goal met; one frozen miss per week). */
  streak: number;
  /** Today's goal is already met. */
  goalMet: boolean;
  /** Local date (YYYY-MM-DD) in the learner's timezone. */
  today: string;
  /** Local dates of the current Monday–Sunday week on which the goal was met. */
  weekDays: string[];
  /** Days of the current week saved by a freeze. */
  frozenDays: string[];
  /** This week's freeze is spent. */
  freezeUsed: boolean;
  /** Counted practice time today, ms. */
  doneMs: number;
  /** The learner's minutes per day. */
  goalMinutes: number;
};

/** Result of re-checking today's daily goal after a review or undo. */
export type GoalSync = {
  met: boolean;
  /** Full streak summary, present only when `met` differs from what the client believed. */
  streak: StreakSummary | null;
};
