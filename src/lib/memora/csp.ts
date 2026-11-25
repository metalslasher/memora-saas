/**
 * Content-Security-Policy, built per request in src/proxy.ts.
 *
 *  - /app/* and /beta are rendered per request, so scripts get a nonce
 *    ('strict-dynamic': scripts loaded by trusted scripts are trusted too, inline
 *    injected scripts without the nonce are blocked).
 *  - Everything else (the static landing, 404) is prerendered at build time, when no
 *    nonce can exist, so scripts there are allowed with 'unsafe-inline'. Those pages
 *    show no user data and take no user-supplied HTML. Every other directive is the same.
 */
export function isStrictPath(pathname: string) {
  return pathname === "/app" || pathname.startsWith("/app/") || pathname === "/beta";
}

export function buildCsp({ nonce, isDev, supabaseUrl }: { nonce: string | null; isDev: boolean; supabaseUrl?: string }) {
  let supabaseOrigin = "";
  try {
    supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : "";
  } catch {
    supabaseOrigin = "";
  }
  const evalForDev = isDev ? " 'unsafe-eval'" : "";
  const scriptSrc = nonce
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${evalForDev}`
    : `script-src 'self' 'unsafe-inline'${evalForDev}`;
  // Style attributes (style={{…}}, used for sizes and chart colours) cannot carry a nonce.
  const styleSrc = nonce ? `style-src 'self' 'nonce-${nonce}'` : "style-src 'self' 'unsafe-inline'";
  return [
    "default-src 'self'",
    scriptSrc,
    styleSrc,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${supabaseOrigin}${isDev ? " ws:" : ""}`.trim(),
    `media-src 'self' blob: data: ${supabaseOrigin}`.trim(),
    "worker-src 'self'",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}
