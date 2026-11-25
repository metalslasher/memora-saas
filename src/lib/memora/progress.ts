import type { Json } from "@/lib/supabase/database.types";
import type { StreakSummary } from "./types";
import { isRecord } from "./word-content";

export const HEATMAP_WEEKS = 18;

export type DayActivity = { day: string; reviews: number; correct: number };

/** Progress screen data: get_progress_stats() plus the streak from goal days (data/progress.ts). */
export type ProgressStats = {
  today: string;
  streak: StreakSummary;
  activity: DayActivity[];
  recall30d: { reviews: number; correct: number };
  reviews7d: number;
  forecast: Array<{ day: string; cards: number }>;
  stages: { new: number; learning: number; young: number; mature: number };
  words: { total: number; active: number };
};

/** Maps the jsonb returned by get_progress_stats() into typed data. */
export function parseProgressStats(value: Json): Omit<ProgressStats, "streak"> {
  const raw = isRecord(value) ? value : {};
  const today = readDay(raw.today) ?? new Date().toISOString().slice(0, 10);
  const recall = isRecord(raw.recall_30d) ? raw.recall_30d : {};
  const stages = isRecord(raw.stages) ? raw.stages : {};
  const words = isRecord(raw.words) ? raw.words : {};

  return {
    today,
    activity: readList(raw.activity).flatMap((item) => {
      const day = readDay(item.day);
      return day ? [{ day, reviews: count(item.reviews), correct: count(item.correct) }] : [];
    }),
    recall30d: { reviews: count(recall.reviews), correct: count(recall.correct) },
    reviews7d: count(raw.reviews_7d),
    forecast: readList(raw.forecast).flatMap((item) => {
      const day = readDay(item.day);
      return day ? [{ day, cards: count(item.cards) }] : [];
    }),
    stages: {
      new: count(stages.new),
      learning: count(stages.learning),
      young: count(stages.young),
      mature: count(stages.mature),
    },
    words: { total: count(words.total), active: count(words.active) },
  };
}

export function recallRate(stats: Pick<ProgressStats, "recall30d">) {
  return stats.recall30d.reviews > 0 ? stats.recall30d.correct / stats.recall30d.reviews : null;
}

export type HeatmapDay = { day: string; reviews: number; isFuture: boolean };

/** Monday-first columns of the last `weeks` weeks ending with today's week. */
export function buildHeatmap(activity: DayActivity[], today: string, weeks = HEATMAP_WEEKS) {
  const counts = new Map(activity.map((item) => [item.day, item.reviews]));
  const todayDate = parseDay(today);
  const mondayOffset = (todayDate.getUTCDay() + 6) % 7;
  const start = addDays(todayDate, -mondayOffset - (weeks - 1) * 7);
  const columns: HeatmapDay[][] = [];
  let total = 0;
  let activeDays = 0;

  for (let week = 0; week < weeks; week += 1) {
    const column: HeatmapDay[] = [];
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const day = formatDay(addDays(start, week * 7 + weekday));
      const reviews = counts.get(day) ?? 0;
      const isFuture = day > today;
      if (!isFuture) {
        total += reviews;
        if (reviews > 0) activeDays += 1;
      }
      column.push({ day, reviews, isFuture });
    }
    columns.push(column);
  }

  return { columns, total, activeDays };
}

/** Labels for the current Monday–Sunday week, marking practiced days. */
export function buildWeek(streak: StreakSummary) {
  const labels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];
  const today = parseDay(streak.today);
  const monday = addDays(today, -((today.getUTCDay() + 6) % 7));
  const practiced = new Set(streak.weekDays);
  const frozen = new Set(streak.frozenDays);

  return labels.map((label, index) => {
    const day = formatDay(addDays(monday, index));
    return {
      day,
      label,
      isCompleted: practiced.has(day),
      isFrozen: frozen.has(day),
      isToday: day === streak.today,
    };
  });
}

export function parseDay(day: string) {
  return new Date(`${day}T00:00:00Z`);
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000);
}

export function formatDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function readDay(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function readList(value: unknown) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function count(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}
