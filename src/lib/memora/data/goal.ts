import { evaluateGoal, localDay } from "../goal";
import { newWordAllowance } from "../pace";
import { addDays, buildStreakSummary } from "../streak";
import type { GoalSync, StreakSummary } from "../types";
import { check, must, type Db } from "./db";
import { getPracticeSummary } from "./practice";

type GoalProfile = { timezone: string; dailyMinutes: number };

/** Streak summary for the header, practice and progress screens. */
export async function getStreak(db: Db, profile: GoalProfile): Promise<StreakSummary> {
  const today = localDay(new Date(), profile.timezone);
  const [days, activity] = await Promise.all([
    db
      .from("goal_days")
      .select("day")
      .gte("day", addDays(today, -400))
      .lte("day", today)
      .then(must),
    db.rpc("get_day_activity", { p_tz: profile.timezone }).then(must),
  ]);
  return buildStreakSummary({
    goalDays: days.map((row) => row.day),
    today,
    activeMs: Number(activity[0]?.active_ms ?? 0),
    goalMinutes: profile.dailyMinutes,
  });
}

/**
 * Re-checks today's goal after a review (or an undo) and stores or removes today's
 * goal day. `wasMet` is the client's belief: the full streak is returned only when
 * the answer differs from it, so most reviews cost no extra read.
 */
export async function syncGoalDay(db: Db, profile: GoalProfile, wasMet: boolean): Promise<GoalSync> {
  const [activityRows, summary] = await Promise.all([
    db.rpc("get_day_activity", { p_tz: profile.timezone }).then(must),
    getPracticeSummary(db, profile.timezone),
  ]);
  const activity = activityRows[0];
  const activeMs = Number(activity?.active_ms ?? 0);
  const newToday = Math.min(summary.newReady, newWordAllowance(summary));
  const evaluation = evaluateGoal({
    activeMs,
    goalMinutes: profile.dailyMinutes,
    reviews: activity?.reviews ?? 0,
    queueEmpty: summary.dueWords === 0 && newToday === 0,
  });

  if (activity) {
    if (evaluation.met && evaluation.reason) {
      check(
        await db
          .from("goal_days")
          .upsert({ day: activity.day, reason: evaluation.reason, active_ms: Math.min(activeMs, 2_000_000_000) }, { onConflict: "user_id,day" }),
      );
    } else if (wasMet) {
      check(await db.from("goal_days").delete().eq("day", activity.day));
    }
  }

  const streak = evaluation.met !== wasMet ? await getStreak(db, profile) : null;
  return { met: evaluation.met, streak };
}
