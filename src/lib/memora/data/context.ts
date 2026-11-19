import { redirect } from "next/navigation";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isRlsViolation } from "./db";
import { getPracticeSummary } from "./practice";
import { ensureProfile } from "./profile";

/**
 * Per-request context for /app server components: the signed-in user and
 * their profile (created, with starter words, on the first visit). Cached so
 * the layout and the page share one lookup and seeding finishes before any
 * page query runs. The proxy already redirects guests and non-invited users;
 * this is the second line of defence (RLS is the third).
 */
export const getAppContext = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  try {
    const profile = await ensureProfile(supabase, user.id);
    return { supabase, user, profile };
  } catch (error) {
    // RLS refuses the profile insert for accounts outside the allowlist.
    if (isRlsViolation(error)) redirect("/beta");
    throw error;
  }
});

/** Authenticated, allowlisted context for server actions. */
export async function requireActionContext() {
  const supabase = await createSupabaseServerClient();
  const [userResult, allowedResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc("is_current_user_allowed"),
  ]);

  const user = userResult.data.user;
  if (userResult.error || !user) throw new Error("Потрібно увійти в Memora.");
  if (allowedResult.error) throw allowedResult.error;
  if (!allowedResult.data) {
    throw new Error("Memora зараз у закритій беті — цей акаунт ще не має доступу.");
  }

  return { supabase, user };
}

/** Practice counters, shared by the /app layout (badge) and the practice page. */
export const loadPracticeSummary = cache(async () => {
  const { supabase, profile } = await getAppContext();
  return getPracticeSummary(supabase, profile.timezone);
});
