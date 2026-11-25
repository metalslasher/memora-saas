import type { ReviewRating, WordSource } from "@/lib/memora/types";

const genericError = "Щось пішло не так. Спробуй ще раз.";
const networkError = "Немає зв’язку із сервером. Перевір інтернет і спробуй ще раз.";

/**
 * A message the learner can act on. Our own errors are already in Ukrainian;
 * raw technical ones (network, library internals in English) are replaced.
 */
export function formatError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : "";
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) return networkError;
  if (/[а-яіїєґ]/i.test(message)) return message;
  return genericError;
}

export const ratingLabels: Record<ReviewRating, string> = {
  again: "Не згадав",
  hard: "Важко",
  good: "Згадав",
  easy: "Легко",
};

export const wordSourceLabels: Record<WordSource, string> = {
  program: "з програми",
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
