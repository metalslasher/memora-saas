import { describe, expect, it } from "vitest";
import { cleanRoute, fingerprintOf, scrub } from "./error-report";

describe("error reports", () => {
  it("removes emails, tokens, ids and query strings", () => {
    const text = "Failed for oleg@example.com at /app?token=abc with eyJhbGciOi.eyJzdWIiOi.c2lnbmF0dXJl and 123e4567-e89b-12d3-a456-426614174000";
    const clean = scrub(text);
    expect(clean).not.toContain("oleg@example.com");
    expect(clean).not.toContain("token=abc");
    expect(clean).not.toContain("eyJhbGciOi");
    expect(clean).not.toContain("123e4567");
  });

  it("keeps only the path of a route and hides ids", () => {
    expect(cleanRoute("/app/words/123e4567-e89b-12d3-a456-426614174000?x=1#y")).toBe("/app/words/[id]");
  });

  it("gives the same fingerprint to the same error on different lines", () => {
    const a = fingerprintOf({ source: "client", route: "/app", message: "boom", stack: "Error: boom\n at f (a.js:10:5)" });
    const b = fingerprintOf({ source: "client", route: "/app", message: "boom", stack: "Error: boom\n at f (a.js:99:1)" });
    const c = fingerprintOf({ source: "server", route: "/app", message: "boom", stack: "Error: boom\n at f (a.js:10:5)" });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
