"use client";

/** Browser side of web push: permission, subscription on this device. */

export const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export type PushSupport = "supported" | "unsupported";

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  return ok && vapidPublicKey ? "supported" : "unsupported";
}

function keyBytes(base64Url: string) {
  const padded = base64Url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (base64Url.length % 4)) % 4);
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

function base64Url(buffer: ArrayBuffer | null) {
  if (!buffer) return "";
  let text = "";
  for (const byte of new Uint8Array(buffer)) text += String.fromCharCode(byte);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function registration() {
  // The worker is registered by the shell (production builds only).
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

/** This device's current subscription, if the permission is still granted. */
export async function currentPushSubscription() {
  if (pushSupport() !== "supported" || Notification.permission !== "granted") return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export type SubscribeResult =
  | { ok: true; subscription: { endpoint: string; p256dh: string; auth: string } }
  | { ok: false; reason: "denied" | "failed" };

/** Asks for permission (call from a tap) and subscribes this device. */
export async function subscribeThisDevice(): Promise<SubscribeResult> {
  try {
    const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    if (permission !== "granted") return { ok: false, reason: "denied" };
    await registration();
    const reg = await navigator.serviceWorker.ready;
    const subscription =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidPublicKey) }));
    return {
      ok: true,
      subscription: {
        endpoint: subscription.endpoint,
        p256dh: base64Url(subscription.getKey("p256dh")),
        auth: base64Url(subscription.getKey("auth")),
      },
    };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/** Unsubscribes this device; returns its endpoint so the server can forget it. */
export async function unsubscribeThisDevice() {
  const subscription = await currentPushSubscription();
  if (!subscription) return null;
  const { endpoint } = subscription;
  await subscription.unsubscribe().catch(() => false);
  return endpoint;
}
