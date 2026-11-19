import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
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
  const isAppRoute = pathname === "/app" || pathname.startsWith("/app/");
  const isBetaRoute = pathname === "/beta";
  if (!isAppRoute && !isBetaRoute) return response;

  if (!user) return redirectWithCookies(request, response, "/");
  if (request.headers.has("next-action")) return response;

  const { data: allowed, error } = await supabase.rpc("is_current_user_allowed");
  // On a transient error let the request through: the page and RLS check again.
  if (error) return response;
  if (isAppRoute && !allowed) return redirectWithCookies(request, response, "/beta");
  if (isBetaRoute && allowed) return redirectWithCookies(request, response, "/app");
  return response;
}

function redirectWithCookies(request: NextRequest, response: NextResponse, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|icon.svg|apple-icon|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
