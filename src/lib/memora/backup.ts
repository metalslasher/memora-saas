import { readStoredSchedule } from "./scheduler";
import type {
  CardKind,
  CardStatus,
  ReviewRating,
  StoredSchedule,
  WordContent,
  WordSource,
  WordStatus,
} from "./types";
import { cleanText, isRecord, readWordContent } from "./word-content";

export const BACKUP_FORMAT = "memora-backup-v2";

export type BackupReview = {
  rating: ReviewRating;
  reviewed_at: string;
  elapsed_ms: number;
  response_text: string;
  was_correct: boolean;
  schedule_before: StoredSchedule;
  schedule_after: StoredSchedule;
};

export type BackupCard = StoredSchedule & {
  kind: CardKind;
  status: CardStatus;
  reviews: BackupReview[];
};

export type BackupWord = {
  lemma: string;
  source: WordSource;
  status: WordStatus;
  content: WordContent;
  created_at: string;
  cards: BackupCard[];
};

/** Word-level JSON backup. Field names match restore_words_backup(). */
export type BackupDocument = {
  product: "Memora";
  format: typeof BACKUP_FORMAT;
  exportedAt: string;
  words: BackupWord[];
};

export type BackupPreview = {
  exportedAt: string;
  words: number;
  cards: number;
  reviews: number;
};

const MAX_WORDS = 5000;
const MAX_REVIEWS = 100_000;

const wordSources: WordSource[] = ["program", "manual", "text", "import"];
const wordStatuses: WordStatus[] = ["active", "paused", "archived"];
const cardKinds: CardKind[] = ["recognition", "recall", "cloze", "listening", "sentence", "speaking"];
const cardStatuses: CardStatus[] = ["active", "paused"];
const ratings: ReviewRating[] = ["again", "hard", "good", "easy"];

export function createBackupDocument(words: BackupWord[], exportedAt = new Date()): BackupDocument {
  return { product: "Memora", format: BACKUP_FORMAT, exportedAt: exportedAt.toISOString(), words };
}

export function parseBackupJson(raw: string): BackupDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Файл резервної копії не є коректним JSON.");
  }
  return normalizeBackupDocument(parsed);
}

/** Fully validates an untrusted backup before anything is written. */
export function normalizeBackupDocument(value: unknown): BackupDocument {
  if (!isRecord(value) || value.product !== "Memora") {
    throw new Error("Це не резервна копія Memora.");
  }
  if (value.format !== BACKUP_FORMAT) {
    throw new Error("Цей формат копії застарів: підтримуються копії, зроблені після оновлення Memora.");
  }
  const exportedAt = readDate(value.exportedAt, "Резервна копія має некоректну дату експорту.");
  if (!Array.isArray(value.words)) throw new Error("Резервна копія не містить слів.");
  if (value.words.length > MAX_WORDS) {
    throw new Error(`Забагато слів у копії. Ліміт: ${MAX_WORDS}.`);
  }

  const seenLemmas = new Set<string>();
  let reviewCount = 0;
  const words = value.words.map((raw, index) => {
    const word = normalizeWord(raw, index);
    const key = word.lemma.toLowerCase();
    if (seenLemmas.has(key)) throw new Error(`Слово «${word.lemma}» повторюється в копії.`);
    seenLemmas.add(key);
    reviewCount += word.cards.reduce((sum, card) => sum + card.reviews.length, 0);
    if (reviewCount > MAX_REVIEWS) {
      throw new Error(`Забагато повторень у копії. Ліміт: ${MAX_REVIEWS}.`);
    }
    return word;
  });

  return { product: "Memora", format: BACKUP_FORMAT, exportedAt, words };
}

export function previewBackup(backup: BackupDocument): BackupPreview {
  let cards = 0;
  let reviews = 0;
  for (const word of backup.words) {
    cards += word.cards.length;
    for (const card of word.cards) reviews += card.reviews.length;
  }
  return { exportedAt: backup.exportedAt, words: backup.words.length, cards, reviews };
}

function normalizeWord(value: unknown, index: number): BackupWord {
  const label = `Слово #${index + 1}`;
  if (!isRecord(value)) throw new Error(`${label} має некоректний формат.`);
  const lemma = cleanText(value.lemma);
  if (!lemma || lemma.length > 200) throw new Error(`${label} не має коректного англійського слова.`);
  const content = readWordContent(value.content);
  if (content.translations.length === 0) throw new Error(`Слово «${lemma}» не має перекладу.`);

  if (!Array.isArray(value.cards)) throw new Error(`Слово «${lemma}» не має списку карток.`);
  const kinds = new Set<CardKind>();
  const cards = value.cards.map((raw) => {
    const card = normalizeCard(raw, lemma);
    if (kinds.has(card.kind)) throw new Error(`Слово «${lemma}» має дві однакові картки.`);
    kinds.add(card.kind);
    return card;
  });

  return {
    lemma,
    source: readEnum(value.source, wordSources, `Слово «${lemma}» має невідоме джерело.`),
    status: readEnum(value.status, wordStatuses, `Слово «${lemma}» має невідомий статус.`),
    content,
    created_at: readDate(value.created_at, `Слово «${lemma}» має некоректну дату.`),
    cards,
  };
}

function normalizeCard(value: unknown, lemma: string): BackupCard {
  const label = `Картка слова «${lemma}»`;
  if (!isRecord(value)) throw new Error(`${label} має некоректний формат.`);
  const schedule = readStoredSchedule(value);
  if (!schedule) throw new Error(`${label} має некоректний розклад.`);
  if (!Array.isArray(value.reviews)) throw new Error(`${label} не має історії повторень.`);

  return {
    ...schedule,
    kind: readEnum(value.kind, cardKinds, `${label} має невідомий тип.`),
    status: readEnum(value.status, cardStatuses, `${label} має невідомий статус.`),
    reviews: value.reviews.map((raw) => normalizeReview(raw, label)),
  };
}

function normalizeReview(value: unknown, label: string): BackupReview {
  if (!isRecord(value)) throw new Error(`${label}: некоректне повторення.`);
  const before = readStoredSchedule(value.schedule_before);
  const after = readStoredSchedule(value.schedule_after);
  if (!before || !after) throw new Error(`${label}: повторення без розкладу.`);
  const elapsed = Number(value.elapsed_ms);

  return {
    rating: readEnum(value.rating, ratings, `${label}: невідома оцінка.`),
    reviewed_at: readDate(value.reviewed_at, `${label}: некоректна дата повторення.`),
    elapsed_ms: Number.isFinite(elapsed) && elapsed >= 0 ? Math.round(elapsed) : 0,
    response_text: typeof value.response_text === "string" ? value.response_text.slice(0, 2000) : "",
    was_correct: value.was_correct === true,
    schedule_before: before,
    schedule_after: after,
  };
}

function readEnum<T extends string>(value: unknown, allowed: readonly T[], message: string): T {
  if (typeof value === "string" && allowed.includes(value as T)) return value as T;
  throw new Error(message);
}

function readDate(value: unknown, message: string) {
  if (typeof value === "string" && Number.isFinite(Date.parse(value))) return value;
  throw new Error(message);
}
