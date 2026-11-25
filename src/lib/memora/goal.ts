/**
 * Daily goal (pure rules). The goal is met on a local day when the learner has
 * reviewed something AND either spent their "minutes per day" on cards (idle time
 * capped per card, same counting as the session timer) or cleared today's queue.
 * Days on which the goal was met are stored (`goal_days`); the streak is computed
 * from them (streak.ts).
 */
export type GoalReason = "minutes" | "queue";

export type GoalEvaluation = { met: boolean; reason: GoalReason | null };

export function goalTargetMs(goalMinutes: number) {
  return Math.max(1, goalMinutes) * 60_000;
}

export function evaluateGoal(input: {
  /** Counted time today, ms. */
  activeMs: number;
  goalMinutes: number;
  /** Reviews done today (the goal never counts a day without one). */
  reviews: number;
  /** Nothing left to do today: no due words and no new words allowed by today's pace. */
  queueEmpty: boolean;
}): GoalEvaluation {
  if (input.reviews <= 0) return { met: false, reason: null };
  if (input.activeMs >= goalTargetMs(input.goalMinutes)) return { met: true, reason: "minutes" };
  if (input.queueEmpty) return { met: true, reason: "queue" };
  return { met: false, reason: null };
}

/** Whole minutes done and the goal, e.g. "7 з 15 хв". Done minutes are capped at the goal. */
export function goalProgressLabel(activeMs: number, goalMinutes: number) {
  const done = Math.min(Math.floor(activeMs / 60_000), goalMinutes);
  return `${done} з ${goalMinutes} хв`;
}

export function goalPercent(activeMs: number, goalMinutes: number) {
  return Math.min(100, Math.round((activeMs / goalTargetMs(goalMinutes)) * 100));
}

const formats = new Map<string, Intl.DateTimeFormat>();

function partsOf(date: Date, timeZone: string) {
  let format = formats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
    });
    formats.set(timeZone, format);
  }
  const parts: Record<string, string> = {};
  for (const part of format.formatToParts(date)) parts[part.type] = part.value;
  return parts;
}

/** Local calendar day (YYYY-MM-DD) of an instant in a timezone. */
export function localDay(date: Date, timeZone: string) {
  const { year, month, day } = partsOf(date, timeZone);
  return `${year}-${month}-${day}`;
}

/** Local hour (0–23) of an instant in a timezone. */
export function localHour(date: Date, timeZone: string) {
  return Number(partsOf(date, timeZone).hour) % 24;
}
