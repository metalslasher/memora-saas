import { check, type Db } from "./db";

export type PushSubscriptionInput = { endpoint: string; p256dh: string; auth: string; userAgent: string };

/** Saves this device for the signed-in account (moves it if another account used it). */
export async function savePushSubscription(db: Db, input: PushSubscriptionInput) {
  check(
    await db.rpc("save_push_subscription", {
      p_endpoint: input.endpoint,
      p_p256dh: input.p256dh,
      p_auth: input.auth,
      p_user_agent: input.userAgent,
    }),
  );
}

export async function deletePushSubscription(db: Db, endpoint: string) {
  check(await db.from("push_subscriptions").delete().eq("endpoint", endpoint));
}

