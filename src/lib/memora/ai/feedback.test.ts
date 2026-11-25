import { describe, expect, it } from "vitest";
import { transcribeProviderFromEnv } from "./config";
import {
  cleanSentence,
  estimateFeedbackTokens,
  feedbackSchema,
  feedbackSystemPrompt,
  feedbackUserPrompt,
  parseFeedback,
  transcriptionPrompt,
} from "./feedback";
import { textCost, transcribeCost } from "./pricing";
import { openAiTranscribeProvider, ProviderError } from "./providers";

const request = {
  lemma: "reliable",
  content: { translations: ["надійний"], examples: [], part_of_speech: "adjective" },
  idea: "про роботу чи навчання",
  text: "My car is very reliable, I drive it ten years.",
};

describe("sentence feedback", () => {
  it("asks for a strict schema with every field required", () => {
    expect(feedbackSchema.required).toEqual(["verdict", "mistakes", "natural", "comment"]);
    expect(feedbackSchema.properties.mistakes.items.required).toEqual(["wrong", "right", "why"]);
  });

  it("adds the speech note only for speaking", () => {
    expect(feedbackSystemPrompt("sentence")).not.toMatch(/transcript/);
    expect(feedbackSystemPrompt("speaking")).toMatch(/transcript/);
  });

  it("passes the learner text as data with the word and the idea", () => {
    const prompt = JSON.parse(feedbackUserPrompt(request));
    expect(prompt).toMatchObject({
      target_word: "reliable",
      meaning_uk: "надійний",
      task_idea_uk: "про роботу чи навчання",
      learner_text: request.text,
    });
  });

  it("cleans the sentence and refuses empty or too long input", () => {
    expect(cleanSentence("  I   like it \n")).toBe("I like it");
    expect(cleanSentence("")).toBe("");
    expect(cleanSentence("a".repeat(301))).toBe("");
    expect(cleanSentence(42)).toBe("");
  });

  it("validates the model output", () => {
    const parsed = parseFeedback({
      verdict: "minor",
      mistakes: [
        { wrong: "I drive it ten years", right: "I've been driving it for ten years", why: "тривалість — Present Perfect" },
        { wrong: "very", right: "very", why: "same" },
        { wrong: "a", right: "b", why: "c" },
        { wrong: "x", right: "y", why: "z" },
      ],
      natural: "My car's really reliable — I've had it for ten years.",
      comment: "Слово вжито правильно. Для тривалості потрібен Present Perfect.",
    });
    expect(parsed?.verdict).toBe("minor");
    // Identical "fixes" are dropped, at most two mistakes stay.
    expect(parsed?.mistakes.map((mistake) => mistake.right)).toEqual(["I've been driving it for ten years", "b"]);
    expect(parseFeedback({ verdict: "great", mistakes: [], natural: "x", comment: "y" })).toBeNull();
    expect(parseFeedback({ verdict: "good", mistakes: [], natural: "", comment: "" })).toBeNull();
    expect(parseFeedback(null)).toBeNull();
  });

  it("estimates a fraction of a cent per sentence", () => {
    const estimate = estimateFeedbackTokens(request);
    expect(textCost("gpt-6-luna", estimate.input, 600)).toBeLessThan(0.001);
  });

  it("keeps the target word out of the transcription prompt", () => {
    expect(transcriptionPrompt).not.toMatch(/reliable/);
    expect(transcriptionPrompt).toMatch(/Do not correct/);
  });
});

describe("transcription", () => {
  it("bills per minute or by tokens", () => {
    expect(transcribeCost("gpt-transcribe", {}, 60)).toBeCloseTo(0.0045, 6);
    expect(transcribeCost("gpt-transcribe", { seconds: 10 }, 15)).toBeCloseTo(0.00075, 6);
    expect(transcribeCost("gpt-4o-mini-transcribe", { inputTokens: 1_000_000, outputTokens: 0 }, 5)).toBeCloseTo(1.25, 6);
    expect(() => transcribeCost("whisper-9", {}, 5)).toThrow(/No price/);
  });

  it("uses gpt-transcribe by default and needs the OpenAI key", () => {
    expect(transcribeProviderFromEnv({})).toBeNull();
    expect(transcribeProviderFromEnv({ OPENAI_API_KEY: "k" })?.model).toBe("gpt-transcribe");
    expect(transcribeProviderFromEnv({ OPENAI_API_KEY: "k", MEMORA_TRANSCRIBE_MODEL: "gpt-4o-mini-transcribe" })?.model).toBe(
      "gpt-4o-mini-transcribe",
    );
    expect(transcribeProviderFromEnv({ OPENAI_API_KEY: "k", MEMORA_TRANSCRIBE_MODEL: "nope" })?.model).toBe("gpt-transcribe");
  });

  it("sends the audio as multipart and reads text and usage", async () => {
    let sent: FormData | null = null;
    const provider = openAiTranscribeProvider("key", "gpt-transcribe", async (_url, init) => {
      sent = init?.body as FormData;
      return new Response(JSON.stringify({ text: " My car is reliable. ", usage: { type: "duration", seconds: 3 } }));
    });
    const result = await provider.transcribe(new Blob(["x"], { type: "audio/webm" }), {
      fileName: "speech.webm",
      prompt: "p",
    });
    expect(result).toEqual({ text: "My car is reliable.", usage: { seconds: 3 } });
    const form = sent as unknown as FormData;
    expect(form.get("model")).toBe("gpt-transcribe");
    expect(form.get("language")).toBe("en");
    expect((form.get("file") as File).name).toBe("speech.webm");
  });

  it("reads token usage and reports failures", async () => {
    const tokens = openAiTranscribeProvider("key", "gpt-4o-mini-transcribe", async () =>
      new Response(JSON.stringify({ text: "hi", usage: { type: "tokens", input_tokens: 50, output_tokens: 5 } })),
    );
    expect((await tokens.transcribe(new Blob(["x"]), { fileName: "a.webm", prompt: "" })).usage).toEqual({
      inputTokens: 50,
      outputTokens: 5,
    });
    const failing = openAiTranscribeProvider("key", "gpt-transcribe", async () => new Response("bad", { status: 400 }));
    await expect(failing.transcribe(new Blob(["x"]), { fileName: "a.webm", prompt: "" })).rejects.toBeInstanceOf(ProviderError);
  });
});
