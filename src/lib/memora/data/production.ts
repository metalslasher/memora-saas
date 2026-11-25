import { productionAvailability } from "../ai/production-service";
import { dailyProductionQuota, noProduction, type ProductionAllowance } from "../production";
import type { Db } from "./db";

/**
 * How many writing/speaking exercises the practice may still serve: the daily
 * quota minus what the learner already used in the last 24 hours (the same
 * rolling window as the database rate limits), zero when AI is off or the
 * monthly budget is spent, zero speaking when "Говоріння" is switched off.
 * Speaking attempts are counted by transcriptions.
 */
export async function getProductionAllowance(
  db: Db,
  profile: { id: string; dailyMinutes: number; speakingEnabled: boolean },
): Promise<ProductionAllowance> {
  const available = await productionAvailability();
  if (!available.sentence) return noProduction;
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const used = async (feature: "sentence" | "transcribe") => {
    const { count, error } = await db
      .from("ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("feature", feature)
      .gt("created_at", since);
    if (error) throw error;
    return count ?? 0;
  };
  const speaking = available.speaking && profile.speakingEnabled;
  const [sentenceUsed, speakingUsed] = await Promise.all([used("sentence"), speaking ? used("transcribe") : 0]);
  const quota = dailyProductionQuota(profile.dailyMinutes);
  return {
    sentence: Math.max(0, quota - sentenceUsed),
    speaking: speaking ? Math.max(0, quota - speakingUsed) : 0,
  };
}
