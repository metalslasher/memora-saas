// Lighthouse (mobile) for the landing (as a guest) and the signed-in screens against a running Memora.
// Usage: pnpm start (in another terminal) → pnpm test-user → pnpm lighthouse
// Needs Chrome and network for `npx lighthouse` (not a project dependency). Prints scores.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const baseUrl = (process.env.MEMORA_SMOKE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const email = process.env.MEMORA_SMOKE_EMAIL;
const password = process.env.MEMORA_SMOKE_PASSWORD;
const appPages = ["/app", "/app/words", "/app/progress", "/app/settings"];
const port = 9333;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "memora-lh-"));

function audit(route, headersFile) {
  const out = path.join(os.tmpdir(), `lh-${route.replace(/\W+/g, "_")}.json`);
  const args = ["--yes", "lighthouse@12", baseUrl + route, `--port=${port}`, "--output=json", `--output-path=${out}`,
    "--only-categories=performance,accessibility,best-practices", "--disable-storage-reset", "--quiet"];
  if (headersFile) args.push(`--extra-headers=${headersFile}`);
  try {
    execFileSync("npx", args, { stdio: "ignore", shell: true, timeout: 240000 });
  } catch {
    console.log(`${route}: lighthouse failed`);
    return;
  }
  const lhr = JSON.parse(fs.readFileSync(out, "utf8"));
  const score = (id) => Math.round((lhr.categories[id]?.score ?? 0) * 100);
  const value = (id) => lhr.audits[id]?.displayValue ?? "";
  console.log(
    `${route.padEnd(14)} → ${new URL(lhr.finalDisplayedUrl).pathname.padEnd(10)} perf ${score("performance")} a11y ${score("accessibility")} bp ${score("best-practices")} | LCP ${value("largest-contentful-paint")} TBT ${value("total-blocking-time")} CLS ${value("cumulative-layout-shift")}`,
  );
  const a11yIds = new Set(lhr.categories.accessibility.auditRefs.map((r) => r.id));
  for (const a of Object.values(lhr.audits)) {
    if (a.score === 0 && a11yIds.has(a.id)) console.log(`   a11y: ${a.id} — ${a.title}`);
  }
}

const context = await chromium.launchPersistentContext(profile, {
  channel: process.env.MEMORA_SMOKE_BROWSER_CHANNEL ?? "chrome",
  headless: true,
  args: [`--remote-debugging-port=${port}`],
});
try {
  audit("/");
  if (email && password) {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(baseUrl);
    await page.getByRole("button", { name: "Увійти", exact: true }).first().click();
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Пароль", { exact: true }).fill(password);
    await page.getByRole("dialog").locator('form button[type="submit"]').click();
    await page.waitForURL(`${baseUrl}/app`, { timeout: 30000 });
    // Lighthouse opens its own tab: hand it the session as a Cookie header.
    const cookies = await context.cookies(baseUrl);
    const headersFile = path.join(profile, "headers.json");
    fs.writeFileSync(headersFile, JSON.stringify({ Cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; ") }));
    for (const route of appPages) audit(route, headersFile);
  }
} finally {
  await context.close();
  fs.rmSync(profile, { recursive: true, force: true });
}
