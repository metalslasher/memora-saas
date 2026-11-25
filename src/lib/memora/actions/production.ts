"use server";

import { AiBlockedError, productionBlockMessage, type BlockReason } from "../ai/budget";
import { cleanSentence } from "../ai/feedback";
import { sentenceFeedback, transcribeSpeech } from "../ai/production-service";
import { requireActionContext } from "../data/context";
import { must, type Db } from "../data/db";
import {
  heardWord,
  isProductionKind,
  MAX_AUDIO_BYTES,
  MAX_RECORDING_SECONDS,
  MAX_SENTENCE_LENGTH,
  ratingFromFeedback,
  sentenceIdea,
  type ProductionKind,
  type SentenceFeedback,
} from "../production";
import type { ReviewRating } from "../types";
import { validateId } from "../validation";
import { readWordContent } from "../word-content";
import { fail, ok, type ActionResult } from "./result";

export type ProductionCheck =
  | {
      status: "ok";
      feedback: SentenceFeedback;
      /** Suggested FSRS rating (the learner may change it). */
      rating: ReviewRating;
      /** Speaking only: what the model heard, and whether the target word is in it. */
      transcript?: string;
      heard?: boolean;
    }
  /** Speaking: nothing intelligible on the recording (no feedback call was made). */
  | { status: "silent" }
  | { status: "blocked"; reason: BlockReason; message: string };

/** The card from the database (never trust the client for the word). */
async function productionCard(db: Db, cardId: string, kind: ProductionKind) {
  const card = must(
    await db.from("cards").select("id,kind,reps,user_words(lemma,content)").eq("id", cardId).single(),
  );
  if (!isProductionKind(card.kind) || card.kind !== kind || !card.user_words) throw new Error("Картку не знайдено.");
  return {
    lemma: card.user_words.lemma,
    content: readWordContent(card.user_words.content),
    idea: sentenceIdea(card.id, card.reps),
  };
}

function blocked(error: unknown): ProductionCheck | null {
  return error instanceof AiBlockedError
    ? { status: "blocked", reason: error.reason, message: productionBlockMessage(error.reason) }
    : null;
}

/** "Своє речення": AI feedback on the learner's sentence. */
export async function checkSentenceAction(input: { cardId: string; text: string }): Promise<ActionResult<ProductionCheck>> {
  try {
    const cardId = validateId(input?.cardId, "Картку");
    const text = cleanSentence(input?.text);
    if (!text) throw new Error(`Напиши речення англійською — до ${MAX_SENTENCE_LENGTH} символів.`);
    const { supabase, user } = await requireActionContext();
    const word = await productionCard(supabase, cardId, "sentence");
    const feedback = await sentenceFeedback(user.id, "sentence", { ...word, text });
    return ok({ status: "ok", feedback, rating: ratingFromFeedback(feedback) });
  } catch (error) {
    const result = blocked(error);
    return result ? ok(result) : fail(error);
  }
}

const audioExtensions: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "mp4",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-m4a": "m4a",
  "audio/aac": "m4a",
};

/**
 * "Скажи вголос": speech → text → the same feedback as for a written
 * sentence. The recording goes straight to the transcription model and is
 * not stored anywhere.
 */
export async function checkSpeechAction(form: FormData): Promise<ActionResult<ProductionCheck>> {
  try {
    const cardId = validateId(form.get("cardId"), "Картку");
    const audio = form.get("audio");
    if (!(audio instanceof Blob) || audio.size < 500) throw new Error("Запис порожній. Спробуй ще раз.");
    if (audio.size > MAX_AUDIO_BYTES) throw new Error("Запис задовгий. Скажи одне речення — до 15 секунд.");
    const mime = audio.type.split(";")[0].trim().toLowerCase();
    const extension = audioExtensions[mime];
    if (!extension) throw new Error("Цей формат запису не підтримується. Спробуй у Chrome.");
    const rawSeconds = Number(form.get("seconds"));
    const seconds = Number.isFinite(rawSeconds) ? Math.min(Math.max(rawSeconds, 0.5), MAX_RECORDING_SECONDS + 1) : MAX_RECORDING_SECONDS;

    const { supabase, user } = await requireActionContext();
    const word = await productionCard(supabase, cardId, "speaking");
    const transcript = (await transcribeSpeech(user.id, audio, { fileName: `speech.${extension}`, seconds }))
      .replace(/\s+/g, " ")
      .slice(0, MAX_SENTENCE_LENGTH);
    if (!/[a-z]{2,}/i.test(transcript)) return ok({ status: "silent" });

    const feedback = await sentenceFeedback(user.id, "speaking", { ...word, text: transcript });
    return ok({
      status: "ok",
      feedback,
      rating: ratingFromFeedback(feedback),
      transcript,
      heard: heardWord(transcript, word.lemma, word.content.forms),
    });
  } catch (error) {
    const result = blocked(error);
    return result ? ok(result) : fail(error);
  }
}
