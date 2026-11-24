import type { AdminDb } from "@/lib/supabase/admin";
import type { ProviderId } from "./pricing";

export type AiFeature = "enrich_word" | "enrich_batch" | "tts" | "program" | "compare" | "program_build";

/** One-off scripts (provider comparison, program build): no per-user limits, only the budget. */
type ScriptFeature = "compare" | "program_build";
const isScriptFeature = (feature: AiFeature): feature is ScriptFeature =>
  feature === "compare" || feature === "program_build";

/**
 * Per-user rate limits (rolling windows, counted in `ai_usage`, so they hold
 * across serverless instances). Calls served from cache are free and not counted.
 */
export const rateLimits: Record<Exclude<AiFeature, ScriptFeature>, { perMinute: number; perDay: number }> = {
  enrich_word: { perMinute: 10, perDay: 150 },
  enrich_batch: { perMinute: 3, perDay: 40 },
  tts: { perMinute: 40, perDay: 600 },
};

export type BlockReason = "budget" | "minute" | "day";

const ukMonthsGenitive = [
  "січня", "лютого", "березня", "квітня", "травня", "червня",
  "липня", "серпня", "вересня", "жовтня", "листопада", "грудня",
];

/** "1 грудня" — when the monthly budget resets (UTC). */
export function budgetResetLabel(now = new Date()) {
  return `1 ${ukMonthsGenitive[(now.getUTCMonth() + 1) % 12]}`;
}

export function blockMessage(reason: BlockReason, now = new Date()) {
  if (reason === "budget") {
    return `AI-помічник вимкнений до ${budgetResetLabel(now)}: місячний ліміт витрат вичерпано. Слова можна додавати вручну.`;
  }
  if (reason === "minute") return "Забагато AI-запитів за хвилину. Зачекай хвилинку й спробуй ще раз.";
  return "Денний ліміт AI-запитів вичерпано — завтра знову можна. Вручну додавати можна вже зараз.";
}

/** Thrown when AI is unavailable for a reason the user should see as is. */
export class AiBlockedError extends Error {
  constructor(readonly reason: BlockReason) {
    super(blockMessage(reason));
    this.name = "AiBlockedError";
  }
}

export type Reservation = { id: string };

export async function reserve(
  admin: AdminDb,
  args: {
    userId: string | null;
    feature: AiFeature;
    provider: ProviderId;
    model: string;
    estimateUsd: number;
    monthlyLimitUsd: number;
  },
): Promise<Reservation> {
  const limits = isScriptFeature(args.feature) ? { perMinute: 1000, perDay: 100000 } : rateLimits[args.feature];
  const { data, error } = await admin.rpc("ai_reserve", {
    p_user: args.userId as string,
    p_feature: args.feature,
    p_provider: args.provider,
    p_model: args.model,
    p_estimate: args.estimateUsd,
    p_monthly_limit: args.monthlyLimitUsd,
    p_per_minute: limits.perMinute,
    p_per_day: limits.perDay,
  });
  if (error) throw error;
  const row = data?.[0];
  if (row?.reservation_id) return { id: row.reservation_id };
  const reason = row?.reason;
  throw new AiBlockedError(reason === "minute" || reason === "day" ? reason : "budget");
}

export async function settle(
  admin: AdminDb,
  reservation: Reservation,
  result: {
    status: "ok" | "failed";
    costUsd: number;
    inputTokens?: number;
    outputTokens?: number;
    characters?: number;
    audioSeconds?: number;
  },
) {
  const { error } = await admin
    .from("ai_usage")
    .update({
      status: result.status,
      cost_usd: result.costUsd,
      input_tokens: result.inputTokens ?? 0,
      output_tokens: result.outputTokens ?? 0,
      characters: result.characters ?? 0,
      audio_seconds: result.audioSeconds ?? 0,
    })
    .eq("id", reservation.id);
  // Never fail the user's request over bookkeeping; the estimate stays reserved.
  if (error) console.error("ai_usage settle failed", error);
}

export async function monthSpendUsd(admin: AdminDb) {
  const { data, error } = await admin.rpc("ai_month_spend");
  if (error) throw error;
  return Number(data ?? 0);
}
