import type { ReviewLog } from "./types";

export type StreakStats = {
  count: number;
  message: string;
  reviewedToday: boolean;
  week: Array<{
    key: string;
    label: string;
    isCompleted: boolean;
    isToday: boolean;
  }>;
};

export function buildStreakStats(
  logs: Pick<ReviewLog, "reviewedAt">[],
  now = new Date(),
): StreakStats {
  const today = startOfLocalDay(now);
  const todayKey = localDayKey(today);
  const nowTime = now.getTime();
  const reviewedDays = new Set(
    logs
      .map((log) => new Date(log.reviewedAt))
      .filter((date) => {
        const time = date.getTime();
        return Number.isFinite(time) && time <= nowTime;
      })
      .map((date) => localDayKey(date)),
  );
  const reviewedToday = reviewedDays.has(todayKey);
  const anchor = reviewedToday ? today : addLocalDays(today, -1);
  let count = 0;
  let cursor = anchor;

  while (reviewedDays.has(localDayKey(cursor))) {
    count += 1;
    cursor = addLocalDays(cursor, -1);
  }

  const weekStart = addLocalDays(today, -((today.getDay() + 6) % 7));
  const weekLabels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];
  const week = weekLabels.map((label, index) => {
    const date = addLocalDays(weekStart, index);
    const key = localDayKey(date);

    return {
      key,
      label,
      isCompleted: reviewedDays.has(key),
      isToday: key === todayKey,
    };
  });

  return {
    count,
    message: streakMessage(count, reviewedToday),
    reviewedToday,
    week,
  };
}

export function pluralizeDays(value: number) {
  const normalized = Math.abs(value);
  const lastTwo = normalized % 100;
  const last = normalized % 10;

  if (lastTwo >= 11 && lastTwo <= 14) return "днів поспіль";
  if (last === 1) return "день поспіль";
  if (last >= 2 && last <= 4) return "дні поспіль";
  return "днів поспіль";
}

function streakMessage(count: number, reviewedToday: boolean) {
  if (count === 0) return "Почни серію сьогодні";
  if (!reviewedToday) return "Сьогодні ще чекає практика";
  if (count >= 7) return "Відмінна робота!";
  if (count >= 3) return "Тримай темп!";
  return "Гарний старт!";
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addLocalDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function localDayKey(date: Date) {
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join("-");
}

function padDatePart(value: number) {
  return value.toString().padStart(2, "0");
}
