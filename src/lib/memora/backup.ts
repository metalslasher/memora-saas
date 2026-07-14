import type {
  AppSettings,
  CardType,
  FsrsState,
  ImportRow,
  ImportRowStatus,
  ImportRun,
  ImportStatus,
  MemoraState,
  ModuleType,
  Note,
  NoteStatus,
  ReviewLog,
  ReviewRating,
  StoredSchedule,
  StudyCard,
  StudyMode,
} from "./types";

export type BackupDocument = {
  product: "Memora";
  format: "memora-backup-v1";
  exportedAt: string;
  state: MemoraState;
};

export type BackupPreview = {
  exportedAt: string;
  notes: number;
  cards: number;
  reviewLogs: number;
  imports: number;
  englishNotes: number;
  qaNotes: number;
};

const maxNotes = 5000;
const maxCards = 25000;
const maxReviewLogs = 100000;
const maxImports = 500;
const maxImportRows = 50000;

const modules = ["english", "qa"] as const satisfies ModuleType[];
const noteStatuses = ["active", "suspended", "archived"] as const satisfies NoteStatus[];
const sources = ["seed", "user", "imported"] as const satisfies Note["source"][];
const studyModes = ["daily", "english-productive", "qa-interview"] as const satisfies StudyMode[];
const reviewButtons = ["simple", "advanced"] as const satisfies AppSettings["reviewButtons"][];
const fsrsStates = ["New", "Learning", "Review", "Relearning"] as const satisfies FsrsState[];
const cardTypes = [
  "productive_translation",
  "receptive_translation",
  "cloze_context",
  "collocation_recall",
  "term_definition",
  "definition_term",
  "contrast",
  "scenario",
  "code_tool",
] as const satisfies CardType[];
const reviewRatings = ["again", "hard", "good", "easy"] as const satisfies ReviewRating[];
const importStatuses = [
  "uploaded",
  "validating",
  "ready",
  "processing",
  "completed",
  "failed",
] as const satisfies ImportStatus[];
const importRowStatuses = ["valid", "invalid", "imported", "skipped"] as const satisfies ImportRowStatus[];

export function parseBackupJson(raw: string): BackupDocument {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Файл резервної копії не є валідним JSON.");
  }

  return normalizeBackupDocument(parsed);
}

export function normalizeBackupDocument(value: unknown): BackupDocument {
  const backup = readRecord(value, "Резервна копія має бути JSON-об'єктом.");
  const product = readText(backup.product);
  const format = readText(backup.format);
  const exportedAt = readText(backup.exportedAt);

  if (product !== "Memora" || format !== "memora-backup-v1") {
    throw new Error("Це не резервна копія Memora або формат файлу застарілий.");
  }

  if (!isIsoDate(exportedAt)) {
    throw new Error("Резервна копія має некоректну дату експорту.");
  }

  return {
    product: "Memora",
    format: "memora-backup-v1",
    exportedAt,
    state: normalizeBackupState(backup.state),
  };
}

export function previewBackup(backup: BackupDocument): BackupPreview {
  return {
    exportedAt: backup.exportedAt,
    notes: backup.state.notes.length,
    cards: backup.state.cards.length,
    reviewLogs: backup.state.reviewLogs.length,
    imports: backup.state.imports.length,
    englishNotes: backup.state.notes.filter((note) => note.module === "english").length,
    qaNotes: backup.state.notes.filter((note) => note.module === "qa").length,
  };
}

export function normalizeBackupState(value: unknown): MemoraState {
  const state = readRecord(value, "Резервна копія не містить дані Memora.");

  if (state.version !== 1) {
    throw new Error("Підтримується тільки резервна копія Memora версії 1.");
  }

  const notes = readArray(state.notes, "Резервна копія не містить матеріали.")
    .slice(0, maxNotes + 1)
    .map(normalizeNote);
  const cards = readArray(state.cards, "Резервна копія не містить картки.")
    .slice(0, maxCards + 1)
    .map(normalizeCard);
  const reviewLogs = readArray(state.reviewLogs, "Резервна копія не містить історію повторень.")
    .slice(0, maxReviewLogs + 1)
    .map(normalizeReviewLog);
  const imports = readArray(state.imports, "Резервна копія не містить історію імпортів.")
    .slice(0, maxImports + 1)
    .map(normalizeImportRun);

  if (notes.length > maxNotes) {
    throw new Error(`Резервна копія містить забагато матеріалів. Ліміт: ${maxNotes}.`);
  }

  if (cards.length > maxCards) {
    throw new Error(`Резервна копія містить забагато карток. Ліміт: ${maxCards}.`);
  }

  if (reviewLogs.length > maxReviewLogs) {
    throw new Error(`Резервна копія містить забагато повторень. Ліміт: ${maxReviewLogs}.`);
  }

  if (imports.length > maxImports) {
    throw new Error(`Резервна копія містить забагато імпортів. Ліміт: ${maxImports}.`);
  }

  validateUniqueIds(notes, "матеріалів");
  validateUniqueIds(cards, "карток");
  validateUniqueIds(reviewLogs, "повторень");
  validateReferences(notes, cards, reviewLogs);

  return {
    version: 1,
    settings: normalizeSettings(state.settings),
    notes,
    cards,
    reviewLogs,
    imports,
  };
}

function normalizeSettings(value: unknown): AppSettings {
  const settings = isRecord(value) ? value : {};
  const desiredRetention = readNumber(settings.desiredRetention, 0.9);
  const dailyNewLimit = readNumber(settings.dailyNewLimit, 8);
  const studyMode = readEnum(settings.studyMode, studyModes, "daily");
  const buttons = readEnum(settings.reviewButtons, reviewButtons, "simple");

  return {
    desiredRetention:
      desiredRetention > 0 && desiredRetention <= 1 ? desiredRetention : 0.9,
    dailyNewLimit:
      Number.isFinite(dailyNewLimit) && dailyNewLimit >= 0
        ? Math.min(100, Math.round(dailyNewLimit))
        : 8,
    reviewButtons: buttons,
    studyMode,
  };
}

function normalizeNote(value: unknown, index: number): Note {
  const note = readRecord(value, `Матеріал #${index + 1} має некоректний формат.`);
  const moduleType = readEnum(note.module, modules, undefined);
  const id = requiredText(note.id, `Матеріал #${index + 1} не має id.`);
  const content = normalizeContent(note.content);
  const fallbackTitle =
    moduleType === "english"
      ? readText(content.lemma_en)
      : readText(content.term);

  return {
    id,
    module: moduleType,
    title: readText(note.title) || fallbackTitle || "Матеріал без назви",
    status: readEnum(note.status, noteStatuses, "active"),
    source: readEnum(note.source, sources, "user"),
    tags: normalizeStringArray(note.tags, 30),
    content,
    createdAt: normalizeIsoDate(note.createdAt, `Матеріал "${id}" має некоректну дату створення.`),
  };
}

function normalizeCard(value: unknown, index: number): StudyCard {
  const card = readRecord(value, `Картка #${index + 1} має некоректний формат.`);
  const id = requiredText(card.id, `Картка #${index + 1} не має id.`);

  return {
    id,
    noteId: requiredText(card.noteId, `Картка "${id}" не має noteId.`),
    module: readEnum(card.module, modules, "english"),
    type: readEnum(card.type, cardTypes, "term_definition"),
    priority: Math.min(100, Math.max(0, Math.round(readNumber(card.priority, 50)))),
    prompt: requiredText(card.prompt, `Картка "${id}" не має prompt.`),
    answer: requiredText(card.answer, `Картка "${id}" не має answer.`),
    explanation: readText(card.explanation),
    example: optionalText(card.example),
    tags: normalizeStringArray(card.tags, 30),
    schedule: normalizeSchedule(card.schedule, id),
    status: readEnum(card.status, noteStatuses, "active"),
  };
}

function normalizeSchedule(value: unknown, cardId: string): StoredSchedule {
  const schedule = readRecord(value, `Картка "${cardId}" має некоректний розклад.`);

  return {
    due: normalizeIsoDate(schedule.due, `Картка "${cardId}" має некоректну дату due.`),
    stability: Math.max(0, readNumber(schedule.stability, 0)),
    difficulty: Math.max(0, readNumber(schedule.difficulty, 0)),
    elapsed_days: Math.max(0, Math.round(readNumber(schedule.elapsed_days, 0))),
    scheduled_days: Math.max(0, Math.round(readNumber(schedule.scheduled_days, 0))),
    learning_steps: Math.max(0, Math.round(readNumber(schedule.learning_steps, 0))),
    reps: Math.max(0, Math.round(readNumber(schedule.reps, 0))),
    lapses: Math.max(0, Math.round(readNumber(schedule.lapses, 0))),
    state: readEnum(schedule.state, fsrsStates, "New"),
    last_review:
      schedule.last_review == null || schedule.last_review === ""
        ? null
        : normalizeIsoDate(
            schedule.last_review,
            `Картка "${cardId}" має некоректну дату last_review.`,
          ),
  };
}

function normalizeReviewLog(value: unknown, index: number): ReviewLog {
  const log = readRecord(value, `Повторення #${index + 1} має некоректний формат.`);
  const id = requiredText(log.id, `Повторення #${index + 1} не має id.`);

  return {
    id,
    cardId: requiredText(log.cardId, `Повторення "${id}" не має cardId.`),
    noteId: requiredText(log.noteId, `Повторення "${id}" не має noteId.`),
    module: readEnum(log.module, modules, "english"),
    rating: readEnum(log.rating, reviewRatings, "good"),
    responseText: readText(log.responseText),
    elapsedMs: Math.max(0, Math.round(readNumber(log.elapsedMs, 0))),
    reviewedAt: normalizeIsoDate(log.reviewedAt, `Повторення "${id}" має некоректну дату.`),
    dueBefore: normalizeOptionalIsoDate(log.dueBefore),
    dueAfter: normalizeOptionalIsoDate(log.dueAfter),
    wasCorrect: Boolean(log.wasCorrect),
  };
}

function normalizeImportRun(value: unknown, index: number): ImportRun {
  const run = readRecord(value, `Імпорт #${index + 1} має некоректний формат.`);
  const id = requiredText(run.id, `Імпорт #${index + 1} не має id.`);
  const rows = readArray(run.rows, "Імпорт містить некоректні рядки.")
    .slice(0, maxImportRows + 1)
    .map((row, rowIndex) => normalizeImportRow(row, id, rowIndex));

  if (rows.length > maxImportRows) {
    throw new Error(`Резервна копія містить забагато рядків імпорту. Ліміт: ${maxImportRows}.`);
  }

  return {
    id,
    fileName: readText(run.fileName).slice(0, 240) || "import.csv",
    status: readEnum(run.status, importStatuses, "completed"),
    rowCount: Math.max(0, Math.round(readNumber(run.rowCount, rows.length))),
    createdAt: normalizeIsoDate(run.createdAt, `Імпорт "${id}" має некоректну дату створення.`),
    updatedAt: normalizeIsoDate(run.updatedAt, `Імпорт "${id}" має некоректну дату оновлення.`),
    rows,
  };
}

function normalizeImportRow(value: unknown, importId: string, index: number): ImportRow {
  const row = readRecord(value, `Рядок імпорту #${index + 1} має некоректний формат.`);

  return {
    id: requiredText(row.id, `Рядок імпорту #${index + 1} не має id.`),
    importId: readText(row.importId) || importId,
    rowNumber: Math.max(1, Math.round(readNumber(row.rowNumber, index + 1))),
    status: readEnum(row.status, importRowStatuses, "imported"),
    errors: normalizeStringArray(row.errors, 20),
    raw: normalizeJsonRecord(row.raw),
    module:
      row.module === "english" || row.module === "qa"
        ? row.module
        : undefined,
    createdAt: normalizeIsoDate(row.createdAt, `Рядок імпорту #${index + 1} має некоректну дату.`),
  };
}

function validateUniqueIds(items: Array<{ id: string }>, label: string) {
  const ids = new Set<string>();

  for (const item of items) {
    if (ids.has(item.id)) {
      throw new Error(`Резервна копія має повторений id серед ${label}: ${item.id}.`);
    }

    ids.add(item.id);
  }
}

function validateReferences(notes: Note[], cards: StudyCard[], reviewLogs: ReviewLog[]) {
  const noteById = new Map(notes.map((note) => [note.id, note]));
  const cardById = new Map(cards.map((card) => [card.id, card]));

  for (const card of cards) {
    const note = noteById.get(card.noteId);
    if (!note) {
      throw new Error(`Картка "${card.id}" посилається на неіснуючий матеріал.`);
    }

    card.module = note.module;
  }

  for (const log of reviewLogs) {
    const card = cardById.get(log.cardId);
    const note = noteById.get(log.noteId);

    if (!card || !note) {
      throw new Error(`Повторення "${log.id}" посилається на неіснуючу картку або матеріал.`);
    }

    if (card.noteId !== note.id) {
      throw new Error(`Повторення "${log.id}" має неузгоджені cardId/noteId.`);
    }

    log.module = note.module;
  }
}

function normalizeContent(value: unknown): Note["content"] {
  const content = readRecord(value, "Матеріал має некоректний вміст.");
  const normalized: Note["content"] = {};

  for (const [key, raw] of Object.entries(content)) {
    if (typeof raw === "string") {
      normalized[key] = raw.trim().slice(0, 10000);
    } else if (Array.isArray(raw)) {
      normalized[key] = raw
        .filter((item) => typeof item === "string")
        .map((item) => item.trim().slice(0, 1000))
        .filter(Boolean)
        .slice(0, 50);
    }
  }

  return normalized;
}

function normalizeJsonRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) return {};

  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function normalizeStringArray(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim().slice(0, 120))
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeIsoDate(value: unknown, message: string): string {
  const text = readText(value);

  if (!isIsoDate(text)) {
    throw new Error(message);
  }

  return text;
}

function normalizeOptionalIsoDate(value: unknown): string {
  if (value == null || value === "") return "";

  const text = readText(value);
  return isIsoDate(text) ? text : "";
}

function readRecord(value: unknown, message: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(message);
  }

  return value;
}

function readArray(value: unknown, message: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(message);
  }

  return value;
}

function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(value: unknown): string | undefined {
  const text = readText(value);
  return text ? text : undefined;
}

function requiredText(value: unknown, message: string): string {
  const text = readText(value);

  if (!text) {
    throw new Error(message);
  }

  return text;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readEnum<TValue extends string>(
  value: unknown,
  values: readonly TValue[],
  fallback: TValue | undefined,
): TValue {
  if (typeof value === "string" && values.includes(value as TValue)) {
    return value as TValue;
  }

  if (fallback) return fallback;

  throw new Error("Резервна копія містить невідомий статус або тип.");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoDate(value: string) {
  return value.length > 0 && Number.isFinite(new Date(value).getTime());
}
