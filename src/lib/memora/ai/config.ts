import { textModels, transcribeModels, ttsModels, type ProviderId } from "./pricing";
import {
  geminiTextProvider,
  geminiTtsProvider,
  openAiTextProvider,
  openAiTranscribeProvider,
  openAiTtsProvider,
  type TextProvider,
  type TranscribeProvider,
  type TtsProvider,
} from "./providers";

/**
 * Which provider/model does what. Defaults are the comparison winners
 * (docs/ai-compare.md); env overrides them without a deploy of new code:
 * MEMORA_AI_PROVIDER, MEMORA_AI_TEXT_MODEL, MEMORA_TTS_PROVIDER,
 * MEMORA_TTS_MODEL, MEMORA_TTS_VOICE, MEMORA_TRANSCRIBE_MODEL, MEMORA_AI_MONTHLY_LIMIT_USD.
 */
export const defaults = {
  textProvider: "openai" as ProviderId,
  textModel: { openai: "gpt-6-luna", gemini: "gemini-3.1-flash-lite" } satisfies Record<ProviderId, string>,
  ttsProvider: "openai" as ProviderId,
  ttsModel: { openai: "gpt-4o-mini-tts", gemini: "gemini-2.5-flash-preview-tts" } satisfies Record<ProviderId, string>,
  ttsVoice: { openai: "alloy", gemini: "Kore" } satisfies Record<ProviderId, string>,
  transcribeModel: "gpt-transcribe",
  monthlyLimitUsd: 10,
};

type Env = Record<string, string | undefined>;

function providerFrom(value: string | undefined, fallback: ProviderId): ProviderId {
  return value === "openai" || value === "gemini" ? value : fallback;
}

function apiKey(env: Env, provider: ProviderId) {
  return (provider === "openai" ? env.OPENAI_API_KEY : env.GEMINI_API_KEY)?.trim() || null;
}

export function monthlyLimitUsd(env: Env = process.env) {
  const value = Number.parseFloat(env.MEMORA_AI_MONTHLY_LIMIT_USD ?? "");
  return Number.isFinite(value) && value >= 0 ? value : defaults.monthlyLimitUsd;
}

/** The configured text provider, or null when its key is missing. */
export function textProviderFromEnv(env: Env = process.env): TextProvider | null {
  const provider = providerFrom(env.MEMORA_AI_PROVIDER, defaults.textProvider);
  const key = apiKey(env, provider);
  if (!key) return null;
  const override = env.MEMORA_AI_TEXT_MODEL?.trim();
  const model = override && textModels[override]?.provider === provider ? override : defaults.textModel[provider];
  return provider === "openai" ? openAiTextProvider(key, model) : geminiTextProvider(key, model);
}

/** Speech to text: OpenAI only (MEMORA_TRANSCRIBE_MODEL overrides the model). */
export function transcribeProviderFromEnv(env: Env = process.env): TranscribeProvider | null {
  const key = apiKey(env, "openai");
  if (!key) return null;
  const override = env.MEMORA_TRANSCRIBE_MODEL?.trim();
  const model = override && transcribeModels[override] ? override : defaults.transcribeModel;
  return openAiTranscribeProvider(key, model);
}

export function ttsProviderFromEnv(env: Env = process.env): TtsProvider | null {
  const provider = providerFrom(env.MEMORA_TTS_PROVIDER, defaults.ttsProvider);
  const key = apiKey(env, provider);
  if (!key) return null;
  const override = env.MEMORA_TTS_MODEL?.trim();
  const model = override && ttsModels[override]?.provider === provider ? override : defaults.ttsModel[provider];
  const voice = env.MEMORA_TTS_VOICE?.trim() || defaults.ttsVoice[provider];
  return provider === "openai" ? openAiTtsProvider(key, model, voice) : geminiTtsProvider(key, model, voice);
}
