import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/memora/share";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Refreshes the Supabase session cookie on every request and guards routes:
 * guests on /app/* go to the landing page, signed-in accounts outside the
 * closed-beta allowlist go to /beta. Server actions skip the allowlist
 * round trip here because every action checks it itself.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) return response;

  const supabase = createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Touching the user triggers a token refresh when needed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  // The landing is static; a signed-in visitor sent back with ?next= goes straight there.
  if (pathname === "/" && user) {
    const next = safeNextPath(request.nextUrl.searchParams.get("next"));
    if (next) return withCookies(response, NextResponse.redirect(new URL(next, request.nextUrl.origin), 303));
  }
  const isAppRoute = pathname === "/app" || pathname.startsWith("/app/");
  const isBetaRoute = pathname === "/beta";
  if (!isAppRoute && !isBetaRoute) return response;

  if (!user) {
    // Remember where the guest was going (e.g. a share from Android) to return after sign-in.
    const next = request.method === "GET" && isAppRoute ? pathname + request.nextUrl.search : null;
    return redirectWithCookies(request, response, "/", next);
  }
  if (request.headers.has("next-action")) return response;

  const { data: allowed, error } = await supabase.rpc("is_current_user_allowed");
  // On a transient error let the request through: the page and RLS check again.
  if (error) return response;
  if (isAppRoute && !allowed) return redirectWithCookies(request, response, "/beta");
  if (isBetaRoute && allowed) return redirectWithCookies(request, response, "/app");
  return response;
}

function redirectWithCookies(request: NextRequest, response: NextResponse, pathname: string, next?: string | null) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  if (next) url.searchParams.set("next", next);
  // 303: a shared POST to /app/share continues as a GET.
  return withCookies(response, NextResponse.redirect(url, 303));
}

function withCookies(response: NextResponse, redirect: NextResponse) {
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|icon.svg|apple-icon|manifest.webmanifest|sw.js|pwa/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp3)$).*)",
  ],
};
