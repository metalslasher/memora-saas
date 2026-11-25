import type { Instrumentation } from "next";

/** Uncaught server errors (render, route handlers, server actions) → error_reports. */
export const onRequestError: Instrumentation.onRequestError = async (error, request) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const err = error as Error & { digest?: string };
  const { recordError } = await import("@/lib/memora/error-report");
  await recordError({
    source: "server",
    route: request.path,
    message: err?.message ?? String(error),
    stack: err?.stack,
    digest: err?.digest,
  });
};
