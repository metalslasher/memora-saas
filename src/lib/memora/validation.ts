import type { CardStatus, LearningSettings, ReviewRating, WordStatus } from "./types";

const reviewRatings: ReviewRating[] = ["again", "hard", "good", "easy"];
const wordStatuses: WordStatus[] = ["active", "paused", "archived"];
const cardStatuses: CardStatus[] = ["active", "paused"];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const MAX_DAILY_NEW = 50;

export const defaultLearningSettings: LearningSettings = {
  dailyNewLimit: 8,
  reviewButtons: "simple",
};

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

export function validateLearningSettings(settings: LearningSettings): LearningSettings {
  const dailyNewLimit = Number(settings?.dailyNewLimit);
  if (!Number.isInteger(dailyNewLimit) || dailyNewLimit < 0 || dailyNewLimit > MAX_DAILY_NEW) {
    throw new Error(`Ліміт нових карток має бути від 0 до ${MAX_DAILY_NEW}.`);
  }
  if (settings.reviewButtons !== "simple" && settings.reviewButtons !== "advanced") {
    throw new Error("Невідомий режим кнопок оцінки.");
  }
  return { dailyNewLimit, reviewButtons: settings.reviewButtons };
}

/** Reads `profiles.settings` JSON, falling back to defaults per field. */
export function readLearningSettings(value: unknown): LearningSettings {
  const raw = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const limit = Number(raw.daily_new_limit);
  return {
    dailyNewLimit:
      Number.isInteger(limit) && limit >= 0 && limit <= MAX_DAILY_NEW
        ? limit
        : defaultLearningSettings.dailyNewLimit,
    reviewButtons: raw.review_buttons === "advanced" ? "advanced" : "simple",
  };
}

export function learningSettingsToJson(settings: LearningSettings) {
  return { daily_new_limit: settings.dailyNewLimit, review_buttons: settings.reviewButtons };
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
