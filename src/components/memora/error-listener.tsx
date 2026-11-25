"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/memora/report-client";

const noise = /resizeobserver|script error|failed to fetch|networkerror|load failed|network request failed|aborterror/i;

/** Reports uncaught browser errors that no error boundary sees (event handlers, promises). */
export function ErrorListener() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (!event.error || noise.test(event.message)) return;
      reportClientError(event.error);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason ?? "");
      if (noise.test(message)) return;
      reportClientError(reason);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
