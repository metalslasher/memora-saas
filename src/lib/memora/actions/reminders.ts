"use server";

import { requireActionContext } from "../data/context";
import { updateReminders } from "../data/profile";
import { deletePushSubscription, savePushSubscription } from "../data/push";
import { isValidReminderWindow } from "../reminders";
import { fail, ok, type ActionResult } from "./result";

/** Reminder switch and window (local hours). The device itself is saved separately. */
export async function saveRemindersAction(input: {
  enabled: boolean;
  start: number;
  end: number;
}): Promise<ActionResult<{ enabled: boolean; start: number; end: number }>> {
  try {
    if (typeof input.enabled !== "boolean") throw new Error("Невідоме значення налаштування.");
    if (!isValidReminderWindow(input.start, input.end)) throw new Error("Початок вікна має бути раніше за кінець.");
    const { supabase, user } = await requireActionContext();
    return ok(await updateReminders(supabase, user.id, input));
  } catch (error) {
    return fail(error);
  }
}

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Saves this device's push subscription (several devices per account are fine). */
export async function savePushSubscriptionAction(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string;
}): Promise<ActionResult> {
  try {
    const endpoint = cleanText(input.endpoint, 2048);
    const p256dh = cleanText(input.p256dh, 512);
    const auth = cleanText(input.auth, 512);
    if (!/^https:\/\//.test(endpoint) || !p256dh || !auth) {
      throw new Error("Не вдалося підписати цей пристрій. Спробуй ще раз.");
    }
    const { supabase } = await requireActionContext();
    await savePushSubscription(supabase, { endpoint, p256dh, auth, userAgent: cleanText(input.userAgent, 300) });
    return ok();
  } catch (error) {
    return fail(error);
  }
}

export async function removePushSubscriptionAction(endpoint: string): Promise<ActionResult> {
  try {
    const clean = cleanText(endpoint, 2048);
    if (!clean) return ok();
    const { supabase } = await requireActionContext();
    await deletePushSubscription(supabase, clean);
    return ok();
  } catch (error) {
    return fail(error);
  }
}
