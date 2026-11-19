"use server";

import { normalizeBackupDocument, type BackupDocument } from "../backup";
import { exportBackup, exportWordsCsv, restoreBackup } from "../data/backup";
import { requireActionContext } from "../data/context";
import { resetProgress } from "../data/practice";
import { updateLearningSettings, updateTimezone } from "../data/profile";
import { deleteAllWords } from "../data/words";
import type { LearningSettings } from "../types";
import { isValidTimezone, validateLearningSettings } from "../validation";
import { fail, ok, type ActionResult } from "./result";

export async function updateLearningSettingsAction(
  settings: LearningSettings,
): Promise<ActionResult<LearningSettings>> {
  try {
    const clean = validateLearningSettings(settings);
    const { supabase, user } = await requireActionContext();
    return ok(await updateLearningSettings(supabase, user.id, clean));
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
