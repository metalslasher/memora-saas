// Prints recent errors stored by the app (table error_reports) — no dashboard needed.
// Usage: pnpm errors [days=7]   (needs SUPABASE_SERVICE_ROLE_KEY in .env.local)
import { createClient } from "@supabase/supabase-js";

const days = Number(process.argv[2] ?? 7);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (.env.local).");
  process.exit(2);
}
const admin = createClient(url, key, { auth: { persistSession: false } });
const since = new Date(Date.now() - days * 86_400_000).toISOString();
const { data, error } = await admin
  .from("error_reports")
  .select("source, route, message, occurrences, first_seen, last_seen, release, digest")
  .gte("last_seen", since)
  .order("last_seen", { ascending: false })
  .limit(50);
if (error) {
  console.error(error.message);
  process.exit(2);
}
if (!data.length) console.log(`No errors in the last ${days} days.`);
for (const row of data) {
  console.log(`${row.last_seen.slice(0, 16)}  ×${row.occurrences}  [${row.source}] ${row.route}  ${row.release}\n    ${row.message.split("\n")[0]}`);
}
