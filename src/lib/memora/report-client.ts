"use client";

let sentInThisPage = 0;

/** Sends one error to /api/report-error (max 5 per page load). Never throws. */
export function reportClientError(error: unknown, digest?: string) {
  try {
    if (sentInThisPage >= 5) return;
    sentInThisPage += 1;
    const err = error instanceof Error ? error : new Error(String(error));
    void fetch("/api/report-error", {
      method: "POST",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        route: window.location.pathname,
        message: err.message.slice(0, 500),
        stack: (err.stack ?? "").slice(0, 3000),
        digest: digest ?? (err as Error & { digest?: string }).digest ?? "",
      }),
    }).catch(() => {});
  } catch {
    // ignore
  }
}
