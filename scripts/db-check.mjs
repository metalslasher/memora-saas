// Runs scripts/db-check.sql against the linked Supabase project (read-only, rolled
// back) and fails when a function/cron job references a missing object.
// Usage: pnpm db-check   (needs the Supabase CLI, logged in and linked)
import { spawnSync } from "node:child_process";

const run = spawnSync("supabase", ["db", "query", "--linked", "-f", "scripts/db-check.sql"], {
  encoding: "utf8",
  shell: process.platform === "win32",
});
if (run.status !== 0) {
  console.error(run.stderr || run.stdout || "supabase db query failed");
  process.exit(2);
}
const start = run.stdout.indexOf("{");
const end = run.stdout.lastIndexOf("}");
let rows;
try {
  rows = JSON.parse(run.stdout.slice(start, end + 1)).rows;
} catch {
  console.error("Could not read the result of db-check.sql:\n" + run.stdout);
  process.exit(2);
}
if (!Array.isArray(rows)) {
  console.error("Unexpected result of db-check.sql:\n" + run.stdout);
  process.exit(2);
}
if (rows.length === 0) {
  console.log("DB check OK: no function or cron job references a missing object.");
} else {
  console.error("DB check FAILED:");
  for (const row of rows) console.error(`  [${row.kind}] ${row.object}: ${row.problem}`);
  process.exit(1);
}
