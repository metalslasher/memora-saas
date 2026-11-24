import { createHash } from "node:crypto";
import { after } from "next/server";
import { createSupabaseAdminClient, type AdminDb } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { lemmaKey } from "../duplicates";
import type { WordContent } from "../types";
import { readWordContent } from "../word-content";
import { AiBlockedError, blockMessage, monthSpendUsd, reserve, settle, type AiFeature } from "./budget";
import { monthlyLimitUsd, textProviderFromEnv, ttsProviderFromEnv } from "./config";
import {
  contentFromEnriched,
  enrichmentSchema,
  enrichmentSystemPrompt,
  enrichmentUserPrompt,
  estimateEnrichmentTokens,
  parseEnrichment,
  type EnrichRequest,
} from "./enrichment";
import { estimateSpeechSeconds, estimateTtsCost, textCost, ttsCost, ttsPrice } from "./pricing";
import { ProviderError } from "./providers";

/** Server-only orchestration: cache → budget → provider → ledger → cache. */

export type AiStatus = {
  /** AI features exist (a provider key and the service key are configured). */
  enabled: boolean;
  /** Set when AI exists but is switched off for now (monthly budget spent). */
  blockedMessage: string | null;
};

export async function getAiStatus(): Promise<AiStatus> {
  const admin = createSupabaseAdminClient();
  if (!admin || !textProviderFromEnv()) return { enabled: false, blockedMessage: null };
  try {
    const spent = await monthSpendUsd(admin);
    return { enabled: true, blockedMessage: spent >= monthlyLimitUsd() ? blockMessage("budget") : null };
  } catch (error) {
    console.error("ai status failed", error);
    return { enabled: true, blockedMessage: null };
  }
}

const unavailable = "AI-помічник зараз недоступний. Заповни слово вручну.";
const providerFailed = "AI не відповів як слід. Спробуй ще раз або заповни вручну.";

function requireAdmin() {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error(unavailable);
  return admin;
}

export type EnrichedDraft = {
  input: string;
  lemma: string;
  content: WordContent;
  lexiconId: string;
};

type LexiconRow = { id: string; lemma: string; content: Json };

async function cachedEntries(admin: AdminDb, keys: string[]) {
  if (keys.length === 0) return new Map<string, LexiconRow>();
  const { data, error } = await admin
    .from("lexicon")
    .select("id,lemma,content")
    .eq("part_of_speech", "")
    .not("enriched_at", "is", null)
    .in("lemma", keys);
  if (error) throw error;
  return new Map(data.map((row) => [row.lemma, row]));
}

/**
 * Enriches words, paying only for the ones the shared lexicon does not have
 * yet (one request for all misses). Returns one result per request; null
 * where the model could not make a card (not an English word, etc.).
 */
export async function enrichWords(
  userId: string,
  requests: EnrichRequest[],
  feature: Extract<AiFeature, "enrich_word" | "enrich_batch" | "program">,
): Promise<Array<EnrichedDraft | null>> {
  const admin = requireAdmin();
  const cache = await cachedEntries(admin, [...new Set(requests.map((request) => lemmaKey(request.input)))]);
  const results: Array<EnrichedDraft | null> = requests.map((request) => {
    const hit = cache.get(lemmaKey(request.input));
    return hit
      ? { input: request.input, lemma: hit.lemma, content: readWordContent(hit.content), lexiconId: hit.id }
      : null;
  });

  const missing = requests
    .map((request, index) => ({ request, index }))
    .filter(({ index }) => results[index] === null);
  if (missing.length === 0) return results;

  const provider = textProviderFromEnv();
  if (!provider) throw new Error(unavailable);

  const asked = missing.map(({ request }) => request);
  const estimate = estimateEnrichmentTokens(asked);
  const reservation = await reserve(admin, {
    userId,
    feature,
    provider: provider.provider,
    model: provider.model,
    estimateUsd: textCost(provider.model, estimate.input, estimate.output * 2),
    monthlyLimitUsd: monthlyLimitUsd(),
  });

  let parsed;
  try {
    const { data, usage } = await provider.generateJson({
      system: enrichmentSystemPrompt,
      user: enrichmentUserPrompt(asked),
      schema: enrichmentSchema,
      schemaName: "vocabulary_cards",
      maxOutputTokens: Math.min(16_000, estimate.output * 3),
    });
    await settle(admin, reservation, {
      status: "ok",
      costUsd: textCost(provider.model, usage.inputTokens, usage.outputTokens),
      ...usage,
    });
    parsed = parseEnrichment(data, asked);
  } catch (error) {
    const usage = error instanceof ProviderError ? error.usage : undefined;
    await settle(admin, reservation, {
      status: "failed",
      costUsd: usage ? textCost(provider.model, usage.inputTokens, usage.outputTokens) : 0,
      ...usage,
    });
    console.error("enrichment failed", error);
    throw new Error(providerFailed);
  }

  const fresh = parsed.flatMap((word) => (word ? [word] : []));
  if (fresh.length > 0) {
    const rows = new Map(
      fresh.map((word) => [
        lemmaKey(word.lemma),
        {
          lemma: lemmaKey(word.lemma),
          part_of_speech: "",
          cefr: word.cefr,
          content: contentFromEnriched(word) as unknown as Json,
          enriched_at: new Date().toISOString(),
          enrich_model: provider.model,
        },
      ]),
    );
    const { data, error } = await admin
      .from("lexicon")
      .upsert([...rows.values()], { onConflict: "lemma,part_of_speech" })
      .select("id,lemma");
    if (error) throw error;
    const ids = new Map(data.map((row) => [row.lemma, row.id]));
    missing.forEach(({ request, index }, position) => {
      const word = parsed[position];
      const lexiconId = word ? ids.get(lemmaKey(word.lemma)) : undefined;
      if (word && lexiconId) {
        results[index] = { input: request.input, lemma: word.lemma, content: contentFromEnriched(word), lexiconId };
      }
    });
  }
  return results;
}

/* ---------------- TTS ---------------- */

export const MAX_SPEECH_LENGTH = 300;
const ttsBucket = "tts";

/** Storage path of a clip: same text + voice → same file, generated once. */
export function speechPath(provider: string, model: string, voice: string, text: string, extension: string) {
  const hash = createHash("sha256").update(`${provider}|${model}|${voice}|${text}`).digest("hex");
  return `${provider}-${voice}/${hash.slice(0, 2)}/${hash}.${extension}`.toLowerCase();
}

/**
 * URL of the clip for this text. A stored clip → its public (CDN) URL. On the
 * first request the clip is generated and returned at once as a data URL;
 * billing and the upload to storage run after the response, so the learner
 * does not wait for them. Null when cloud TTS is not available (no key,
 * budget or rate limit) — the client then falls back to the browser voice.
 */
export async function speechUrl(userId: string, rawText: string): Promise<string | null> {
  const text = rawText.trim().replace(/\s+/g, " ");
  if (!text || text.length > MAX_SPEECH_LENGTH) return null;
  const admin = createSupabaseAdminClient();
  const provider = ttsProviderFromEnv();
  if (!admin || !provider) return null;

  const extension = provider.provider === "gemini" ? "wav" : "mp3";
  const path = speechPath(provider.provider, provider.model, provider.voice, text, extension);
  const storage = admin.storage.from(ttsBucket);
  const publicUrl = storage.getPublicUrl(path).data.publicUrl;

  const exists = await storage.exists(path);
  if (exists.data) return publicUrl;

  let reservation;
  try {
    reservation = await reserve(admin, {
      userId,
      feature: "tts",
      provider: provider.provider,
      model: provider.model,
      estimateUsd: estimateTtsCost(provider.model, text),
      monthlyLimitUsd: monthlyLimitUsd(),
    });
  } catch (error) {
    if (error instanceof AiBlockedError) return null;
    throw error;
  }

  try {
    const { audio, mime, usage } = await provider.synthesize(text);
    // Without reported usage, bill the conservative estimate.
    const costUsd =
      usage.outputTokens !== undefined || ttsPrice(provider.model).perMillionChars !== undefined
        ? ttsCost(provider.model, usage)
        : estimateTtsCost(provider.model, text);
    const audioSeconds =
      mime === "audio/wav" ? Math.max(0, audio.length - 44) / 48_000 : estimateSpeechSeconds(text);
    after(async () => {
      await settle(admin, reservation, {
        status: "ok",
        costUsd,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        characters: usage.characters,
        audioSeconds: Math.round(audioSeconds * 100) / 100,
      });
      const upload = await storage.upload(path, audio, {
        contentType: mime,
        cacheControl: "31536000",
        upsert: false,
      });
      // A parallel request may have stored the same clip first — that is fine.
      if (upload.error && !/exists|duplicate/i.test(upload.error.message)) {
        console.error("tts upload failed", upload.error);
      }
    });
    return `data:${mime};base64,${Buffer.from(audio).toString("base64")}`;
  } catch (error) {
    // Billed tokens on a failed call are charged at the estimate.
    const billed = error instanceof ProviderError && error.usage;
    await settle(admin, reservation, {
      status: "failed",
      costUsd: billed ? estimateTtsCost(provider.model, text) : 0,
    });
    console.error("tts failed", error);
    return null;
  }
}
