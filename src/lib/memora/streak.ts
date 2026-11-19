import type { StreakSummary } from "./types";

export function pluralizeDays(value: number) {
  const normalized = Math.abs(value);
  const lastTwo = normalized % 100;
  const last = normalized % 10;

  if (lastTwo >= 11 && lastTwo <= 14) return "днів поспіль";
  if (last === 1) return "день поспіль";
  if (last >= 2 && last <= 4) return "дні поспіль";
  return "днів поспіль";
}

export function streakMessage({ streak, reviewedToday }: Pick<StreakSummary, "streak" | "reviewedToday">) {
  if (streak === 0) return "Почни серію сьогодні";
  if (!reviewedToday) return "Сьогодні ще чекає практика";
  if (streak >= 7) return "Відмінна робота!";
  if (streak >= 3) return "Тримай темп!";
  return "Гарний старт!";
}

/** Optimistic update after the first review of the day. */
export function markReviewedToday(summary: StreakSummary): StreakSummary {
  if (summary.reviewedToday) return summary;
  return {
    ...summary,
    streak: summary.streak + 1,
    reviewedToday: true,
    weekDays: summary.weekDays.includes(summary.today)
      ? summary.weekDays
      : [...summary.weekDays, summary.today],
  };
}
