import type { Database, Json } from "@/lib/supabase/database.types";
import type { Goal } from "../program";
import type { Profile } from "../types";
import type { TestResult } from "../vocab-test";
import { check, isUniqueViolation, maybe, must, type Db } from "./db";

const profileColumns =
  "id,timezone,daily_minutes,goals,onboarded_at,program_rank,known_rank,calibrated_at,level_estimate,speaking_enabled";

type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  | "id"
  | "timezone"
  | "daily_minutes"
  | "goals"
  | "onboarded_at"
  | "program_rank"
  | "known_rank"
  | "calibrated_at"
  | "level_estimate"
  | "speaking_enabled"
>;

export function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    timezone: row.timezone,
    dailyMinutes: row.daily_minutes,
    goals: row.goals,
    onboardedAt: row.onboarded_at,
    programRank: row.program_rank,
    knownRank: row.known_rank,
    calibratedAt: row.calibrated_at,
    levelEstimate: row.level_estimate,
    speakingEnabled: row.speaking_enabled,
  };
}

export async function getProfile(db: Db, userId: string): Promise<Profile | null> {
  const row = maybe(
    await db.from("profiles").select(profileColumns).eq("id", userId).maybeSingle(),
  );
  return row ? mapProfile(row) : null;
}

/** Returns the learner's profile, creating it on the first visit (onboarding follows). */
export async function ensureProfile(db: Db, userId: string): Promise<Profile> {
  const existing = await getProfile(db, userId);
  if (existing) return existing;

  const { data, error } = await db
    .from("profiles")
    .insert({ id: userId })
    .select(profileColumns)
    .single();

  if (error) {
    // Another request created it a moment ago.
    if (isUniqueViolation(error)) {
      const raced = await getProfile(db, userId);
      if (raced) return raced;
    }
    throw error;
  }

  return mapProfile(data);
}

export async function updateDailyMinutes(db: Db, userId: string, minutes: number) {
  const row = must(
    await db.from("profiles").update({ daily_minutes: minutes }).eq("id", userId).select("daily_minutes").single(),
  );
  return row.daily_minutes;
}

export async function updateGoals(db: Db, userId: string, goals: Goal[]) {
  const row = must(await db.from("profiles").update({ goals }).eq("id", userId).select("goals").single());
  return row.goals;
}

export async function updateSpeakingEnabled(db: Db, userId: string, enabled: boolean) {
  const row = must(
    await db.from("profiles").update({ speaking_enabled: enabled }).eq("id", userId).select("speaking_enabled").single(),
  );
  return row.speaking_enabled;
}

export async function updateTimezone(db: Db, userId: string, timezone: string) {
  check(await db.from("profiles").update({ timezone }).eq("id", userId));
}

/**
 * Finishes onboarding: the test result (null = test skipped) sets the program
 * position, plus goals and minutes. A retake moves the position again.
 */
export async function saveOnboarding(
  db: Db,
  userId: string,
  input: {
    result: TestResult | null;
    position: { knownRank: number; programRank: number };
    goals: Goal[];
    dailyMinutes: number;
  },
) {
  const now = new Date().toISOString();
  const row = must(
    await db
      .from("profiles")
      .update({
        ...(input.result ? { level_estimate: input.result as unknown as Json } : {}),
        known_rank: input.position.knownRank,
        program_rank: input.position.programRank,
        goals: input.goals,
        daily_minutes: input.dailyMinutes,
        onboarded_at: now,
        calibrated_at: now,
      })
      .eq("id", userId)
      .select(profileColumns)
      .single(),
  );
  return mapProfile(row);
}

export async function savePosition(db: Db, userId: string, position: { knownRank: number; programRank: number }) {
  check(
    await db
      .from("profiles")
      .update({
        known_rank: position.knownRank,
        program_rank: position.programRank,
        calibrated_at: new Date().toISOString(),
      })
      .eq("id", userId),
  );
}
