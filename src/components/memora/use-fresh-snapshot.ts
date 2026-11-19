"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const consumed = new Set<string>();

/**
 * Next.js reuses a page's cached server payload on browser back/forward, so
 * a client component would start again from stale data (e.g. cards already
 * graded in this session). Each server render passes a fresh `snapshot` id;
 * seeing the same id twice means the payload came from that cache, and we
 * ask the server for fresh data. Parents key the component by the snapshot,
 * so the refreshed render remounts it with the new data.
 */
export function useFreshSnapshot(snapshot: string) {
  const router = useRouter();
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    if (consumed.has(snapshot)) router.refresh();
    else consumed.add(snapshot);
  }, [router, snapshot]);
}
