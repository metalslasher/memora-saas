"use server";

import { cleanEnrichContext, cleanEnrichInput, MAX_BATCH, type EnrichRequest } from "../ai/enrichment";
import { enrichWords, speechUrl, type EnrichedDraft } from "../ai/service";
import { requireActionContext } from "../data/context";
import { fail, ok, type ActionResult } from "./result";

/** AI draft for one word typed in the add form (cached words are free). */
export async function enrichWordAction(input: string): Promise<ActionResult<EnrichedDraft>> {
  try {
    const clean = cleanEnrichInput(input);
    if (!clean) throw new Error("Впиши англійське слово чи фразу (до 60 символів).");
    const { user } = await requireActionContext();
    const [result] = await enrichWords(user.id, [{ input: clean }], "enrich_word");
    if (!result) throw new Error(`AI не впізнав «${clean}» як англійське слово. Перевір написання.`);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}

/** AI drafts for the words picked in a text, in one request. */
export async function enrichPickedWordsAction(
  items: EnrichRequest[],
): Promise<ActionResult<Array<EnrichedDraft | null>>> {
  try {
    if (!Array.isArray(items) || items.length === 0) throw new Error("Обери хоча б одне слово.");
    if (items.length > MAX_BATCH) throw new Error(`За раз можна до ${MAX_BATCH} слів.`);
    const requests = items.map((item) => ({
      input: cleanEnrichInput(item?.input),
      context: cleanEnrichContext(item?.context) || undefined,
    }));
    if (requests.some((request) => !request.input)) throw new Error("Серед обраних є щось, що не схоже на англійське слово.");
    const { user } = await requireActionContext();
    return ok(await enrichWords(user.id, requests, "enrich_batch"));
  } catch (error) {
    return fail(error);
  }
}

/** URL of a natural-voice clip, or null → the client uses the browser voice. */
export async function speechUrlAction(text: string): Promise<ActionResult<string | null>> {
  try {
    if (typeof text !== "string") return ok(null);
    const { user } = await requireActionContext();
    return ok(await speechUrl(user.id, text));
  } catch (error) {
    console.error("speech url failed", error);
    return ok(null);
  }
}
