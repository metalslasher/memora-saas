import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Service-role client for server-only writes that users must not make
 * themselves: the AI ledger, the shared lexicon cache and TTS uploads.
 * Never import from client components. Null when the key is not configured.
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type AdminDb = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
