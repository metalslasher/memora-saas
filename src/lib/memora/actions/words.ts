"use server";

import { MAX_IMPORT_ROWS } from "../csv-import";
import { requireActionContext } from "../data/context";
import {
  addWord,
  deleteWord,
  insertWordsWithCards,
  listLemmaKeys,
  setWordStatus,
  updateWord,
} from "../data/words";
import { lemmaKey } from "../duplicates";
import type { WordContent, WordDraft, WordListItem, WordStatus } from "../types";
import { validateId, validateWordStatus } from "../validation";
import { contentFromDraft, validateWordDraft, wordDraftErrors, normalizeWordDraft } from "../word-content";
import { fail, ok, type ActionResult } from "./result";

export async function addWordAction(draft: WordDraft): Promise<ActionResult<WordListItem>> {
  try {
    const clean = validateWordDraft(draft);
    const { supabase } = await requireActionContext();
    return ok(await addWord(supabase, clean));
  } catch (error) {
    return fail(error);
  }
}

export async function updateWordAction(
  id: string,
  draft: WordDraft,
): Promise<ActionResult<{ lemma: string; content: WordContent }>> {
  try {
    const cleanId = validateId(id, "Слово");
    const clean = validateWordDraft(draft);
    const { supabase } = await requireActionContext();
    return ok(await updateWord(supabase, cleanId, clean));
  } catch (error) {
    return fail(error);
  }
}

export async function setWordStatusAction(id: string, status: WordStatus): Promise<ActionResult> {
  try {
    const cleanId = validateId(id, "Слово");
    const cleanStatus = validateWordStatus(status);
    const { supabase } = await requireActionContext();
    await setWordStatus(supabase, cleanId, cleanStatus);
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export async function deleteWordAction(id: string): Promise<ActionResult> {
  try {
    const cleanId = validateId(id, "Слово");
    const { supabase } = await requireActionContext();
    await deleteWord(supabase, cleanId);
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export type ImportResult = {
  imported: WordListItem[];
  skippedDuplicates: number;
  invalidRows: number;
};

/**
 * Imports CSV rows. Rows are re-validated here; duplicates (of the library
 * or of earlier rows) are skipped.
 */
export async function importWordsAction(rows: WordDraft[]): Promise<ActionResult<ImportResult>> {
  try {
    if (!Array.isArray(rows) || rows.length === 0) throw new Error("Немає рядків для імпорту.");
    if (rows.length > MAX_IMPORT_ROWS) {
      throw new Error(`За один раз можна імпортувати до ${MAX_IMPORT_ROWS} рядків.`);
    }

    const { supabase } = await requireActionContext();
    const existing = await listLemmaKeys(supabase);
    let skippedDuplicates = 0;
    let invalidRows = 0;
    const words = [];

    for (const row of rows) {
      if (wordDraftErrors(row).length > 0) {
        invalidRows += 1;
        continue;
      }
      const draft = normalizeWordDraft(row);
      const key = lemmaKey(draft.lemma);
      if (existing.has(key)) {
        skippedDuplicates += 1;
        continue;
      }
      existing.add(key);
      words.push({ lemma: draft.lemma, content: contentFromDraft(draft), source: "import" as const });
    }

    const imported = await insertWordsWithCards(supabase, words);
    return ok({ imported, skippedDuplicates, invalidRows });
  } catch (error) {
    return fail(error);
  }
}
