import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ErrorReport = {
  source: "client" | "server";
  route: string;
  message: string;
  stack?: string;
  digest?: string;
};

const MAX_MESSAGE = 500;
const MAX_STACK = 3000;

/** Drops personal data and secrets that can sneak into messages and stacks. */
export function scrub(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "<email>")
    .replace(/\b(?:eyJ[\w-]+\.[\w-]+\.[\w-]+|sk-[\w-]{10,}|[A-Za-z0-9_-]{32,})\b/g, "<token>")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "<id>")
    .replace(/([?&#][^\s)"']*)/g, "");
}

/** Keeps only the path of a URL or route: no query, no hash. */
export function cleanRoute(route: string): string {
  const path = route.split(/[?#]/)[0] ?? "";
  return path.replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/[id]").slice(0, 200);
}

/** First stack frames are enough to tell errors apart; line numbers change between builds. */
export function fingerprintOf(report: ErrorReport): string {
  const frames = (report.stack ?? "").split("\n").slice(0, 3).join("|").replace(/:\d+:\d+/g, "");
  return createHash("sha256")
    .update([report.source, cleanRoute(report.route), report.message, frames].join("\n"))
    .digest("hex")
    .slice(0, 32);
}

/** Server only: stores one error (deduplicated, rate-limited in the DB). Never throws. */
export async function recordError(input: ErrorReport): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    if (!admin) return;
    const report: ErrorReport = {
      source: input.source,
      route: cleanRoute(input.route),
      message: scrub(input.message).slice(0, MAX_MESSAGE),
      stack: scrub(input.stack ?? "").slice(0, MAX_STACK),
      digest: (input.digest ?? "").slice(0, 64),
    };
    await admin.rpc("record_error", {
      p_fingerprint: fingerprintOf(report),
      p_source: report.source,
      p_route: report.route,
      p_message: report.message,
      p_stack: report.stack ?? "",
      p_digest: report.digest ?? "",
      p_release: (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7),
    });
  } catch {
    // Monitoring must never break the app.
  }
}
