"use server";

import { normalizeBackupDocument, type BackupDocument } from "../backup";
import { exportBackup, exportWordsCsv, restoreBackup } from "../data/backup";
import { requireActionContext } from "../data/context";
import { resetProgress } from "../data/practice";
import { updateDailyMinutes, updateSpeakingEnabled, updateTimezone } from "../data/profile";
import { deleteAllWords } from "../data/words";
import { isValidTimezone, validateDailyMinutes } from "../validation";
import { fail, ok, type ActionResult } from "./result";

/** Minutes per day: the pace new words are derived from. */
export async function updateDailyMinutesAction(minutes: number): Promise<ActionResult<number>> {
  try {
    const clean = validateDailyMinutes(minutes);
    const { supabase, user } = await requireActionContext();
    return ok(await updateDailyMinutes(supabase, user.id, clean));
  } catch (error) {
    return fail(error);
  }
}

/** "Говоріння": serve the speak-aloud exercise or not. */
export async function updateSpeakingAction(enabled: boolean): Promise<ActionResult<boolean>> {
  try {
    if (typeof enabled !== "boolean") throw new Error("Невідоме значення налаштування.");
    const { supabase, user } = await requireActionContext();
    return ok(await updateSpeakingEnabled(supabase, user.id, enabled));
  } catch (error) {
    return fail(error);
  }
}

/** Keeps "today" (streak, daily limits) in the learner's own timezone. */
export async function updateTimezoneAction(timezone: string): Promise<ActionResult> {
  try {
    if (!isValidTimezone(timezone)) throw new Error("Невідомий часовий пояс.");
    const { supabase, user } = await requireActionContext();
    await updateTimezone(supabase, user.id, timezone);
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export async function exportBackupAction(): Promise<ActionResult<BackupDocument>> {
  try {
    const { supabase } = await requireActionContext();
    return ok(await exportBackup(supabase));
  } catch (error) {
    return fail(error);
  }
}

export async function exportWordsCsvAction(): Promise<ActionResult<string>> {
  try {
    const { supabase } = await requireActionContext();
    return ok(await exportWordsCsv(supabase));
  } catch (error) {
    return fail(error);
  }
}

export async function restoreBackupAction(backup: unknown): Promise<ActionResult<number>> {
  try {
    const document = normalizeBackupDocument(backup);
    const { supabase } = await requireActionContext();
    return ok(await restoreBackup(supabase, document));
  } catch (error) {
    return fail(error);
  }
}

export async function resetProgressAction(): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireActionContext();
    await resetProgress(supabase, user.id);
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export async function deleteAllWordsAction(): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireActionContext();
    await deleteAllWords(supabase, user.id);
    return ok();
  } catch (error) {
    return fail(error);
  }
}
