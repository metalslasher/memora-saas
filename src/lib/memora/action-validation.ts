import {
  normalizeEnglishDraft,
  normalizeQaDraft,
  type EnglishDraft,
  type QaDraft,
} from "./card-generator";
import type {
  AppSettings,
  NoteStatus,
  ReviewRating,
  StudyMode,
  UserProfileDraft,
} from "./types";

const reviewRatings: ReviewRating[] = ["again", "hard", "good", "easy"];
const itemStatuses: NoteStatus[] = ["active", "suspended", "archived"];
const studyModes: StudyMode[] = ["daily", "english-productive", "qa-interview"];
const profileLocales = ["uk-UA"];
const profileTimezones = [
  "Europe/Kiev",
  "UTC",
  "Europe/Warsaw",
  "Europe/London",
  "America/New_York",
];
const profileLevels = ["", "beginner", "intermediate", "advanced"];

export function validateEnglishDraft(draft: EnglishDraft): EnglishDraft {
  const normalized = normalizeEnglishDraft(draft);

  if (!normalized.lemma || !normalized.translation) {
    throw new Error("Заповни слово або фразу і українське значення.");
  }

  return normalized;
}

export function validateEnglishImportDrafts(drafts: EnglishDraft[]) {
  return validateImportDrafts(drafts, validateEnglishDraft);
}

export function validateQaDraft(draft: QaDraft): QaDraft {
  const normalized = normalizeQaDraft(draft);

  if (!normalized.term || !normalized.definition) {
    throw new Error("Заповни QA термін і пояснення.");
  }

  return normalized;
}

export function validateQaImportDrafts(drafts: QaDraft[]) {
  return validateImportDrafts(drafts, validateQaDraft);
}

export function validateReviewInput(input: {
  cardId: string;
  rating: ReviewRating;
  responseText: string;
  elapsedMs: number;
}) {
  const cardId = input.cardId.trim();
  const responseText = input.responseText.trim();

  if (!cardId) throw new Error("Картку не знайдено.");
  if (!reviewRatings.includes(input.rating)) throw new Error("Невідома оцінка.");
  if (!responseText) throw new Error("Спочатку введи відповідь з пам'яті.");
  if (!Number.isFinite(input.elapsedMs) || input.elapsedMs < 0) {
    throw new Error("Некоректний час відповіді.");
  }

  return {
    cardId,
    rating: input.rating,
    responseText,
    elapsedMs: Math.round(input.elapsedMs),
  };
}

export function validateItemStatus(status: NoteStatus) {
  if (!itemStatuses.includes(status)) throw new Error("Невідомий статус.");
  return status;
}

export function validateSettings(settings: AppSettings): AppSettings {
  const desiredRetention = Number(settings.desiredRetention);
  const dailyNewLimit = Number(settings.dailyNewLimit);

  if (!Number.isFinite(desiredRetention) || desiredRetention < 0.7 || desiredRetention > 0.98) {
    throw new Error("Ціль утримання має бути між 70% і 98%.");
  }

  if (!Number.isInteger(dailyNewLimit) || dailyNewLimit < 0 || dailyNewLimit > 50) {
    throw new Error("Ліміт нових карток має бути від 0 до 50.");
  }

  if (!["simple", "advanced"].includes(settings.reviewButtons)) {
    throw new Error("Невідомий режим кнопок оцінки.");
  }

  if (!studyModes.includes(settings.studyMode)) {
    throw new Error("Невідомий режим навчання.");
  }

  return {
    desiredRetention,
    dailyNewLimit,
    reviewButtons: settings.reviewButtons,
    studyMode: settings.studyMode,
  };
}

export function validateProfileDraft(draft: UserProfileDraft): UserProfileDraft {
  const locale = String(draft.locale ?? "").trim();
  const timezone = String(draft.timezone ?? "").trim();
  const level = String(draft.level ?? "").trim();
  const dailyMinutes = Number(draft.dailyMinutes);
  const primaryGoal = String(draft.primaryGoal ?? "").trim();

  if (!profileLocales.includes(locale)) {
    throw new Error("Наразі інтерфейс Memora підтримує українську мову.");
  }

  if (!profileTimezones.includes(timezone)) {
    throw new Error("Обери підтримуваний часовий пояс.");
  }

  if (!profileLevels.includes(level)) {
    throw new Error("Обери коректний рівень англійської.");
  }

  if (!Number.isInteger(dailyMinutes) || dailyMinutes < 5 || dailyMinutes > 180) {
    throw new Error("Щоденна ціль має бути від 5 до 180 хвилин.");
  }

  if (primaryGoal.length > 500) {
    throw new Error("Ціль навчання має бути до 500 символів.");
  }

  return {
    locale,
    timezone,
    level,
    dailyMinutes,
    primaryGoal,
  };
}

export function validateId(id: string, entityName: string) {
  const cleanId = id.trim();
  if (!cleanId) throw new Error(`${entityName} не знайдено.`);
  return cleanId;
}

function validateImportDrafts<T>(
  drafts: T[],
  validate: (draft: T) => T,
) {
  if (!Array.isArray(drafts)) throw new Error("Некоректний CSV імпорт.");
  if (drafts.length === 0) throw new Error("Немає рядків для імпорту.");
  if (drafts.length > 200) {
    throw new Error("За один раз можна імпортувати до 200 рядків.");
  }

  return drafts.map((draft, index) => {
    try {
      return validate(draft);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Некоректний рядок.";
      throw new Error(`Рядок ${index + 1}: ${message}`);
    }
  });
}
