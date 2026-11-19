import type { ReviewRating, WordSource, WordStatus } from "@/lib/memora/types";

export function formatError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message?: unknown }).message ?? "Невідома помилка.");
  }
  return "Щось пішло не так. Спробуй ще раз.";
}

export const ratingLabels: Record<ReviewRating, string> = {
  again: "Не згадав",
  hard: "Важко",
  good: "Згадав",
  easy: "Легко",
};

export const wordStatusLabels: Record<WordStatus, string> = {
  active: "у навчанні",
  paused: "на паузі",
  archived: "в архіві",
};

export const wordSourceLabels: Record<WordSource, string> = {
  program: "стартовий набір",
  manual: "додано вручну",
  text: "з тексту",
  import: "з CSV",
};

export function formatPercent(value: number | null) {
  if (value === null) return "—";
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

/** Ukrainian plural: plural(3, ["слово", "слова", "слів"]) → "3 слова". */
export function plural(count: number, forms: [string, string, string]) {
  const abs = Math.abs(count);
  const lastTwo = abs % 100;
  const last = abs % 10;
  const form =
    lastTwo >= 11 && lastTwo <= 14
      ? forms[2]
      : last === 1
        ? forms[0]
        : last >= 2 && last <= 4
          ? forms[1]
          : forms[2];
  return `${count} ${form}`;
}
