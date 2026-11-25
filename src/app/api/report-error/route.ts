import { NextResponse, type NextRequest } from "next/server";
import { recordError } from "@/lib/memora/error-report";

const MAX_BODY_BYTES = 8_000;

/**
 * Receives error reports from the browser (error boundaries, window.onerror).
 * Same-origin only, tiny bodies, no cookies or user data are read; the DB
 * deduplicates and caps the number of new errors per hour.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).host !== request.nextUrl.host) {
    return new NextResponse(null, { status: 403 });
  }
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return new NextResponse(null, { status: 413 });

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const { route, message, stack, digest } = (body ?? {}) as Record<string, unknown>;
  if (typeof message !== "string" || !message) return new NextResponse(null, { status: 400 });

  await recordError({
    source: "client",
    route: typeof route === "string" ? route : "",
    message,
    stack: typeof stack === "string" ? stack : "",
    digest: typeof digest === "string" ? digest : "",
  });
  return new NextResponse(null, { status: 204 });
}
