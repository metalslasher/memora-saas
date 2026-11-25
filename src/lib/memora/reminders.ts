import { localDay, localHour } from "./goal";
import { newWordsPerDay } from "./pace";

/** One user with reminders on, as returned by get_reminder_candidates(). */
export type ReminderCandidate = {
  userId: string;
  timezone: string;
  /** Window in local hours: start inclusive, end exclusive (19–22 = 19:00–21:59). */
  start: number;
  end: number;
  lastReminderDay: string | null;
  dailyMinutes: number;
  /** Local days (today and yesterday) on which the daily goal was met. */
  metDays: string[];
  dueWords: number;
  newReady: number;
};

/** Words waiting today: due reviews plus the new words today's pace would add. */
export function reminderWordCount(candidate: Pick<ReminderCandidate, "dueWords" | "newReady" | "dailyMinutes">) {
  const newAllowed = newWordsPerDay(candidate.dailyMinutes, candidate.dueWords);
  return candidate.dueWords + Math.min(candidate.newReady, newAllowed);
}

/**
 * Who gets a push on this hourly tick: reminders on, local time inside the window,
 * nothing sent yet today, daily goal not met, and something to practise.
 * The first tick inside the window that qualifies sends, so the push arrives at the
 * start of the window; the "sent today" mark makes a repeated call harmless.
 */
export function pickReminderRecipients(candidates: ReminderCandidate[], now: Date) {
  const recipients: { userId: string; day: string; count: number }[] = [];
  for (const candidate of candidates) {
    const day = localDay(now, candidate.timezone);
    const hour = localHour(now, candidate.timezone);
    if (hour < candidate.start || hour >= candidate.end) continue;
    if (candidate.lastReminderDay === day) continue;
    if (candidate.metDays.includes(day)) continue;
    const count = reminderWordCount(candidate);
    if (count <= 0) continue;
    recipients.push({ userId: candidate.userId, day, count });
  }
  return recipients;
}

function wordForm(count: number) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return "слів";
  if (last === 1) return "слово";
  if (last >= 2 && last <= 4) return "слова";
  return "слів";
}

/** Short, human push text. */
export function reminderText(count: number) {
  return {
    title: "Memora",
    body: `Сьогодні чекає ${count} ${wordForm(count)}. Кілька хвилин — і ціль дня виконано.`,
  };
}

/** Window sanity: whole hours, start before end. */
export function isValidReminderWindow(start: unknown, end: unknown): boolean {
  return (
    typeof start === "number" &&
    typeof end === "number" &&
    Number.isInteger(start) &&
    Number.isInteger(end) &&
    start >= 0 &&
    end <= 24 &&
    start < end
  );
}
