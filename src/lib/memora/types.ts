export type ModuleType = "english" | "qa";

export type StudyMode = "daily" | "english-productive" | "qa-interview";

export type CardType =
  | "productive_translation"
  | "receptive_translation"
  | "cloze_context"
  | "collocation_recall"
  | "term_definition"
  | "definition_term"
  | "contrast"
  | "scenario"
  | "code_tool";

export type ReviewRating = "again" | "hard" | "good" | "easy";

export type FsrsState = "New" | "Learning" | "Review" | "Relearning";

export type NoteStatus = "active" | "suspended" | "archived";

export type ImportStatus =
  | "uploaded"
  | "validating"
  | "ready"
  | "processing"
  | "completed"
  | "failed";

export type ImportRowStatus = "valid" | "invalid" | "imported" | "skipped";

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
  last_review?: string | null;
};

export type Note = {
  id: string;
  module: ModuleType;
  title: string;
  status: NoteStatus;
  source: "seed" | "user" | "imported";
  tags: string[];
  content: Record<string, string | string[] | undefined>;
  createdAt: string;
};

export type StudyCard = {
  id: string;
  noteId: string;
  module: ModuleType;
  type: CardType;
  priority: number;
  prompt: string;
  answer: string;
  explanation: string;
  example?: string;
  tags: string[];
  schedule: StoredSchedule;
  status: NoteStatus;
};

export type ReviewLog = {
  id: string;
  cardId: string;
  noteId: string;
  module: ModuleType;
  rating: ReviewRating;
  responseText: string;
  elapsedMs: number;
  reviewedAt: string;
  dueBefore: string;
  dueAfter: string;
  wasCorrect: boolean;
};

export type ImportRow = {
  id: string;
  importId: string;
  rowNumber: number;
  status: ImportRowStatus;
  errors: string[];
  raw: Record<string, unknown>;
  module?: ModuleType;
  createdAt: string;
};

export type ImportRun = {
  id: string;
  fileName: string;
  status: ImportStatus;
  rowCount: number;
  createdAt: string;
  updatedAt: string;
  rows: ImportRow[];
};

export type UserProfile = {
  id: string;
  email: string | null;
  locale: string;
  timezone: string;
  level: string;
  goals: {
    dailyMinutes: number;
    primaryGoal: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type UserProfileDraft = {
  locale: string;
  timezone: string;
  level: string;
  dailyMinutes: number;
  primaryGoal: string;
};

export type AppSettings = {
  desiredRetention: number;
  dailyNewLimit: number;
  reviewButtons: "simple" | "advanced";
  studyMode: StudyMode;
};

export type MemoraState = {
  version: 1;
  settings: AppSettings;
  notes: Note[];
  cards: StudyCard[];
  reviewLogs: ReviewLog[];
  imports: ImportRun[];
};

export type QueueSummary = {
  dueReviews: number;
  newAvailable: number;
  totalDue: number;
  estimatedMinutes: number;
  retention: number | null;
  desiredRetentionGap: number | null;
  lapses: number;
  matureCards: number;
  leeches: number;
};
