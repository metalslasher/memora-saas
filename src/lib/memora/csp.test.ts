import { describe, expect, it } from "vitest";
import { buildCsp, isStrictPath } from "./csp";

describe("csp", () => {
  it("uses a nonce and strict-dynamic for rendered pages", () => {
    const csp = buildCsp({ nonce: "abc", isDev: false, supabaseUrl: "https://x.supabase.co/rest" });
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("connect-src 'self' https://x.supabase.co");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("allows inline scripts only on the static pages", () => {
    const csp = buildCsp({ nonce: null, isDev: false });
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("nonce-");
  });

  it("enables eval only in development", () => {
    expect(buildCsp({ nonce: "a", isDev: true })).toContain("'unsafe-eval'");
  });

  it("applies the nonce policy to the signed-in area only", () => {
    expect(isStrictPath("/app")).toBe(true);
    expect(isStrictPath("/app/words/1")).toBe(true);
    expect(isStrictPath("/beta")).toBe(true);
    expect(isStrictPath("/")).toBe(false);
    expect(isStrictPath("/application")).toBe(false);
  });
});
