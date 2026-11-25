import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { MAX_RECORDING_SECONDS, type ProductionKind, type SentenceFeedback } from "../production";
import { monthSpendUsd, reserve, settle } from "./budget";
import { monthlyLimitUsd, textProviderFromEnv, transcribeProviderFromEnv } from "./config";
import {
  estimateFeedbackTokens,
  FEEDBACK_MAX_OUTPUT_TOKENS,
  feedbackSchema,
  feedbackSystemPrompt,
  feedbackUserPrompt,
  parseFeedback,
  transcriptionPrompt,
  type FeedbackRequest,
} from "./feedback";
import { textCost, transcribeCost } from "./pricing";
import { ProviderError } from "./providers";

/** Server-only: AI feedback on the learner's sentence and speech to text. */

const unavailable = "Перевірка речень зараз недоступна. Пропусти вправу — решта практики працює.";
const feedbackFailed = "AI не зміг перевірити речення. Спробуй ще раз або пропусти вправу.";
const transcribeFailed = "Не вдалося розпізнати запис. Спробуй ще раз або пропусти вправу.";

/** Whether the paid exercises can run now (keys configured, monthly budget left). */
export async function productionAvailability(): Promise<Record<ProductionKind, boolean>> {
  const admin = createSupabaseAdminClient();
  const text = textProviderFromEnv();
  if (!admin || !text) return { sentence: false, speaking: false };
  try {
    if ((await monthSpendUsd(admin)) >= monthlyLimitUsd()) return { sentence: false, speaking: false };
  } catch (error) {
    console.error("ai spend check failed", error);
    return { sentence: false, speaking: false };
  }
  return { sentence: true, speaking: transcribeProviderFromEnv() !== null };
}

function requireAdmin() {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error(unavailable);
  return admin;
}

/** Feedback on a written sentence or a transcript (feature `sentence` / `speak`). */
export async function sentenceFeedback(
  userId: string,
  kind: ProductionKind,
  request: FeedbackRequest,
): Promise<SentenceFeedback> {
  const admin = requireAdmin();
  const provider = textProviderFromEnv();
  if (!provider) throw new Error(unavailable);

  const estimate = estimateFeedbackTokens(request);
  const reservation = await reserve(admin, {
    userId,
    feature: kind === "sentence" ? "sentence" : "speak",
    provider: provider.provider,
    model: provider.model,
    estimateUsd: textCost(provider.model, estimate.input, FEEDBACK_MAX_OUTPUT_TOKENS),
    monthlyLimitUsd: monthlyLimitUsd(),
  });

  try {
    const { data, usage } = await provider.generateJson({
      system: feedbackSystemPrompt(kind),
      user: feedbackUserPrompt(request),
      schema: feedbackSchema,
      schemaName: "sentence_feedback",
      maxOutputTokens: FEEDBACK_MAX_OUTPUT_TOKENS,
    });
    const feedback = parseFeedback(data);
    await settle(admin, reservation, {
      status: feedback ? "ok" : "failed",
      costUsd: textCost(provider.model, usage.inputTokens, usage.outputTokens),
      ...usage,
      characters: request.text.length,
    });
    if (!feedback) throw new Error(feedbackFailed);
    return feedback;
  } catch (error) {
    if (error instanceof Error && error.message === feedbackFailed) throw error;
    const usage = error instanceof ProviderError ? error.usage : undefined;
    await settle(admin, reservation, {
      status: "failed",
      costUsd: usage ? textCost(provider.model, usage.inputTokens, usage.outputTokens) : 0,
      ...usage,
    });
    console.error("sentence feedback failed", error);
    throw new Error(feedbackFailed);
  }
}

/**
 * Speech to text (feature `transcribe`). The audio is passed straight to the
 * provider and never stored; only the transcript goes back to the learner.
 */
export async function transcribeSpeech(
  userId: string,
  audio: Blob,
  options: { fileName: string; seconds: number },
): Promise<string> {
  const admin = requireAdmin();
  const provider = transcribeProviderFromEnv();
  if (!provider) throw new Error(unavailable);

  const reservation = await reserve(admin, {
    userId,
    feature: "transcribe",
    provider: provider.provider,
    model: provider.model,
    estimateUsd: transcribeCost(provider.model, {}, MAX_RECORDING_SECONDS + 1),
    monthlyLimitUsd: monthlyLimitUsd(),
  });

  try {
    const { text, usage } = await provider.transcribe(audio, { fileName: options.fileName, prompt: transcriptionPrompt });
    await settle(admin, reservation, {
      status: "ok",
      costUsd: transcribeCost(provider.model, usage, options.seconds),
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      characters: text.length,
      audioSeconds: Math.round((usage.seconds ?? options.seconds) * 100) / 100,
    });
    return text;
  } catch (error) {
    // A failed request is not billed by OpenAI.
    await settle(admin, reservation, { status: "failed", costUsd: 0 });
    console.error("transcription failed", error);
    throw new Error(transcribeFailed);
  }
}
