/**
 * Prices of the AI models Memora may call, in USD.
 *
 * Checked against the official pages on PRICES_CHECKED_AT:
 * - https://developers.openai.com/api/docs/pricing (standard tier)
 * - https://aistudio.google.com/docs/pricing (paid tier; Gemini 3.x prices
 *   double on 2027-01-01 — re-check then)
 * Re-check before changing the default model and at least monthly.
 */
export const PRICES_CHECKED_AT = "2026-11-25";

export type ProviderId = "openai" | "gemini";

export type TextModelPrice = {
  provider: ProviderId;
  /** USD per 1M input tokens. */
  input: number;
  /** USD per 1M output tokens (reasoning/thinking tokens are billed as output). */
  output: number;
};

export type TtsModelPrice = {
  provider: ProviderId;
  /** USD per 1M text input tokens (token-billed models). */
  input?: number;
  /** USD per 1M audio output tokens (token-billed models). */
  audioOutput?: number;
  /** Audio tokens per second of speech, used to estimate before the call. */
  audioTokensPerSecond?: number;
  /** USD per 1M input characters (character-billed models). */
  perMillionChars?: number;
};

/** The models compared in docs/ai-compare.md (gemini-2.5-flash-lite is closed to new accounts). */
export const textModels: Record<string, TextModelPrice> = {
  "gpt-6-luna": { provider: "openai", input: 0.1, output: 0.5 },
  "gpt-5-nano": { provider: "openai", input: 0.05, output: 0.4 },
  "gemini-3.1-flash-lite": { provider: "gemini", input: 0.25, output: 1.5 },
  "gemini-3.5-flash-lite": { provider: "gemini", input: 0.3, output: 2.5 },
};

export const ttsModels: Record<string, TtsModelPrice> = {
  // OpenAI estimates ~$0.015/min → 1250 audio tokens/min ≈ 21/s.
  "gpt-4o-mini-tts": { provider: "openai", input: 0.6, audioOutput: 12, audioTokensPerSecond: 21 },
  "tts-1": { provider: "openai", perMillionChars: 15 },
  // Gemini: "25 audio tokens per second". 3.8 prices double on 2027-01-01.
  "gemini-2.5-flash-preview-tts": { provider: "gemini", input: 0.5, audioOutput: 10, audioTokensPerSecond: 25 },
  "gemini-3.8-flash-lite-tts": { provider: "gemini", input: 0.5, audioOutput: 6, audioTokensPerSecond: 25 },
};

export type TranscribeModelPrice = {
  provider: ProviderId;
  /** OpenAI's per-minute price (the only one published for gpt-transcribe). */
  perMinute: number;
  /** USD per 1M input (audio) / output (text) tokens, when the model is token-billed. */
  input?: number;
  output?: number;
};

/**
 * Speech to text (checked 2026-11-25). gpt-transcribe is OpenAI's recommended
 * model; the gpt-4o-*-transcribe family and whisper-1 shut down on 2027-02-26.
 */
export const transcribeModels: Record<string, TranscribeModelPrice> = {
  "gpt-transcribe": { provider: "openai", perMinute: 0.0045 },
  "gpt-4o-mini-transcribe": { provider: "openai", perMinute: 0.003, input: 1.25, output: 5 },
};

export function transcribePrice(model: string) {
  const price = transcribeModels[model];
  if (!price) throw new Error(`No price for transcription model ${model}.`);
  return price;
}

export type TranscribeUsage = { seconds?: number; inputTokens?: number; outputTokens?: number };

/**
 * Bills tokens when the response reports them and the model has token
 * prices; otherwise the per-minute price of the reported (or measured) length.
 */
export function transcribeCost(model: string, usage: TranscribeUsage, measuredSeconds: number) {
  const price = transcribePrice(model);
  if (usage.inputTokens !== undefined && price.input !== undefined && price.output !== undefined) {
    return roundUsd((usage.inputTokens * price.input + (usage.outputTokens ?? 0) * price.output) / 1_000_000);
  }
  const seconds = usage.seconds ?? measuredSeconds;
  return roundUsd((Math.max(1, seconds) / 60) * price.perMinute);
}

/** Unknown models are refused rather than billed at a guessed price. */
export function textPrice(model: string) {
  const price = textModels[model];
  if (!price) throw new Error(`No price for text model ${model}.`);
  return price;
}

export function ttsPrice(model: string) {
  const price = ttsModels[model];
  if (!price) throw new Error(`No price for TTS model ${model}.`);
  return price;
}

export function textCost(model: string, inputTokens: number, outputTokens: number) {
  const price = textPrice(model);
  return roundUsd((inputTokens * price.input + outputTokens * price.output) / 1_000_000);
}

export type TtsUsage = { inputTokens?: number; outputTokens?: number; characters: number };

export function ttsCost(model: string, usage: TtsUsage) {
  const price = ttsPrice(model);
  if (price.perMillionChars !== undefined) {
    return roundUsd((usage.characters * price.perMillionChars) / 1_000_000);
  }
  return roundUsd(
    ((usage.inputTokens ?? 0) * (price.input ?? 0) + (usage.outputTokens ?? 0) * (price.audioOutput ?? 0)) /
      1_000_000,
  );
}

/** Conservative speech length: ~12 characters per second, at least 1 s. */
export function estimateSpeechSeconds(text: string) {
  return Math.max(1, text.length / 12);
}

/**
 * Upper-bound estimate of a TTS call, reserved against the budget before the
 * call (1 token ≈ 4 characters of input).
 */
export function estimateTtsCost(model: string, text: string) {
  const price = ttsPrice(model);
  if (price.perMillionChars !== undefined) return ttsCost(model, { characters: text.length });
  const seconds = estimateSpeechSeconds(text);
  return ttsCost(model, {
    characters: text.length,
    inputTokens: Math.ceil(text.length / 4) + 20,
    outputTokens: Math.ceil(seconds * (price.audioTokensPerSecond ?? 25) * 1.5),
  });
}

/** ledger precision: numeric(12, 6) */
export function roundUsd(value: number) {
  return Math.ceil(value * 1_000_000) / 1_000_000;
}
