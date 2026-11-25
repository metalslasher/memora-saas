// Real web-push check against a running Memora (pnpm start, production build: the
// service worker is registered only there), in Chrome with a real push service.
// Subscribes the e2e test user's browser in Settings, widens the reminder window to
// the current local hour, calls /api/cron/reminders with CRON_SECRET and expects the
// notification to appear; then turns reminders off again.
// Usage: pnpm test-user && node --env-file=.env.local scripts/push-check.mjs
// Env: MEMORA_SMOKE_URL (default http://localhost:3000). A Chrome window opens for a few seconds.
import { createClient } from "@supabase/supabase-js";
import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const baseUrl = (process.env.MEMORA_SMOKE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const { MEMORA_SMOKE_EMAIL: email, MEMORA_SMOKE_PASSWORD: password, CRON_SECRET: secret } = process.env;
if (!email || !password || !secret) throw new Error("MEMORA_SMOKE_EMAIL/PASSWORD and CRON_SECRET must be set (pnpm test-user).");

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// A persistent profile: Chrome refuses push registration in the throwaway (incognito-like) contexts Playwright makes by default.
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "memora-push-"));
const context = await chromium.launchPersistentContext(profileDir, {
  channel: "chrome",
  headless: process.env.MEMORA_SMOKE_HEADLESS === "1",
  viewport: { width: 1440, height: 900 },
});
await context.grantPermissions(["notifications"], { origin: baseUrl });
const page = await context.newPage();

try {
  await page.goto(`${baseUrl}/`);
  await page.getByRole("button", { name: /Увійти/ }).first().click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("dialog").locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(`${baseUrl}/app`, { timeout: 30000 });

  await page.goto(`${baseUrl}/app/settings`);
  const toggle = page.getByTestId("reminders-switch");
  await expect(toggle).toBeVisible({ timeout: 10000 });
  await toggle.click();
  await expect(page.getByText("Нагадування ввімкнено.")).toBeVisible({ timeout: 20000 });
  console.log("Subscribed this browser.");
  const shotsDir = process.env.MEMORA_SMOKE_SHOTS;
  if (shotsDir) {
    fs.mkdirSync(shotsDir, { recursive: true });
    for (const [name, size] of [["1440", { width: 1440, height: 900 }], ["375", { width: 375, height: 812 }]]) {
      await page.setViewportSize(size);
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(shotsDir, `settings-reminders-${name}.png`), fullPage: true });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
  }

  // Cover the current local hour of the test user and forget any push sent today.
  const { data: profile, error } = await admin
    .from("profiles")
    .select("id,timezone")
    .eq("id", (await admin.auth.admin.listUsers({ perPage: 200 })).data.users.find((user) => user.email === email).id)
    .single();
  if (error) throw error;
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: profile.timezone, hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  await admin
    .from("profiles")
    .update({ reminders_enabled: true, reminder_start: hour, reminder_end: hour + 1, last_reminder_day: null })
    .eq("id", profile.id);

  const call = () => page.request.post(`${baseUrl}/api/cron/reminders`, { headers: { Authorization: `Bearer ${secret}` } });
  const first = await (await call()).json();
  console.log("First call:", JSON.stringify(first));
  expect(first.sent).toBeGreaterThanOrEqual(1);

  const shown = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const list = await registration.getNotifications();
      if (list.length > 0) return list.map((item) => ({ title: item.title, body: item.body, url: item.data?.url }));
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return [];
  });
  console.log("Notification:", JSON.stringify(shown));
  expect(shown).toHaveLength(1);
  expect(shown[0].url).toBe("/app");

  // Idempotent: the same hour (and day) sends nothing a second time.
  const second = await (await call()).json();
  console.log("Second call:", JSON.stringify(second));
  expect(second.sent).toBe(0);

  await page.goto(`${baseUrl}/app/settings`);
  await page.getByTestId("reminders-switch").click();
  await expect(page.getByText("Нагадування вимкнено.")).toBeVisible();
  console.log("Push check OK.");
} finally {
  await admin.from("profiles").update({ reminders_enabled: false, last_reminder_day: null }).eq("id", (await admin.auth.admin.listUsers({ perPage: 200 })).data.users.find((user) => user.email === email).id);
  await Promise.race([context.close(), new Promise((resolve) => setTimeout(resolve, 10_000))]);
  fs.rmSync(profileDir, { recursive: true, force: true });
}
