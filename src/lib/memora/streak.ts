import { goalTargetMs } from "./goal";
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

export function streakMessage({
  streak,
  goalMet,
  freezeUsed,
}: Pick<StreakSummary, "streak" | "goalMet" | "freezeUsed">) {
  if (streak === 0) return goalMet ? "Гарний старт!" : "Почни серію сьогодні";
  if (!goalMet) return freezeUsed ? "Заморозку цього тижня витрачено" : "Сьогодні ще чекає ціль дня";
  if (streak >= 7) return "Відмінна робота!";
  if (streak >= 3) return "Тримай темп!";
  return "Гарний старт!";
}

// ── Streak rule ─────────────────────────────────────────────────────────────
// A day counts when its goal was met. One missed day per calendar week
// (Monday–Sunday, learner's local calendar) does not break the streak: a freeze
// is spent automatically; the frozen day itself is not counted. A second miss in
// the same week resets the streak. Today never breaks anything: it is still open.
// Days are plain local dates ("YYYY-MM-DD") stored when they happened, so a later
// change of timezone cannot move or merge past days.

function parseDay(day: string) {
  return new Date(`${day}T00:00:00Z`);
}

export function addDays(day: string, amount: number) {
  return new Date(parseDay(day).getTime() + amount * 86_400_000).toISOString().slice(0, 10);
}

/** Monday of the week containing `day`. */
export function weekStart(day: string) {
  return addDays(day, -((parseDay(day).getUTCDay() + 6) % 7));
}

export type StreakResult = {
  streak: number;
  /** Days saved by a freeze (all history; the UI shows the current week's). */
  frozenDays: string[];
  /** This week's freeze is spent. */
  freezeUsed: boolean;
};

export function computeStreak(goalDays: Iterable<string>, today: string): StreakResult {
  const met = new Set([...goalDays].filter((day) => day <= today));
  const first = [...met].sort()[0];
  if (!first) return { streak: 0, frozenDays: [], freezeUsed: false };

  let streak = 0;
  const frozenDays: string[] = [];
  const usedWeeks = new Set<string>();
  for (let day = first; day < today; day = addDays(day, 1)) {
    if (met.has(day)) {
      streak += 1;
      continue;
    }
    const week = weekStart(day);
    if (streak > 0 && !usedWeeks.has(week)) {
      usedWeeks.add(week);
      frozenDays.push(day);
    } else {
      streak = 0;
    }
  }
  if (met.has(today)) streak += 1;
  return { streak, frozenDays, freezeUsed: usedWeeks.has(weekStart(today)) };
}

/** Everything the header, the practice screen and the progress screen show. */
export function buildStreakSummary(input: {
  goalDays: string[];
  today: string;
  activeMs: number;
  goalMinutes: number;
}): StreakSummary {
  const { goalDays, today } = input;
  const result = computeStreak(goalDays, today);
  const monday = weekStart(today);
  const inWeek = (day: string) => day >= monday && day <= today;
  return {
    streak: result.streak,
    goalMet: goalDays.includes(today),
    today,
    weekDays: goalDays.filter(inWeek).sort(),
    frozenDays: result.frozenDays.filter(inWeek),
    freezeUsed: result.freezeUsed,
    doneMs: input.activeMs,
    goalMinutes: input.goalMinutes,
  };
}

/**
 * Optimistic update while a session runs: add counted time; when it reaches the
 * goal, today counts (the server confirms and corrects after the review is saved).
 */
export function addGoalTime(summary: StreakSummary, countedMs: number): StreakSummary {
  const doneMs = Math.max(0, summary.doneMs + countedMs);
  if (summary.goalMet || doneMs < goalTargetMs(summary.goalMinutes)) return { ...summary, doneMs };
  return {
    ...summary,
    doneMs,
    goalMet: true,
    streak: summary.streak + 1,
    weekDays: summary.weekDays.includes(summary.today) ? summary.weekDays : [...summary.weekDays, summary.today],
  };
}
