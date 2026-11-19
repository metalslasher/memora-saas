import type { Database } from "@/lib/supabase/database.types";
import type { LearningSettings, Profile } from "../types";
import { learningSettingsToJson, readLearningSettings } from "../validation";
import { check, isUniqueViolation, maybe, must, type Db } from "./db";
import { seedStarterWords } from "./words";

const profileColumns = "id,timezone,daily_minutes,goals,settings";

type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "timezone" | "daily_minutes" | "goals" | "settings"
>;

export function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    timezone: row.timezone,
    dailyMinutes: row.daily_minutes,
    goals: row.goals,
    settings: readLearningSettings(row.settings),
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

export async function updateLearningSettings(
  db: Db,
  userId: string,
  settings: LearningSettings,
): Promise<LearningSettings> {
  const current = must(
    await db.from("profiles").select("settings").eq("id", userId).single(),
  );
  const base =
    typeof current.settings === "object" && current.settings && !Array.isArray(current.settings)
      ? current.settings
      : {};
  const row = must(
    await db
      .from("profiles")
      .update({ settings: { ...base, ...learningSettingsToJson(settings) } })
      .eq("id", userId)
      .select("settings")
      .single(),
  );
  return readLearningSettings(row.settings);
}

export async function updateTimezone(db: Db, userId: string, timezone: string) {
  check(await db.from("profiles").update({ timezone }).eq("id", userId));
}
