import type { Database } from "@/lib/supabase/database.types";
import type { Profile } from "../types";
import { check, isUniqueViolation, maybe, must, type Db } from "./db";
import { seedStarterWords } from "./words";

const profileColumns = "id,timezone,daily_minutes,goals";

type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "timezone" | "daily_minutes" | "goals"
>;

export function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    timezone: row.timezone,
    dailyMinutes: row.daily_minutes,
    goals: row.goals,
  };
}

export async function getProfile(db: Db, userId: string): Promise<Profile | null> {
  const row = maybe(
    await db.from("profiles").select(profileColumns).eq("id", userId).maybeSingle(),
  );
  return row ? mapProfile(row) : null;
}

/**
 * Returns the learner's profile, creating it on the first visit. A brand-new
 * profile also gets the starter words so practice is not empty.
 */
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

  await seedStarterWords(db);
  return mapProfile(data);
}

export async function updateDailyMinutes(db: Db, userId: string, minutes: number) {
  const row = must(
    await db.from("profiles").update({ daily_minutes: minutes }).eq("id", userId).select("daily_minutes").single(),
  );
  return row.daily_minutes;
}

export async function updateTimezone(db: Db, userId: string, timezone: string) {
  check(await db.from("profiles").update({ timezone }).eq("id", userId));
}
