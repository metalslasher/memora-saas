import { getDueQueue } from "@/lib/memora/store";
import type {
  ImportRun,
  MemoraState,
  ModuleType,
  Note,
  ReviewLog,
  ReviewRating,
  StudyCard,
  UserProfile,
} from "@/lib/memora/types";
import type { ItemStatus } from "./types";

export function formatError(error: unknown) {
  if (error instanceof Error) return error.message;

  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message?: unknown }).message ?? "Невідома помилка.");
  }

  return "Щось пішло не так. Спробуй ще раз.";
}

export function unwrapActionState(result: {
  ok: true;
  state: MemoraState;
} | {
  ok: false;
  error: string;
}) {
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

export function unwrapProfile(result: {
  ok: true;
  profile: UserProfile;
} | {
  ok: false;
  error: string;
}) {
  if (!result.ok) throw new Error(result.error);
  return result.profile;
}

export function getPracticeQueueLength(state: MemoraState) {
  return getDueQueue(state, state.settings.studyMode).length;
}

export function reviewsInLastDays(logs: ReviewLog[], days: number) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return logs.filter((log) => new Date(log.reviewedAt).getTime() >= cutoff);
}

export function reviewAccuracy(logs: ReviewLog[]) {
  if (logs.length === 0) return null;
  return logs.filter((log) => log.wasCorrect).length / logs.length;
}

export function getWeakCards(state: MemoraState) {
  const recentlyFailedCardIds = new Set(
    state.reviewLogs
      .filter((log) => !log.wasCorrect)
      .slice(-30)
      .map((log) => log.cardId),
  );

  return state.cards
    .filter(
      (card) =>
        card.status === "active" &&
        (card.schedule.lapses > 0 || recentlyFailedCardIds.has(card.id)),
    )
    .sort(
      (left, right) =>
        right.schedule.lapses - left.schedule.lapses ||
        right.schedule.reps - left.schedule.reps,
    )
    .slice(0, 30);
}

export function labelReviewRating(rating: ReviewRating) {
  const labels: Record<ReviewRating, string> = {
    again: "Знову",
    hard: "Важко",
    good: "Добре",
    easy: "Легко",
  };

  return labels[rating];
}

export function labelCardType(type: StudyCard["type"]) {
  const labels: Record<StudyCard["type"], string> = {
    productive_translation: "активний переклад",
    receptive_translation: "розуміння слова",
    cloze_context: "контекст",
    collocation_recall: "словосполучення",
    term_definition: "пояснити термін",
    definition_term: "згадати термін",
    contrast: "порівняння",
    scenario: "сценарій",
    code_tool: "інструмент/код",
  };

  return labels[type];
}

export function labelStatus(status: ItemStatus) {
  const labels: Record<ItemStatus, string> = {
    active: "в навчанні",
    suspended: "на паузі",
    archived: "поза навчанням",
  };

  return labels[status];
}

export function labelSource(source: Note["source"]) {
  const labels: Record<Note["source"], string> = {
    seed: "приклад від Memora",
    user: "додано вручну",
    imported: "з CSV",
  };

  return labels[source];
}

export function labelImportStatus(status: ImportRun["status"]) {
  const labels: Record<ImportRun["status"], string> = {
    uploaded: "завантажено",
    validating: "перевіряється",
    ready: "готовий",
    processing: "обробляється",
    completed: "завершено",
    failed: "помилка",
  };

  return labels[status];
}

export function labelImportRowStatus(status: ImportRun["rows"][number]["status"]) {
  const labels: Record<ImportRun["rows"][number]["status"], string> = {
    valid: "валідний",
    invalid: "помилка",
    imported: "додано",
    skipped: "пропущено",
  };

  return labels[status];
}

export function importRunStats(run: ImportRun, moduleType: ModuleType) {
  const rows = run.rows.filter((row) => !row.module || row.module === moduleType);

  return {
    imported: rows.filter((row) => row.status === "imported").length,
    skipped: rows.filter((row) => row.status === "skipped").length,
    invalid: rows.filter((row) => row.status === "invalid").length,
  };
}

export function formatPercent(value: number | null) {
  if (value === null) return "-";
  return `${Math.round(value * 100)}%`;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));
}

export function dateStamp(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function downloadTextFile(fileName: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function noteMatchesQuery(note: Note, query: string) {
  const values = Object.values(note.content)
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    note.title.toLowerCase().includes(query) ||
    note.tags.join(" ").toLowerCase().includes(query) ||
    values.includes(query)
  );
}

export function statusRank(status: ItemStatus) {
  const ranks: Record<ItemStatus, number> = {
    active: 0,
    suspended: 1,
    archived: 2,
  };

  return ranks[status];
}

export function textValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function normalizeSentence(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) return "";

  return /[.!?]$/.test(clean) ? clean : `${clean}.`;
}
