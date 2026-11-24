import { describe, expect, it, vi } from "vitest";
import { blockMessage, budgetResetLabel } from "./budget";
import { monthlyLimitUsd, textProviderFromEnv, ttsProviderFromEnv } from "./config";
import {
  cleanEnrichInput,
  contentFromEnriched,
  enrichmentSchema,
  estimateEnrichmentTokens,
  parseEnrichedWord,
  parseEnrichment,
} from "./enrichment";
import { estimateTtsCost, textCost, ttsCost } from "./pricing";
import {
  geminiTextProvider,
  geminiTtsProvider,
  openAiTextProvider,
  openAiTtsProvider,
  parseSpeechEvents,
  pcmToWav,
  ProviderError,
  toGeminiSchema,
} from "./providers";

const goodItem = {
  input: "figured out",
  lemma: "figure out",
  part_of_speech: "phrasal verb",
  translations: ["зрозуміти", "розібратися", "зрозуміти"],
  explanation: "Знайти відповідь або зрозуміти щось після роздумів.",
  examples: [
    { en: "That makes sense now.", uk: "Тепер це має сенс." },
    { en: "I finally figured it out.", uk: "Я нарешті розібрався." },
    { en: "", uk: "порожньо" },
  ],
  accepted: [],
  synonyms: ["solve", "Figure out"],
  forms: ["figured out", "figuring out"],
  cefr: "B1",
  frequency: "high",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("pricing", () => {
  it("bills tokens by the model's per-million rates", () => {
    // gpt-5-nano: $0.05 in, $0.40 out
    expect(textCost("gpt-5-nano", 1_000_000, 1_000_000)).toBeCloseTo(0.45, 6);
    expect(textCost("gemini-3.1-flash-lite", 2000, 1000)).toBeCloseTo(0.002, 6);
  });

  it("refuses unknown models instead of guessing a price", () => {
    expect(() => textCost("gpt-unknown", 1, 1)).toThrow(/No price/);
  });

  it("bills TTS by characters or by audio tokens", () => {
    expect(ttsCost("tts-1", { characters: 1_000_000 })).toBeCloseTo(15, 6);
    expect(ttsCost("gpt-4o-mini-tts", { characters: 10, inputTokens: 0, outputTokens: 1_000_000 })).toBeCloseTo(12, 6);
  });

  it("estimates a TTS call above the likely real cost", () => {
    const text = "I finally figured it out.";
    const estimate = estimateTtsCost("gpt-4o-mini-tts", text);
    const likely = ttsCost("gpt-4o-mini-tts", { characters: text.length, inputTokens: 8, outputTokens: 2 * 21 });
    expect(estimate).toBeGreaterThan(likely);
    expect(estimate).toBeLessThan(0.01);
  });
});

describe("enrichment parsing", () => {
  it("cleans a model item and puts the cloze-ready example first", () => {
    const word = parseEnrichedWord(goodItem)!;
    expect(word.lemma).toBe("figure out");
    expect(word.translations).toEqual(["зрозуміти", "розібратися"]);
    expect(word.examples[0].en).toBe("I finally figured it out.");
    expect(word.examples).toHaveLength(2);
    expect(word.synonyms).toEqual(["solve"]);
  });

  it("rejects items without a lemma or translation", () => {
    expect(parseEnrichedWord({ ...goodItem, lemma: "" })).toBeNull();
    expect(parseEnrichedWord({ ...goodItem, translations: [] })).toBeNull();
    expect(parseEnrichedWord("nope")).toBeNull();
  });

  it("falls back to safe enum values", () => {
    const word = parseEnrichedWord({ ...goodItem, cefr: "Z9", frequency: "often", part_of_speech: "thing" })!;
    expect(word.cefr).toBe("B1");
    expect(word.frequency).toBe("medium");
    expect(word.part_of_speech).toBe("other");
  });

  it("matches batch items by echoed input, then by position", () => {
    const requests = [{ input: "cat" }, { input: "figured out" }, { input: "xyzzy" }];
    const raw = {
      items: [
        goodItem,
        { ...goodItem, input: "cat", lemma: "cat", translations: ["кіт"], examples: [] },
        { ...goodItem, input: "xyzzy", lemma: "", translations: [] },
      ],
    };
    const result = parseEnrichment(raw, requests);
    expect(result[0]?.lemma).toBe("cat");
    expect(result[1]?.lemma).toBe("figure out");
    expect(result[2]).toBeNull();
  });

  it("maps to WordContent the exercises understand", () => {
    const content = contentFromEnriched(parseEnrichedWord(goodItem)!);
    expect(content.translations[0]).toBe("зрозуміти");
    expect(content.examples[0].uk).toBe("Я нарешті розібрався.");
    expect(content.forms).toContain("figuring out");
    expect(content.accepted).toBeUndefined();
  });

  it("accepts only short Latin-script input", () => {
    expect(cleanEnrichInput("  figure out!  ")).toBe("figure out");
    expect(cleanEnrichInput("привіт")).toBe("");
    expect(cleanEnrichInput("a".repeat(61))).toBe("");
  });

  it("estimates more output for bigger batches", () => {
    const one = estimateEnrichmentTokens([{ input: "cat" }]);
    const five = estimateEnrichmentTokens(Array.from({ length: 5 }, () => ({ input: "cat" })));
    expect(five.output).toBeGreaterThan(one.output * 3);
  });
});

describe("providers", () => {
  it("OpenAI: sends a strict JSON schema and reports usage", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        choices: [{ message: { content: JSON.stringify({ items: [goodItem] }) } }],
        usage: { prompt_tokens: 900, completion_tokens: 400 },
      }),
    );
    const provider = openAiTextProvider("key", "gpt-5-nano", fetchMock as unknown as typeof fetch);
    const result = await provider.generateJson({
      system: "s",
      user: "u",
      schema: enrichmentSchema,
      schemaName: "cards",
      maxOutputTokens: 1000,
    });
    expect(result.usage).toEqual({ inputTokens: 900, outputTokens: 400 });
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.reasoning_effort).toBe("minimal");
  });

  it("OpenAI: an HTTP error becomes a ProviderError", async () => {
    const fetchMock = vi.fn(async () => new Response("rate limited", { status: 429 }));
    const provider = openAiTextProvider("key", "gpt-5-nano", fetchMock as unknown as typeof fetch);
    await expect(
      provider.generateJson({ system: "s", user: "u", schema: {}, schemaName: "x", maxOutputTokens: 10 }),
    ).rejects.toBeInstanceOf(ProviderError);
  });

  it("Gemini: strips unsupported schema keys and counts thinking as output", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        candidates: [{ content: { parts: [{ text: '{"items":[]}' }] } }],
        usageMetadata: { promptTokenCount: 800, candidatesTokenCount: 300, thoughtsTokenCount: 50 },
      }),
    );
    const provider = geminiTextProvider("key", "gemini-3.1-flash-lite", fetchMock as unknown as typeof fetch);
    const result = await provider.generateJson({
      system: "s",
      user: "u",
      schema: enrichmentSchema,
      schemaName: "cards",
      maxOutputTokens: 1000,
    });
    expect(result.usage).toEqual({ inputTokens: 800, outputTokens: 350 });
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(JSON.stringify(body.generationConfig.responseJsonSchema)).not.toContain("additionalProperties");
    expect(JSON.stringify(toGeminiSchema(enrichmentSchema))).toContain("translations");
  });

  it("Gemini: invalid JSON keeps the billed usage", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        candidates: [{ content: { parts: [{ text: "{oops" }] } }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
      }),
    );
    const provider = geminiTextProvider("key", "gemini-3.1-flash-lite", fetchMock as unknown as typeof fetch);
    const error = await provider
      .generateJson({ system: "s", user: "u", schema: {}, schemaName: "x", maxOutputTokens: 10 })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ProviderError);
    expect((error as ProviderError).usage).toEqual({ inputTokens: 10, outputTokens: 5 });
  });

  it("OpenAI TTS: joins streamed MP3 chunks and reads usage", async () => {
    const chunk = Buffer.from([1, 2, 3]).toString("base64");
    const sse = [
      `data: {"type":"speech.audio.delta","audio":"${chunk}"}`,
      `data: {"type":"speech.audio.delta","audio":"${chunk}"}`,
      'data: {"type":"speech.audio.done","usage":{"input_tokens":7,"output_tokens":60}}',
      "",
    ].join("\n");
    const fetchMock = vi.fn(async () => new Response(sse));
    const provider = openAiTtsProvider("key", "gpt-4o-mini-tts", "alloy", fetchMock as unknown as typeof fetch);
    const result = await provider.synthesize("Hello there");
    expect(result.audio).toEqual(new Uint8Array([1, 2, 3, 1, 2, 3]));
    expect(result.usage).toEqual({ characters: 11, inputTokens: 7, outputTokens: 60 });
    expect(parseSpeechEvents("data: [DONE]").usage).toBeNull();
  });

  it("Gemini TTS: wraps PCM into a WAV file", async () => {
    const pcm = Buffer.from(new Uint8Array(4800)).toString("base64");
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        candidates: [{ content: { parts: [{ inlineData: { mimeType: "audio/L16", data: pcm } }] } }],
        usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 3 },
      }),
    );
    const provider = geminiTtsProvider("key", "gemini-2.5-flash-preview-tts", "Kore", fetchMock as unknown as typeof fetch);
    const result = await provider.synthesize("Hi");
    expect(result.mime).toBe("audio/wav");
    expect(result.audio.length).toBe(4844);
    expect(Buffer.from(result.audio.slice(0, 4)).toString()).toBe("RIFF");
    expect(pcmToWav(new Uint8Array(2), 24000).length).toBe(46);
  });
});

describe("config and budget messages", () => {
  it("needs the chosen provider's key", () => {
    expect(textProviderFromEnv({ MEMORA_AI_PROVIDER: "openai" })).toBeNull();
    expect(textProviderFromEnv({ MEMORA_AI_PROVIDER: "openai", OPENAI_API_KEY: "k" })?.model).toBe("gpt-6-luna");
    expect(textProviderFromEnv({ OPENAI_API_KEY: "k", MEMORA_AI_TEXT_MODEL: "gpt-5-nano" })?.model).toBe("gpt-5-nano");
    expect(
      textProviderFromEnv({ MEMORA_AI_PROVIDER: "gemini", GEMINI_API_KEY: "k", MEMORA_AI_TEXT_MODEL: "gpt-5-nano" })
        ?.model,
    ).toBe("gemini-3.1-flash-lite");
    expect(ttsProviderFromEnv({ MEMORA_TTS_PROVIDER: "gemini", GEMINI_API_KEY: "k" })?.voice).toBe("Kore");
  });

  it("reads the monthly limit with a $10 default", () => {
    expect(monthlyLimitUsd({})).toBe(10);
    expect(monthlyLimitUsd({ MEMORA_AI_MONTHLY_LIMIT_USD: "0.5" })).toBe(0.5);
    expect(monthlyLimitUsd({ MEMORA_AI_MONTHLY_LIMIT_USD: "-1" })).toBe(10);
  });

  it("says when AI comes back", () => {
    expect(budgetResetLabel(new Date("2026-11-23T10:00:00Z"))).toBe("1 грудня");
    expect(budgetResetLabel(new Date("2026-12-05T10:00:00Z"))).toBe("1 січня");
    expect(blockMessage("budget", new Date("2026-11-23T10:00:00Z"))).toContain("до 1 грудня");
  });
});
