import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import * as webpush from "web-push";
import { pickReminderRecipients, reminderText, type ReminderCandidate } from "@/lib/memora/reminders";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Hourly tick from Supabase pg_cron (Vercel Hobby allows a cron only once a day,
 * too coarse for reminder windows). Protected by CRON_SECRET. Idempotent: a user
 * is claimed for the local day by an atomic update before anything is sent, so a
 * repeated call in the same hour (or day) sends nothing.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization") ?? "";
  if (!secret || !sameSecret(given, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!admin || !publicKey || !privateKey) {
    return NextResponse.json({ error: "push is not configured" }, { status: 503 });
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://memora-saas.vercel.app", publicKey, privateKey);

  const now = new Date();
  const { data, error } = await admin.rpc("get_reminder_candidates", { p_now: now.toISOString() });
  if (error) return NextResponse.json({ error: "candidates failed" }, { status: 500 });

  const candidates: ReminderCandidate[] = data.map((row) => ({
    userId: row.user_id,
    timezone: row.timezone,
    start: row.reminder_start,
    end: row.reminder_end,
    lastReminderDay: row.last_reminder_day,
    dailyMinutes: row.daily_minutes,
    metDays: row.met_days ?? [],
    dueWords: row.due_words,
    newReady: row.new_ready,
  }));
  const recipients = pickReminderRecipients(candidates, now);
  const previousDay = new Map(candidates.map((candidate) => [candidate.userId, candidate.lastReminderDay]));

  let sent = 0;
  let removed = 0;
  for (const recipient of recipients) {
    // Claim the day first (at most one push per day, even with parallel calls).
    const claim = await admin
      .from("profiles")
      .update({ last_reminder_day: recipient.day })
      .eq("id", recipient.userId)
      .or(`last_reminder_day.is.null,last_reminder_day.lt.${recipient.day}`)
      .select("id");
    if (claim.error || !claim.data?.length) continue;

    const subscriptions = await admin
      .from("push_subscriptions")
      .select("id,endpoint,p256dh,auth")
      .eq("user_id", recipient.userId);
    const payload = JSON.stringify({ ...reminderText(recipient.count), url: "/app" });

    let delivered = 0;
    await Promise.all(
      (subscriptions.data ?? []).map(async (subscription) => {
        try {
          await webpush.sendNotification(
            { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
            payload,
            { TTL: 6 * 60 * 60, urgency: "normal" },
          );
          delivered += 1;
        } catch (failure) {
          const status = (failure as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            // The device unsubscribed or the browser dropped the subscription.
            await admin.from("push_subscriptions").delete().eq("id", subscription.id);
            removed += 1;
          }
        }
      }),
    );
    sent += delivered;

    // Nothing reached any device (service hiccup): give the day back for the next tick.
    if (delivered === 0 && (subscriptions.data?.length ?? 0) > 0) {
      await admin
        .from("profiles")
        .update({ last_reminder_day: previousDay.get(recipient.userId) ?? null })
        .eq("id", recipient.userId);
    }
  }

  return NextResponse.json({ checked: candidates.length, due: recipients.length, sent, removed });
}

function sameSecret(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
