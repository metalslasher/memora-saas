import type { ProviderId } from "./pricing";

/**
 * Thin provider layer over plain `fetch` (no SDKs). Text models return JSON
 * that matches a schema; TTS returns audio bytes. Every call reports usage so
 * the caller can bill it in `ai_usage`.
 */
export type TextUsage = { inputTokens: number; outputTokens: number };

export type JsonRequest = {
  system: string;
  user: string;
  schema: Record<string, unknown>;
  schemaName: string;
  maxOutputTokens: number;
};

export type JsonResult = { data: unknown; usage: TextUsage };

export type TtsResult = {
  audio: Uint8Array;
  mime: "audio/mpeg" | "audio/wav";
  usage: { inputTokens?: number; outputTokens?: number; characters: number };
};

export type TextProvider = {
  provider: ProviderId;
  model: string;
  generateJson(request: JsonRequest): Promise<JsonResult>;
};

export type TtsProvider = {
  provider: ProviderId;
  model: string;
  voice: string;
  synthesize(text: string): Promise<TtsResult>;
};

/** A provider failure; `usage` is set when the provider still billed tokens. */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly usage?: TextUsage,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

type FetchLike = typeof fetch;

const TEXT_TIMEOUT_MS = 50_000;
const TTS_TIMEOUT_MS = 30_000;

async function readError(response: Response) {
  const body = await response.text().catch(() => "");
  return `${response.status} ${body.slice(0, 300)}`;
}

/* ---------------- OpenAI ---------------- */

/** Reasoning effort per model family; nano/mini reasoning models are fine at the lowest. */
function openAiReasoning(model: string): string | undefined {
  if (/^gpt-5(-|$)/.test(model)) return "minimal";
  if (/^gpt-(5\.\d+|6)/.test(model)) return "none";
  return undefined;
}

export function openAiTextProvider(apiKey: string, model: string, fetchImpl: FetchLike = fetch): TextProvider {
  return {
    provider: "openai",
    model,
    async generateJson(request) {
      const reasoning = openAiReasoning(model);
      const response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        signal: AbortSignal.timeout(TEXT_TIMEOUT_MS),
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: request.user },
          ],
          response_format: {
            type: "json_schema",
            json_schema: { name: request.schemaName, strict: true, schema: request.schema },
          },
          max_completion_tokens: request.maxOutputTokens,
          ...(reasoning ? { reasoning_effort: reasoning } : {}),
        }),
      });
      if (!response.ok) throw new ProviderError(`OpenAI ${await readError(response)}`);

      const body = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const usage = {
        inputTokens: body.usage?.prompt_tokens ?? 0,
        outputTokens: body.usage?.completion_tokens ?? 0,
      };
      const choice = body.choices?.[0];
      const text = choice?.message?.content;
      if (!text) throw new ProviderError(`OpenAI returned no content (${choice?.finish_reason ?? "unknown"}).`, usage);
      try {
        return { data: JSON.parse(text), usage };
      } catch {
        throw new ProviderError("OpenAI returned invalid JSON.", usage);
      }
    },
  };
}

/**
 * OpenAI speech. `stream_format: "sse"` returns base64 MP3 chunks and the
 * token usage in the final event; without usage the cost is estimated from
 * the characters by the caller.
 */
export function openAiTtsProvider(
  apiKey: string,
  model: string,
  voice: string,
  fetchImpl: FetchLike = fetch,
): TtsProvider {
  return {
    provider: "openai",
    model,
    voice,
    async synthesize(text) {
      const streams = model !== "tts-1" && model !== "tts-1-hd";
      const response = await fetchImpl("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        signal: AbortSignal.timeout(TTS_TIMEOUT_MS),
        body: JSON.stringify({
          model,
          voice,
          input: text,
          response_format: "mp3",
          ...(streams
            ? {
                stream_format: "sse",
                instructions: "Speak clearly in a natural, friendly American accent at a relaxed pace.",
              }
            : {}),
        }),
      });
      if (!response.ok) throw new ProviderError(`OpenAI TTS ${await readError(response)}`);

      if (!streams) {
        return {
          audio: new Uint8Array(await response.arrayBuffer()),
          mime: "audio/mpeg",
          usage: { characters: text.length },
        };
      }

      const { audio, usage } = parseSpeechEvents(await response.text());
      if (audio.length === 0) throw new ProviderError("OpenAI TTS returned no audio.");
      return {
        audio,
        mime: "audio/mpeg",
        usage: { characters: text.length, inputTokens: usage?.input_tokens, outputTokens: usage?.output_tokens },
      };
    },
  };
}

export type TranscribeResult = {
  text: string;
  usage: { seconds?: number; inputTokens?: number; outputTokens?: number };
};

export type TranscribeProvider = {
  provider: ProviderId;
  model: string;
  transcribe(audio: Blob, options: { fileName: string; prompt: string }): Promise<TranscribeResult>;
};

const TRANSCRIBE_TIMEOUT_MS = 30_000;

/** OpenAI speech to text (English, plain JSON with usage). */
export function openAiTranscribeProvider(
  apiKey: string,
  model: string,
  fetchImpl: FetchLike = fetch,
): TranscribeProvider {
  return {
    provider: "openai",
    model,
    async transcribe(audio, { fileName, prompt }) {
      const form = new FormData();
      form.append("file", audio, fileName);
      form.append("model", model);
      form.append("language", "en");
      form.append("response_format", "json");
      form.append("prompt", prompt);
      const response = await fetchImpl("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS),
        body: form,
      });
      if (!response.ok) throw new ProviderError(`OpenAI transcription ${await readError(response)}`);
      const body = (await response.json()) as {
        text?: string;
        usage?: { type?: string; seconds?: number; input_tokens?: number; output_tokens?: number };
      };
      const usage = body.usage;
      return {
        text: typeof body.text === "string" ? body.text.trim() : "",
        usage:
          usage?.type === "duration" || (usage?.seconds !== undefined && usage.input_tokens === undefined)
            ? { seconds: usage?.seconds }
            : usage
              ? { inputTokens: usage.input_tokens, outputTokens: usage.output_tokens }
              : {},
      };
    },
  };
}

type SpeechUsage = { input_tokens?: number; output_tokens?: number };

/** Parses the SSE body of a streamed speech response. */
export function parseSpeechEvents(body: string): { audio: Uint8Array; usage: SpeechUsage | null } {
  const chunks: Uint8Array[] = [];
  let usage: SpeechUsage | null = null;
  for (const line of body.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const event = JSON.parse(payload) as { type?: string; audio?: string; usage?: SpeechUsage };
      if (event.type === "speech.audio.delta" && event.audio) chunks.push(base64ToBytes(event.audio));
      if (event.type === "speech.audio.done" && event.usage) usage = event.usage;
    } catch {
      // Ignore malformed lines; missing audio is reported by the caller.
    }
  }
  return { audio: concatBytes(chunks), usage };
}

/* ---------------- Gemini ---------------- */

const geminiBase = "https://generativelanguage.googleapis.com/v1beta/models";

/** Gemini's schema dialect rejects some JSON Schema keywords; drop them. */
export function toGeminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (typeof schema !== "object" || schema === null) return schema;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === "additionalProperties") continue;
    result[key] = toGeminiSchema(value);
  }
  return result;
}

/** Gemini 3.x text models: least thinking (cards need no reasoning). */
const geminiThinking = { thinkingLevel: "minimal" };

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; inlineData?: { mimeType?: string; data?: string } }> };
    finishReason?: string;
  }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
};

function geminiUsage(body: GeminiResponse): TextUsage {
  const meta = body.usageMetadata;
  return {
    inputTokens: meta?.promptTokenCount ?? 0,
    outputTokens: (meta?.candidatesTokenCount ?? 0) + (meta?.thoughtsTokenCount ?? 0),
  };
}

export function geminiTextProvider(apiKey: string, model: string, fetchImpl: FetchLike = fetch): TextProvider {
  return {
    provider: "gemini",
    model,
    async generateJson(request) {
      const response = await fetchImpl(`${geminiBase}/${model}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
        signal: AbortSignal.timeout(TEXT_TIMEOUT_MS),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: request.system }] },
          contents: [{ role: "user", parts: [{ text: request.user }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: toGeminiSchema(request.schema),
            maxOutputTokens: request.maxOutputTokens,
            thinkingConfig: geminiThinking,
          },
        }),
      });
      if (!response.ok) throw new ProviderError(`Gemini ${await readError(response)}`);

      const body = (await response.json()) as GeminiResponse;
      const usage = geminiUsage(body);
      const candidate = body.candidates?.[0];
      const text = candidate?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
      if (!text) throw new ProviderError(`Gemini returned no content (${candidate?.finishReason ?? "unknown"}).`, usage);
      try {
        return { data: JSON.parse(text), usage };
      } catch {
        throw new ProviderError("Gemini returned invalid JSON.", usage);
      }
    },
  };
}

/** Gemini speech: 16-bit 24 kHz mono PCM, wrapped into WAV here. */
export function geminiTtsProvider(
  apiKey: string,
  model: string,
  voice: string,
  fetchImpl: FetchLike = fetch,
): TtsProvider {
  return {
    provider: "gemini",
    model,
    voice,
    async synthesize(text) {
      const response = await fetchImpl(`${geminiBase}/${model}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
        signal: AbortSignal.timeout(TTS_TIMEOUT_MS),
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `Say clearly in a natural American accent: ${text}` }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
          },
        }),
      });
      if (!response.ok) throw new ProviderError(`Gemini TTS ${await readError(response)}`);

      const body = (await response.json()) as GeminiResponse;
      const usage = geminiUsage(body);
      const data = body.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData?.data;
      if (!data) throw new ProviderError("Gemini TTS returned no audio.", usage);
      return {
        audio: pcmToWav(base64ToBytes(data), 24_000),
        mime: "audio/wav",
        usage: { characters: text.length, ...usage },
      };
    },
  };
}

/* ---------------- bytes ---------------- */

export function base64ToBytes(value: string) {
  return new Uint8Array(Buffer.from(value, "base64"));
}

function concatBytes(chunks: Uint8Array[]) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

/** Wraps 16-bit little-endian mono PCM into a WAV container. */
export function pcmToWav(pcm: Uint8Array, sampleRate: number) {
  const header = new DataView(new ArrayBuffer(44));
  const write = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) header.setUint8(offset + index, text.charCodeAt(index));
  };
  write(0, "RIFF");
  header.setUint32(4, 36 + pcm.length, true);
  write(8, "WAVE");
  write(12, "fmt ");
  header.setUint32(16, 16, true);
  header.setUint16(20, 1, true); // PCM
  header.setUint16(22, 1, true); // mono
  header.setUint32(24, sampleRate, true);
  header.setUint32(28, sampleRate * 2, true);
  header.setUint16(32, 2, true);
  header.setUint16(34, 16, true);
  write(36, "data");
  header.setUint32(40, pcm.length, true);
  return concatBytes([new Uint8Array(header.buffer), pcm]);
}
