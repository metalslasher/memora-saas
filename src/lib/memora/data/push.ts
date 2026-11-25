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

/** Number of devices subscribed for the signed-in account. */
export async function countPushSubscriptions(db: Db) {
  const result = await db.from("push_subscriptions").select("id", { count: "exact", head: true });
  if (result.error) throw result.error;
  return result.count ?? 0;
}
