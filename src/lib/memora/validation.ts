import { DAILY_MINUTES_OPTIONS, isDailyMinutes } from "./pace";
import type { CardStatus, ReviewRating, WordStatus } from "./types";

const reviewRatings: ReviewRating[] = ["again", "hard", "good", "easy"];
const wordStatuses: WordStatus[] = ["active", "paused", "archived"];
const cardStatuses: CardStatus[] = ["active", "paused"];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateId(id: unknown, entityName: string) {
  const clean = typeof id === "string" ? id.trim() : "";
  if (!uuidPattern.test(clean)) throw new Error(`${entityName} не знайдено.`);
  return clean;
}

export function validateReviewInput(input: {
  cardId: string;
  rating: ReviewRating;
  responseText: string;
  elapsedMs: number;
}) {
  if (!reviewRatings.includes(input.rating)) throw new Error("Невідома оцінка.");
  if (!Number.isFinite(input.elapsedMs) || input.elapsedMs < 0) {
    throw new Error("Некоректний час відповіді.");
  }

  return {
    cardId: validateId(input.cardId, "Картку"),
    rating: input.rating,
    // Typing is optional: learners may recall silently and reveal the answer.
    responseText: String(input.responseText ?? "").trim().slice(0, 2000),
    elapsedMs: Math.min(Math.round(input.elapsedMs), 30 * 60_000),
  };
}

export function validateWordStatus(status: unknown): WordStatus {
  if (!wordStatuses.includes(status as WordStatus)) throw new Error("Невідомий статус.");
  return status as WordStatus;
}

export function validateCardStatus(status: unknown): CardStatus {
  if (!cardStatuses.includes(status as CardStatus)) throw new Error("Невідомий статус.");
  return status as CardStatus;
}

export function validateDailyMinutes(value: unknown): number {
  if (!isDailyMinutes(value)) {
    throw new Error(`Обери одне зі значень: ${DAILY_MINUTES_OPTIONS.join(", ")} хв.`);
  }
  return value;
}

/** Accepts IANA zone names the runtime knows; anything else is rejected. */
export function isValidTimezone(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
