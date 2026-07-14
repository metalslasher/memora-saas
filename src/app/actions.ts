"use server";

import { revalidatePath } from "next/cache";
import {
  validateEnglishDraft,
  validateId,
  validateItemStatus,
  validateProfileDraft,
  validateQaDraft,
  validateReviewInput,
  validateSettings,
} from "@/lib/memora/action-validation";
import { normalizeBackupDocument } from "@/lib/memora/backup";
import type { EnglishDraft, QaDraft } from "@/lib/memora/card-generator";
import { findDuplicateNotes, normalizeLookupText } from "@/lib/memora/duplicates";
import {
  ensureRemoteProfile,
  loadRemoteProfile,
  loadRemoteMemoraState,
  remoteAddEnglishNote,
  remoteAddQaNote,
  remoteImportEnglishNotes,
  remoteImportQaNotes,
  remoteReviewCard,
  remoteRestoreBackup,
  remoteSuspendCard,
  remoteUpdateCardStatus,
  remoteUpdateNoteContent,
  remoteUpdateNoteStatus,
  remoteUpdateProfile,
  remoteUpdateSettings,
  type ImportCommitRow,
  type NoteContentDraft,
} from "@/lib/memora/remote-store";
import type {
  AppSettings,
  MemoraState,
  ReviewRating,
  UserProfile,
  UserProfileDraft,
} from "@/lib/memora/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ActionResult = {
  ok: true;
  state: MemoraState;
} | {
  ok: false;
  error: string;
};

type ImportActionResult = {
  ok: true;
  state: MemoraState;
  importedCount: number;
  skippedDuplicates: number;
  invalidRows: number;
} | {
  ok: false;
  error: string;
};

type ProfileActionResult = {
  ok: true;
  profile: UserProfile;
} | {
  ok: false;
  error: string;
};

type ImportOptions = {
  fileName?: string;
  skipDuplicates?: boolean;
};

type ClientImportRow<TDraft> = {
  rowNumber: number;
  draft?: TDraft;
  errors?: string[];
  raw?: Record<string, string>;
};

export async function loadMemoraStateAction(): Promise<ActionResult> {
  try {
    const { supabase, user } = await getAuthenticatedContext();
    await ensureRemoteProfile(supabase, user.id, user.email ?? null);

    return ok(await loadRemoteMemoraState(supabase, user.id));
  } catch (error) {
    return fail(error);
  }
}

export async function loadProfileAction(): Promise<ProfileActionResult> {
  try {
    const { supabase, user } = await getAuthenticatedContext();
    const profile = await loadRemoteProfile(
      supabase,
      user.id,
      user.email ?? null,
    );

    return profileOk(profile);
  } catch (error) {
    return profileFail(error);
  }
}

export async function updateProfileAction(
  draft: UserProfileDraft,
): Promise<ProfileActionResult> {
  try {
    const cleanDraft = validateProfileDraft(draft);
    const { supabase, user } = await getAuthenticatedContext();
    await ensureRemoteProfile(supabase, user.id, user.email ?? null);
    const profile = await remoteUpdateProfile(supabase, user.id, cleanDraft);
    revalidatePath("/");

    return profileOk(profile);
  } catch (error) {
    return profileFail(error);
  }
}

export async function updateSettingsAction(
  settings: AppSettings,
): Promise<ActionResult> {
  try {
    const nextSettings = validateSettings(settings);
    const { supabase, state } = await getStateContext();
    const nextState = await remoteUpdateSettings(supabase, state, nextSettings);
    revalidatePath("/");

    return ok(nextState);
  } catch (error) {
    return fail(error);
  }
}

export async function restoreBackupAction(backup: unknown): Promise<ActionResult> {
  try {
    const backupDocument = normalizeBackupDocument(backup);
    const { supabase, user } = await getAuthenticatedContext();
    await ensureRemoteProfile(supabase, user.id, user.email ?? null);
    const nextState = await remoteRestoreBackup(
      supabase,
      user.id,
      backupDocument.state,
    );
    revalidatePath("/");

    return ok(nextState);
  } catch (error) {
    return fail(error);
  }
}

export async function reviewCardAction(input: {
  cardId: string;
  rating: ReviewRating;
  responseText: string;
  elapsedMs: number;
}): Promise<ActionResult> {
  try {
    const reviewInput = validateReviewInput(input);
    const { supabase, state } = await getStateContext();
    const nextState = await remoteReviewCard(
      supabase,
      state,
      reviewInput.cardId,
      reviewInput.rating,
      reviewInput.responseText,
      reviewInput.elapsedMs,
    );
    revalidatePath("/");

    return ok(nextState);
  } catch (error) {
    return fail(error);
  }
}

export async function suspendCardAction(cardId: string): Promise<ActionResult> {
  try {
    const cleanCardId = validateId(cardId, "Картку");
    const { supabase, state } = await getStateContext();
    const nextState = await remoteSuspendCard(supabase, state, cleanCardId);
    revalidatePath("/");

    return ok(nextState);
  } catch (error) {
    return fail(error);
  }
}

export async function updateCardStatusAction(
  cardId: string,
  status: "active" | "suspended" | "archived",
): Promise<ActionResult> {
  try {
    const cleanCardId = validateId(cardId, "Картку");
    const cleanStatus = validateItemStatus(status);
    const { supabase, state } = await getStateContext();
    const nextState = await remoteUpdateCardStatus(
      supabase,
      state,
      cleanCardId,
      cleanStatus,
    );
    revalidatePath("/");

    return ok(nextState);
  } catch (error) {
    return fail(error);
  }
}

export async function updateNoteStatusAction(
  noteId: string,
  status: "active" | "suspended" | "archived",
): Promise<ActionResult> {
  try {
    const cleanNoteId = validateId(noteId, "Матеріал");
    const cleanStatus = validateItemStatus(status);
    const { supabase, state } = await getStateContext();
    const nextState = await remoteUpdateNoteStatus(
      supabase,
      state,
      cleanNoteId,
      cleanStatus,
    );
    revalidatePath("/");

    return ok(nextState);
  } catch (error) {
    return fail(error);
  }
}

export async function updateNoteContentAction(
  noteId: string,
  content: NoteContentDraft,
): Promise<ActionResult> {
  try {
    const cleanNoteId = validateId(noteId, "Матеріал");
    const { supabase, state } = await getStateContext();
    const nextState = await remoteUpdateNoteContent(
      supabase,
      state,
      cleanNoteId,
      content,
    );
    revalidatePath("/");

    return ok(nextState);
  } catch (error) {
    return fail(error);
  }
}

export async function addEnglishNoteAction(
  draft: EnglishDraft,
): Promise<ActionResult> {
  try {
    const cleanDraft = validateEnglishDraft(draft);
    const { supabase } = await getAuthenticatedContext();
    const nextState = await remoteAddEnglishNote(supabase, cleanDraft);
    revalidatePath("/");

    return ok(nextState);
  } catch (error) {
    return fail(error);
  }
}

export async function addQaNoteAction(draft: QaDraft): Promise<ActionResult> {
  try {
    const cleanDraft = validateQaDraft(draft);
    const { supabase } = await getAuthenticatedContext();
    const nextState = await remoteAddQaNote(supabase, cleanDraft);
    revalidatePath("/");

    return ok(nextState);
  } catch (error) {
    return fail(error);
  }
}

export async function importEnglishNotesAction(
  rows: Array<ClientImportRow<EnglishDraft>>,
  options: ImportOptions = {},
): Promise<ImportActionResult> {
  try {
    const { supabase, state } = await getStateContext();
    const importPlan = planEnglishImportRows(
      rows,
      state,
      options.skipDuplicates ?? true,
    );
    const nextState = await remoteImportEnglishNotes(
      supabase,
      cleanImportFileName(options.fileName, "english"),
      importPlan.rows,
    );

    revalidatePath("/");

    return importOk(
      nextState,
      importPlan.importedCount,
      importPlan.skippedDuplicates,
      importPlan.invalidRows,
    );
  } catch (error) {
    return importFail(error);
  }
}

export async function importQaNotesAction(
  rows: Array<ClientImportRow<QaDraft>>,
  options: ImportOptions = {},
): Promise<ImportActionResult> {
  try {
    const { supabase, state } = await getStateContext();
    const importPlan = planQaImportRows(
      rows,
      state,
      options.skipDuplicates ?? true,
    );
    const nextState = await remoteImportQaNotes(
      supabase,
      cleanImportFileName(options.fileName, "qa"),
      importPlan.rows,
    );

    revalidatePath("/");

    return importOk(
      nextState,
      importPlan.importedCount,
      importPlan.skippedDuplicates,
      importPlan.invalidRows,
    );
  } catch (error) {
    return importFail(error);
  }
}

async function getAuthenticatedContext() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) throw error;
  if (!data.user) throw new Error("Потрібно увійти в Memora.");

  return { supabase, user: data.user };
}

async function getStateContext() {
  const { supabase, user } = await getAuthenticatedContext();
  const state = await loadRemoteMemoraState(supabase, user.id);

  return { supabase, user, state };
}

function ok(state: MemoraState): ActionResult {
  return { ok: true, state };
}

function importOk(
  state: MemoraState,
  importedCount: number,
  skippedDuplicates: number,
  invalidRows: number,
): ImportActionResult {
  return { ok: true, state, importedCount, skippedDuplicates, invalidRows };
}

function profileOk(profile: UserProfile): ProfileActionResult {
  return { ok: true, profile };
}

function fail(error: unknown): ActionResult {
  if (error instanceof Error) return { ok: false, error: error.message };

  if (typeof error === "object" && error && "message" in error) {
    return {
      ok: false,
      error: String((error as { message?: unknown }).message ?? "Невідома помилка."),
    };
  }

  return { ok: false, error: "Невідома помилка." };
}

function importFail(error: unknown): ImportActionResult {
  const result = fail(error);
  return result.ok ? { ok: false, error: "Невідома помилка." } : result;
}

function profileFail(error: unknown): ProfileActionResult {
  const result = fail(error);
  return result.ok ? { ok: false, error: "Невідома помилка." } : result;
}

function planEnglishImportRows(
  clientRows: Array<ClientImportRow<EnglishDraft>>,
  state: MemoraState,
  skipDuplicates: boolean,
) {
  const rows = validateClientImportRows(clientRows);
  const seen = new Set<string>();
  const plannedRows: Array<ImportCommitRow<EnglishDraft>> = [];
  let importedCount = 0;
  let skippedDuplicates = 0;
  let invalidRows = 0;

  for (const row of rows) {
    const raw = normalizeRawImportRow(row.raw);
    if (!row.draft) {
      invalidRows += 1;
      plannedRows.push({
        rowNumber: row.rowNumber,
        status: "invalid",
        errors: row.errors?.length ? row.errors : ["Некоректний рядок."],
        raw,
      });
      continue;
    }

    try {
      const draft = validateEnglishDraft(row.draft);
      const key = normalizeLookupText(draft.lemma);
      const isDuplicate =
        skipDuplicates &&
        (seen.has(key) ||
          findDuplicateNotes(state.notes, {
            module: "english",
            lemma: draft.lemma,
          }).length > 0);

      if (isDuplicate) {
        skippedDuplicates += 1;
        plannedRows.push({
          rowNumber: row.rowNumber,
          status: "skipped",
          draft,
          errors: ["Схожий запис уже є в Memora або цьому CSV."],
          raw,
        });
        continue;
      }

      seen.add(key);
      importedCount += 1;
      plannedRows.push({
        rowNumber: row.rowNumber,
        status: "imported",
        draft,
        errors: [],
        raw,
      });
    } catch (error) {
      invalidRows += 1;
      plannedRows.push({
        rowNumber: row.rowNumber,
        status: "invalid",
        errors: [error instanceof Error ? error.message : "Некоректний рядок."],
        raw,
      });
    }
  }

  return { rows: plannedRows, importedCount, skippedDuplicates, invalidRows };
}

function planQaImportRows(
  clientRows: Array<ClientImportRow<QaDraft>>,
  state: MemoraState,
  skipDuplicates: boolean,
) {
  const rows = validateClientImportRows(clientRows);
  const seen = new Set<string>();
  const plannedRows: Array<ImportCommitRow<QaDraft>> = [];
  let importedCount = 0;
  let skippedDuplicates = 0;
  let invalidRows = 0;

  for (const row of rows) {
    const raw = normalizeRawImportRow(row.raw);
    if (!row.draft) {
      invalidRows += 1;
      plannedRows.push({
        rowNumber: row.rowNumber,
        status: "invalid",
        errors: row.errors?.length ? row.errors : ["Некоректний рядок."],
        raw,
      });
      continue;
    }

    try {
      const draft = validateQaDraft(row.draft);
      const key = normalizeLookupText(draft.term);
      const isDuplicate =
        skipDuplicates &&
        (seen.has(key) ||
          findDuplicateNotes(state.notes, {
            module: "qa",
            term: draft.term,
          }).length > 0);

      if (isDuplicate) {
        skippedDuplicates += 1;
        plannedRows.push({
          rowNumber: row.rowNumber,
          status: "skipped",
          draft,
          errors: ["Схожий запис уже є в Memora або цьому CSV."],
          raw,
        });
        continue;
      }

      seen.add(key);
      importedCount += 1;
      plannedRows.push({
        rowNumber: row.rowNumber,
        status: "imported",
        draft,
        errors: [],
        raw,
      });
    } catch (error) {
      invalidRows += 1;
      plannedRows.push({
        rowNumber: row.rowNumber,
        status: "invalid",
        errors: [error instanceof Error ? error.message : "Некоректний рядок."],
        raw,
      });
    }
  }

  return { rows: plannedRows, importedCount, skippedDuplicates, invalidRows };
}

function validateClientImportRows<TDraft>(
  rows: Array<ClientImportRow<TDraft>>,
) {
  if (!Array.isArray(rows)) throw new Error("Некоректний CSV імпорт.");
  if (rows.length === 0) throw new Error("Немає рядків для імпорту.");
  if (rows.length > 200) {
    throw new Error("За один раз можна імпортувати до 200 рядків.");
  }

  return rows.map((row, index) => ({
    rowNumber:
      Number.isInteger(row.rowNumber) && row.rowNumber > 0
        ? row.rowNumber
        : index + 2,
    draft: row.draft,
    errors: Array.isArray(row.errors) ? row.errors.map(String) : [],
    raw: row.raw,
  }));
}

function normalizeRawImportRow(raw: unknown) {
  if (!raw || typeof raw !== "object") return {};

  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).map(([key, value]) => [
      key,
      typeof value === "string" ? value : String(value ?? ""),
    ]),
  );
}

function cleanImportFileName(fileName: string | undefined, module: "english" | "qa") {
  const fallback = module === "english" ? "english-import.csv" : "qa-import.csv";
  const clean = fileName?.trim().replace(/[\\/:*?"<>|]+/g, "-") ?? "";
  return (clean || fallback).slice(0, 160);
}
