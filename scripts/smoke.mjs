// Playwright smoke test against a running Memora (pnpm dev or pnpm start).
// Env: MEMORA_SMOKE_URL, MEMORA_SMOKE_EMAIL/PASSWORD, MEMORA_SMOKE_MUTATE=0
// (read-only), MEMORA_SMOKE_BROWSER_PATH, MEMORA_SMOKE_HEADLESS=0,
// MEMORA_SMOKE_SHOTS=<dir> (save 375/768/1440 screenshots of every screen),
// MEMORA_SMOKE_AI=0 (the server has no AI: own-sentence/speak-aloud are not expected).
// The microphone is Chromium's fake device; on Windows it plays a sentence
// spoken by the system voice (SAPI), elsewhere a beep ("nothing heard" is accepted).
import { chromium, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const baseUrl = (process.env.MEMORA_SMOKE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const email = process.env.MEMORA_SMOKE_EMAIL;
const password = process.env.MEMORA_SMOKE_PASSWORD;
const shouldMutate = process.env.MEMORA_SMOKE_MUTATE !== "0";
const shotsDir = process.env.MEMORA_SMOKE_SHOTS;
const desktop = { width: 1440, height: 900 };
const mobile = { width: 375, height: 812 };
const tablet = { width: 768, height: 1024 };
const consoleProblems = [];
const expectAi = process.env.MEMORA_SMOKE_AI !== "0";
const spokenSentence = "I eventually found my keys under the couch.";

async function main() {
  await assertServerReady();
  if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });

  const browser = await launchBrowser();
  const context = await browser.newContext({ acceptDownloads: true, viewport: desktop });
  await context.grantPermissions(["microphone"], { origin: baseUrl });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") consoleProblems.push(message.text());
  });
  page.on("pageerror", (error) => consoleProblems.push(error.message));

  try {
    await assertGuestRedirect(page);
    await assertLanding(page);
    await assertPwa(page);
    await assertCronAuth(page);

    if (!email || !password) {
      console.log("Smoke OK: landing only (MEMORA_SMOKE_EMAIL/PASSWORD are not set).");
      return;
    }

    await signIn(page);
    if (shouldMutate) await assertOnboarding(page);
    await assertPractice(page);
    await assertWords(page);
    await assertProgress(page);
    await assertSettings(page);
    await assertHelp(page);
    await assertMobile(page);
    await assertShareTarget(page);
    await assertInstallable(page, context);
    await assertShareAfterSignIn(browser);
    await assertNoConsoleErrors();
    console.log(`Smoke OK: authenticated flow${shouldMutate ? " with mutations" : " (read-only)"}.`);
  } finally {
    // Closing system Chrome sometimes never resolves on Windows: give it 10 s.
    await Promise.race([
      context.close().then(() => browser.close()),
      new Promise((resolve) => setTimeout(resolve, 10_000)),
    ]);
  }
}

async function launchBrowser() {
  const headless = process.env.MEMORA_SMOKE_HEADLESS !== "0";
  const executablePath = process.env.MEMORA_SMOKE_BROWSER_PATH;
  const speech = fakeSpeechFile();
  const args = [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    ...(speech ? [`--use-file-for-fake-audio-capture=${speech}`] : []),
  ];
  if (executablePath) return chromium.launch({ executablePath, headless, args });
  try {
    return await chromium.launch({ channel: process.env.MEMORA_SMOKE_BROWSER_CHANNEL ?? "chrome", headless, args });
  } catch {
    return chromium.launch({ headless, args });
  }
}

/** A WAV of a spoken sentence for the fake microphone (Windows system voice), or null. */
function fakeSpeechFile() {
  if (process.platform !== "win32") return null;
  const file = path.join(os.tmpdir(), "memora-smoke-speech.wav");
  if (fs.existsSync(file)) return file;
  try {
    const script = [
      "Add-Type -AssemblyName System.Speech",
      "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer",
      "$s.Rate = -1",
      `$s.SetOutputToWaveFile('${file}')`,
      `$s.Speak('${spokenSentence}')`,
      "$s.Dispose()",
    ].join("; ");
    execFileSync("powershell", ["-NoProfile", "-Command", script], { stdio: "ignore", timeout: 30000 });
    return fs.existsSync(file) ? file : null;
  } catch {
    return null;
  }
}

async function assertServerReady() {
  try {
    const response = await fetch(baseUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    throw new Error(
      `Memora is not reachable at ${baseUrl}. Start it with "pnpm dev" or set MEMORA_SMOKE_URL. ${error instanceof Error ? error.message : ""}`,
    );
  }
}

/** A visible link of the main navigation (sidebar on desktop, tab bar on phones). */
function navLink(page, label) {
  return page
    .getByRole("navigation", { name: "Розділи" })
    .getByRole("link", { name: new RegExp(`^${label}`) })
    .filter({ visible: true })
    .first();
}

async function heading(page, name) {
  await expect(page.getByRole("heading", { level: 1, name, exact: true })).toBeVisible({ timeout: 20000 });
}

async function shot(page, name) {
  if (!shotsDir) return;
  const size = page.viewportSize();
  await page.waitForTimeout(400);
  // Phone answer screens: what is on screen after the reveal scroll (the tab bar is fixed).
  const fullPage = !(name.endsWith("-answer") && size?.width === mobile.width);
  await page.screenshot({ path: path.join(shotsDir, `${name}-${size?.width ?? 0}.png`), fullPage });
  // Desktop screens also get a tablet shot (the phone layout at 768).
  if (size?.width === desktop.width) {
    await page.setViewportSize(tablet);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(shotsDir, `${name}-${tablet.width}.png`), fullPage: true });
    await page.setViewportSize(desktop);
  }
}

async function assertGuestRedirect(page) {
  // A guest is sent to sign in, and the app page waits in ?next= for after it.
  await page.goto(`${baseUrl}/app/words`, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(`${baseUrl}/?next=%2Fapp%2Fwords`);
  await expect(page.getByRole("dialog", { name: "З поверненням" })).toBeVisible();
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
}

/** Web app manifest, icons, service worker and the share target endpoint (no account needed). */
async function assertPwa(page) {
  const manifestResponse = await page.request.get(`${baseUrl}/manifest.webmanifest`);
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest.start_url).toBe("/app");
  expect(manifest.display).toBe("standalone");
  expect(manifest.share_target?.action).toBe("/app/share");
  expect(manifest.share_target?.params?.text).toBe("text");
  const pngs = manifest.icons.filter((icon) => icon.type === "image/png");
  for (const needed of ["192x192", "512x512"]) {
    if (!pngs.some((icon) => icon.sizes === needed && icon.purpose === "any")) throw new Error(`No ${needed} icon.`);
    if (!pngs.some((icon) => icon.sizes === needed && icon.purpose === "maskable")) throw new Error(`No maskable ${needed} icon.`);
  }
  for (const icon of pngs) {
    const response = await page.request.get(`${baseUrl}${icon.src}`);
    expect(response.ok(), icon.src).toBe(true);
    expect(response.headers()["content-type"]).toContain("image/png");
  }
  const worker = await page.request.get(`${baseUrl}/sw.js`);
  expect(worker.ok()).toBe(true);
  expect(await worker.text()).toContain("activate");

  // A guest share (GET) goes to sign-in and keeps the share for after it.
  const guestShare = await page.request.get(`${baseUrl}/app/share?text=reliable`, { maxRedirects: 0 });
  expect(guestShare.status()).toBe(303);
  expect(guestShare.headers().location).toContain("next=%2Fapp%2Fshare%3Ftext%3Dreliable");
}

async function assertLanding(page) {
  await expect(page.getByRole("heading", { level: 1 })).toContainText("згадаєш");
  await expect(page.getByText(/QA/)).toHaveCount(0);
  // Link preview: Open Graph image is served as a PNG.
  const ogImage = await page.locator('meta[property="og:image"]').getAttribute("content");
  expect(ogImage).toContain("/opengraph-image");
  const og = await page.request.get(`${baseUrl}${new URL(ogImage).pathname}`);
  expect(og.ok()).toBe(true);
  expect(og.headers()["content-type"]).toContain("image/png");

  // The demo card uses the real answer check and auto-grade, no account needed.
  await page.locator("#demo-answer").fill("figurd out");
  await page.locator("#demo-answer").press("Enter");
  await expect(page.getByText("Є описка")).toBeVisible();
  await expect(page.getByText("Оцінка: Важко")).toBeVisible();
  await shot(page, "landing");

  // Main action: request access = create an account (closed beta), sign-in for the invited.
  await page.getByRole("button", { name: "Хочу доступ" }).first().click();
  await expect(page.getByRole("dialog", { name: "Створи акаунт" })).toContainText("закритій беті");
  await page.getByRole("button", { name: "Вхід", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "З поверненням" })).toBeVisible();
}

async function signIn(page) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("dialog").locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(`${baseUrl}/app`, { timeout: 30000 });
  await expect(navLink(page, "Практика")).toBeVisible({ timeout: 20000 });
}

async function assertPractice(page) {
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const answerBox = page.locator("#practice-answer");
  if (!(await answerBox.isVisible().catch(() => false))) {
    console.log("Practice card check skipped: the queue is empty.");
    await shot(page, "practice");
    return;
  }

  await expect(page.getByRole("tablist", { name: /Довжина сесії/ })).toBeVisible();
  const count = page.getByTestId("session-count");
  // Daily goal: a fresh day shows progress, not a finished goal.
  await expect(page.getByTestId("goal-text")).toContainText(/Ціль дня: 0 з \d+ хв/);

  // First card: check, rate, undo — the same card comes back.
  const firstKind = await exerciseKind(page);
  const firstCue = await cueText(page);
  await answerBox.fill("smoke");
  await answerBox.press("Enter");
  await expect(page.getByText("Відповідь", { exact: true })).toBeVisible();
  await expect(ratingButton(page, firstKind)).toBeVisible();
  if (!shouldMutate) return;
  await ratingButton(page, firstKind).click();
  if (await visibleSoon(answerBox)) {
    await expect(count).toHaveText(/^1 ·/);
    await page.getByRole("button", { name: "Скасувати останню оцінку" }).click();
    await expect(count).toHaveText(/^0 ·/);
    expect(await cueText(page)).toBe(firstCue);
  }

  // Walk the queue on a phone: every exercise type (question + answer), with
  // screenshots at both sizes. Seeded by `pnpm test-user`: one card of each type is due.
  await page.setViewportSize(mobile);
  const seen = new Set();
  const production = page.getByTestId("production-card");
  for (let step = 0; step < 24 && (await visibleSoon(answerBox.or(production))); step += 1) {
    if (await production.isVisible()) {
      seen.add(await assertProductionCard(page));
      continue;
    }
    const kind = await exerciseKind(page);
    const typedAnswer = kind === "recognition" ? "" : "smoke";
    const first = !seen.has(kind);
    if (first) await shotBoth(page, `practice-${kind}`);
    // A program word the test took as known: starts with recall, marked as such.
    if (shouldMutate && !seen.has("known") && (await page.getByText("Знайоме слово", { exact: true }).isVisible())) {
      await shotBoth(page, "practice-known-word");
      seen.add("known");
    }
    if (typedAnswer) await answerBox.fill(typedAnswer);
    await page.keyboard.press("Enter");
    await expect(page.getByText("Відповідь", { exact: true })).toBeVisible();
    await expect(ratingButton(page, kind)).toBeVisible();
    if (kind !== "recognition") await expect(page.getByTestId("auto-rating")).toContainText("Не згадав");
    await assertAboveTabBar(page, ratingButton(page, kind));
    if (first) await shotBoth(page, `practice-${kind}-answer`);
    seen.add(kind);
    await ratingButton(page, kind).click();
    await page.waitForTimeout(300);
  }
  await page.setViewportSize(desktop);
  if (shouldMutate) await assertGoalReached(page);
  const expected = [
    "recognition",
    "recall",
    "cloze",
    "listening",
    ...(shouldMutate ? ["known"] : []),
    ...(shouldMutate && expectAi ? ["sentence", "speaking"] : []),
  ];
  const missing = expected.filter((kind) => !seen.has(kind));
  if (missing.length > 0) throw new Error(`Exercise types not met in the queue (run "pnpm test-user" to reseed): ${missing.join(", ")}`);
}

/**
 * Own sentence / speak aloud: question, AI feedback (one real call each, a
 * fraction of a cent), the suggested rating, and for speaking also the
 * "no microphone access" note (getUserMedia rejected in the page).
 */
async function assertProductionCard(page) {
  const card = page.getByTestId("production-card");
  const feedback = page.getByTestId("production-feedback");
  const isSpeaking = (await card.getByRole("button", { name: "Записати" }).count()) > 0;
  const kind = isSpeaking ? "speaking" : "sentence";
  await shotBoth(page, `practice-${kind}`);

  if (isSpeaking) {
    await page.evaluate(() => {
      const devices = navigator.mediaDevices;
      window.__memoraGetUserMedia = devices.getUserMedia.bind(devices);
      devices.getUserMedia = () => Promise.reject(new DOMException("denied", "NotAllowedError"));
    });
    await card.getByRole("button", { name: "Записати" }).click();
    await expect(card.getByText("Немає доступу до мікрофона.", { exact: false })).toBeVisible();
    await shotBoth(page, "practice-speaking-denied");
    await page.evaluate(() => {
      navigator.mediaDevices.getUserMedia = window.__memoraGetUserMedia;
    });
    await card.getByRole("button", { name: "Записати" }).click();
    await expect(card.getByRole("button", { name: /^Готово/ })).toBeVisible();
    await page.waitForTimeout(3500);
    await shotBoth(page, "practice-speaking-recording");
    await card.getByRole("button", { name: /^Готово/ }).click();
  } else {
    await card.locator("#production-answer").fill("I always try to meet the deadline, but last week I miss it.");
    await card.getByRole("button", { name: /^Перевірити/ }).click();
  }

  const silent = card.getByText("Нічого не розчув", { exact: false });
  await expect(feedback.or(silent).or(card.getByRole("alert"))).toBeVisible({ timeout: 60000 });
  if (await silent.isVisible()) {
    console.log("Speak aloud: the fake microphone was not understood (no system voice) — skipped.");
    await card.getByRole("button", { name: "Пропустити" }).click();
    return kind;
  }
  if (!(await feedback.isVisible())) throw new Error(`${kind}: ${await card.getByRole("alert").innerText()}`);
  if (isSpeaking) await expect(card.getByTestId("production-said")).toContainText(/keys/i);
  await expect(page.getByTestId("auto-rating")).toBeVisible();
  // Easy is never suggested from AI feedback.
  await expect(page.getByTestId("auto-rating")).not.toContainText("Легко");
  await assertAboveTabBar(page, page.getByRole("button", { name: /^Далі/ }));
  await shotBoth(page, `practice-${kind}-answer`);
  await page.getByRole("button", { name: /^Далі/ }).click();
  await page.waitForTimeout(300);
  return kind;
}

/** The vocabulary test pool (bands with meanings, pseudowords) from its TS module. */
function readTestPool() {
  const source = fs.readFileSync("src/lib/memora/vocab-test-pool.ts", "utf8");
  return JSON.parse(source.slice(source.indexOf("= {") + 2, source.lastIndexOf("}") + 1));
}

/**
 * Onboarding as a learner who knows the first 4,000 words: the soft offer on
 * practice, the test (yes/no + meaning check), result, goals, minutes; then
 * the daily feed must put program words into today's practice.
 */
async function assertOnboarding(page) {
  const pool = readTestPool();
  const real = new Map(pool.bands.flatMap((band) => band.words.map((word) => [word.word, { ...word, band: band.band }])));
  await expect(page.getByText("Тест на 5 хвилин")).toBeVisible();
  await page.getByRole("link", { name: "Пройти", exact: true }).click();
  await expect(page).toHaveURL(`${baseUrl}/app/onboarding`);
  await heading(page, "Спершу визначимо твій рівень");
  await shotBoth(page, "onboarding-intro");
  await page.getByRole("button", { name: "Почати тест" }).click();

  const word = page.getByTestId("test-word");
  for (let step = 0; step < 80 && (await visibleSoon(word, 3000)); step += 1) {
    if (step === 2) await shotBoth(page, "onboarding-test");
    const text = (await word.innerText()).trim();
    const known = (real.get(text)?.band ?? 99) <= 4;
    await page.getByRole("button", { name: known ? "Знаю" : "Не знаю", exact: true }).click();
  }

  const checkLabel = page.getByText(/^Перевірка \d+ з \d+/);
  for (let step = 0; step < 12 && (await visibleSoon(checkLabel, 3000)); step += 1) {
    if (step === 0) await shotBoth(page, "onboarding-check");
    const text = (await page.locator("main [lang=en]").first().innerText()).trim();
    await page.getByRole("button", { name: real.get(text).uk, exact: true }).click();
  }

  await expect(page.getByTestId("test-vocab")).toContainText(/4\s000/);
  await shotBoth(page, "onboarding-result");
  await page.getByRole("button", { name: "Далі", exact: true }).click();
  await heading(page, "Для чого тобі англійська?");
  await page.getByRole("button", { name: /Робота \/ IT/ }).click();
  await shotBoth(page, "onboarding-goals");
  await page.getByRole("button", { name: "Далі", exact: true }).click();
  await heading(page, "Скільки часу на день?");
  await page.getByRole("tab", { name: "15 хв" }).click();
  await shotBoth(page, "onboarding-minutes");
  await page.getByRole("button", { name: "Почати", exact: true }).click();
  await expect(page).toHaveURL(`${baseUrl}/app`, { timeout: 90000 });
  await expect(page.getByText("Тест на 5 хвилин")).toHaveCount(0);
  // 15 minutes ≈ 6 new words today: the seeded new word + program words.
  await expect(page.getByTestId("practice-summary")).toContainText("6 нових слів", { timeout: 20000 });
  await shotBoth(page, "practice-feed");
}

/** Which exercise the current card is, from its instruction and input. */
async function exerciseKind(page) {
  if (await page.getByRole("button", { name: "Прослухати ще раз" }).isVisible().catch(() => false)) return "listening";
  const placeholder = await page.locator("#practice-answer").getAttribute("placeholder");
  if (placeholder?.startsWith("Впиши переклад")) return "recognition";
  if ((await page.locator("article").getByText("Встав пропущене слово", { exact: true }).count()) > 0) return "cloze";
  return "recall";
}

/** The card's prompt, to tell cards of the same type apart. */
function cueText(page) {
  return page.locator("article p.text-sm.text-muted").first().evaluate((node) => node.parentElement?.innerText ?? "");
}

/** Self-rated cards (recognition) show «Не згадав», typed ones a single «Далі». */
function ratingButton(page, kind) {
  return kind === "recognition"
    ? page.getByRole("button", { name: /^Не згадав/ })
    : page.getByRole("button", { name: /^Далі/ });
}

async function shotBoth(page, name) {
  if (!shotsDir) return;
  const size = page.viewportSize();
  await shot(page, name);
  await page.setViewportSize(size?.width === mobile.width ? desktop : mobile);
  await shot(page, name);
  await page.setViewportSize(size ?? desktop);
}

async function assertWords(page) {
  await navLink(page, "Слова").click();
  await heading(page, "Слова");
  await expect(page).toHaveURL(`${baseUrl}/app/words`);

  // CSV import preview (nothing is written).
  const stamp = Date.now();
  await page.getByRole("button", { name: /Імпорт/ }).first().click();
  const importDialog = page.getByRole("dialog", { name: "Імпорт з CSV" });
  await importDialog.locator('input[type="file"]').setInputFiles({
    name: `memora-smoke-${stamp}.csv`,
    mimeType: "text/csv",
    buffer: Buffer.from(`lemma_en,translation_uk\nsmoke csv ${stamp},перевірка`, "utf8"),
  });
  await expect(importDialog.getByText("готові", { exact: true })).toBeVisible();
  await expect(importDialog.getByRole("button", { name: /^Додати 1/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(importDialog).toHaveCount(0);
  await shot(page, "words");

  if (!shouldMutate) {
    const firstWord = page.locator("main ul li a").first();
    if ((await firstWord.count()) > 0) {
      await firstWord.click();
      await expect(page).toHaveURL(/\/app\/words\/[0-9a-f-]{36}$/);
      await page.goBack();
      await heading(page, "Слова");
    }
    return;
  }

  const lemma = `smoke word ${stamp}`;
  await page.getByRole("button", { name: "Додати слово" }).first().click();
  const addDialog = page.getByRole("dialog", { name: "Додати слово" });
  await addDialog.getByLabel("Англійською").fill(lemma);
  await addDialog.getByLabel(/^Переклад/).fill("тестове слово");
  await addDialog.getByLabel(/^Приклад речення/).fill(`This is a ${lemma}.`);
  await addDialog.getByRole("button", { name: "Додати", exact: true }).click();
  await expect(addDialog.getByText("Додано. Можна вводити наступне.")).toBeVisible({ timeout: 20000 });
  await addDialog.getByLabel("Англійською").fill(lemma);
  await expect(addDialog.getByText("Це слово вже є:")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("searchbox", { name: "Пошук" }).fill(lemma);
  await page.locator("main ul li a").filter({ hasText: lemma }).click();
  await expect(page).toHaveURL(/\/app\/words\/[0-9a-f-]{36}$/);
  const detailUrl = page.url();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(lemma);
  await expect(page.getByText("впізнати", { exact: true })).toBeVisible();
  await expect(page.getByText("згадати", { exact: true })).toHaveCount(0); // recall unlocks later
  await page.getByLabel(/^Переклад/).fill("оновлене тестове слово");
  await page.getByRole("button", { name: "Зберегти зміни" }).click();
  await expect(page.getByText("Зміни збережено.")).toBeVisible({ timeout: 20000 });
  await shot(page, "word-detail");

  // Browser back/forward between real routes.
  await page.goBack();
  await heading(page, "Слова");
  await page.goForward();
  await expect(page).toHaveURL(detailUrl);
  await expect(page.getByLabel(/^Переклад/)).toHaveValue("оновлене тестове слово");

  // Clean up the smoke word.
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Видалити", exact: true }).click();
  await expect(page).toHaveURL(`${baseUrl}/app/words`, { timeout: 20000 });
  await page.getByRole("searchbox", { name: "Пошук" }).fill(lemma);
  await expect(page.getByText("Нічого не знайдено")).toBeVisible();
  await page.getByRole("searchbox", { name: "Пошук" }).fill("");

  await assertAiWords(page);
}

/**
 * AI fill and "from a text" — only when the server has AI configured (the
 * "З тексту" button is shown). Words come from the shared lexicon cache after
 * the first run, so repeated smoke runs cost nothing.
 */
async function assertAiWords(page) {
  const fromText = page.getByRole("button", { name: "З тексту" });
  if ((await fromText.count()) === 0) {
    console.log("AI checks skipped: AI is not configured on this server.");
    return;
  }

  await page.getByRole("button", { name: "Додати слово" }).first().click();
  const addDialog = page.getByRole("dialog", { name: "Додати слово" });
  await addDialog.getByLabel("Англійською").fill("grumpy");
  await addDialog.getByRole("button", { name: "Заповнити" }).click();
  await expect(addDialog.getByLabel(/^Переклад/)).not.toHaveValue("", { timeout: 60000 });
  await expect(addDialog.getByLabel(/^Приклад речення/)).not.toHaveValue("");
  await shotBoth(page, "add-word-ai");
  if ((await addDialog.getByText("Це слово вже є:").count()) === 0) {
    await addDialog.getByRole("button", { name: "Додати", exact: true }).click();
    await expect(addDialog.getByText("Додано. Можна вводити наступне.")).toBeVisible({ timeout: 20000 });
  }
  await page.keyboard.press("Escape");

  await fromText.click();
  const textDialog = page.getByRole("dialog", { name: "Слова з тексту" });
  await textDialog.getByLabel(/^Текст англійською/).fill(
    "We ran into an old friend at the station. She looked grumpy, but it was no big deal.",
  );
  await textDialog.getByRole("button", { name: /Далі/ }).click();
  await textDialog.getByRole("button", { name: "station", exact: true }).click();
  await textDialog.getByRole("button", { name: "ran", exact: true }).click();
  await textDialog.getByRole("button", { name: "into", exact: true }).click();
  await expect(textDialog.getByText("ran into", { exact: true })).toBeVisible();
  await shotBoth(page, "from-text-pick");
  await textDialog.getByRole("button", { name: /Заповнити з AI · 2/ }).click();
  const addButton = textDialog.getByRole("button", { name: /^Додати \d/ });
  await expect(addButton).toBeVisible({ timeout: 60000 });
  await expect(textDialog.getByText("run into", { exact: true })).toBeVisible();
  await shotBoth(page, "from-text-review");
  if (await addButton.isEnabled()) {
    await addButton.click();
    await expect(page.getByText(/^Додано \d/)).toBeVisible({ timeout: 20000 });
  }
  await page.keyboard.press("Escape");
}

async function assertProgress(page) {
  await navLink(page, "Прогрес").click();
  await heading(page, "Прогрес");
  await expect(page.getByText("Активність", { exact: true })).toBeVisible();
  await expect(page.getByText("Прогноз повторень", { exact: true })).toBeVisible();
  await expect(page.getByText("Стадії запам’ятовування", { exact: true })).toBeVisible();
  await shot(page, "progress");
}

/**
 * The whole queue was practised: today's goal counts (server-confirmed), the
 * header shows it and the streak lights up from 1 day.
 */
async function assertGoalReached(page) {
  await expect(page.getByTestId("goal-text")).toHaveText("Ціль дня виконано", { timeout: 20000 });
  await expect(page.getByLabel(/^Серія: 1 день поспіль/).first()).toBeVisible();
  await shotBoth(page, "practice-goal");
  // A fresh load (server data) agrees with what the screen showed.
  await page.reload();
  await expect(page.getByTestId("goal-text")).toHaveText("Ціль дня виконано");
}

/** The reminder route is closed without the secret (and works with it). */
async function assertCronAuth(page) {
  const url = `${baseUrl}/api/cron/reminders`;
  expect((await page.request.post(url)).status()).toBe(401);
  expect((await page.request.post(url, { headers: { Authorization: "Bearer wrong" } })).status()).toBe(401);
  expect((await page.request.get(url)).status()).toBe(405);
  const secret = process.env.CRON_SECRET;
  if (secret && shouldMutate) {
    const response = await page.request.post(url, { headers: { Authorization: `Bearer ${secret}` } });
    expect(response.status()).toBe(200);
    const body = await response.json();
    for (const key of ["checked", "due", "sent", "removed"]) expect(typeof body[key]).toBe("number");
  }
}

async function assertSettings(page) {
  await navLink(page, "Профіль").click();
  await heading(page, "Профіль");
  await expect(page.getByRole("tablist", { name: "Хвилин на день" })).toBeVisible();
  await expect(page.getByText("Нових карток на день")).toHaveCount(0);
  await expect(page.getByText("Рівень англійської")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Оновити пароль", exact: true })).toBeDisabled();
  await expect(page.getByText("Скинути або видалити")).toBeVisible();
  if (shouldMutate) await expect(page.getByTestId("settings-level")).toContainText("слів");
  await shot(page, "settings");

  const speaking = page.getByTestId("speaking-switch");
  await expect(speaking).toHaveAttribute("aria-checked", "true");
  if (shouldMutate) {
    await speaking.click();
    await expect(page.getByText("Говоріння вимкнено.")).toBeVisible();
    await expect(speaking).toHaveAttribute("aria-checked", "false");
    await speaking.click();
    await expect(page.getByText("Говоріння ввімкнено.")).toBeVisible();
    await expect(speaking).toHaveAttribute("aria-checked", "true");
  }

  // Reminders: the switch is there; when this browser can subscribe, it works both ways.
  const reminders = page.getByTestId("reminders-switch");
  if (await visibleSoon(reminders)) {
    await expect(reminders).toHaveAttribute("aria-checked", "false");
    if (shouldMutate) {
      await reminders.click();
      const turnedOn = page.getByText("Нагадування ввімкнено.");
      const refused = page.getByText(/Не вдалося підписати|Сповіщення заблоковано/);
      await expect(turnedOn.or(refused)).toBeVisible({ timeout: 15000 });
      if (await turnedOn.isVisible()) {
        await expect(reminders).toHaveAttribute("aria-checked", "true");
        await expect(page.getByTestId("reminder-start")).toHaveValue("19");
        await page.getByTestId("reminder-start").selectOption("20");
        await expect(page.getByTestId("reminder-end")).toHaveValue("22");
        await shot(page, "settings-reminders");
        await reminders.click();
        await expect(page.getByText("Нагадування вимкнено.")).toBeVisible();
        await expect(reminders).toHaveAttribute("aria-checked", "false");
      } else {
        console.log("Reminders: this browser cannot subscribe to push (no push service); switch checked only.");
      }
    }
  } else {
    console.log("Reminders: push is not supported in this browser; panel shows the explanation.");
  }

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Повна копія/ }).click();
  const download = await downloadPromise;
  const backupPath = path.join(os.tmpdir(), `memora-smoke-backup-${Date.now()}.json`);
  await download.saveAs(backupPath);
  const backup = JSON.parse(fs.readFileSync(backupPath, "utf8"));
  if (backup.format !== "memora-backup-v2" || !Array.isArray(backup.words)) {
    throw new Error("Backup download has an unexpected format.");
  }

  await page.locator('input[type="file"][accept*="json"]').setInputFiles(backupPath);
  await expect(page.getByText("Дата копії", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Відновити", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Скасувати", exact: true }).click();
  await expect(page.getByText("Дата копії", { exact: true })).toHaveCount(0);
  fs.rmSync(backupPath, { force: true });
}

async function assertHelp(page) {
  await navLink(page, "Довідка").click();
  await heading(page, "Довідка");
  await expect(page.locator("#help-core")).toContainText("Як це працює");
  await expect(page.getByText(/QA/)).toHaveCount(0);
  await shot(page, "help");
}

async function assertMobile(page) {
  await page.setViewportSize(mobile);
  const screens = [
    ["Практика", "/app", "practice"],
    ["Слова", "/app/words", "words"],
    ["Прогрес", "/app/progress", "progress"],
    ["Профіль", "/app/settings", "settings"],
  ];

  for (const [label, url, name] of screens) {
    await navLink(page, label).click();
    await expect(page).toHaveURL(`${baseUrl}${url}`);
    await expect(navLink(page, label)).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await shot(page, name);
  }

  await page.getByRole("link", { name: "Довідка" }).filter({ visible: true }).first().click();
  await heading(page, "Довідка");
  await assertNoHorizontalOverflow(page);
  await shot(page, "help");

  // Android back button returns through the visited routes; refresh keeps the screen.
  await page.goBack();
  await expect(page).toHaveURL(`${baseUrl}/app/settings`);
  await page.reload();
  await heading(page, "Профіль");
  await page.setViewportSize(desktop);
}

/** "Share → Memora": a word opens "Add word", a text opens "From a text"; GET and POST. */
async function assertShareTarget(page) {
  await page.goto(`${baseUrl}/app/share?text=${encodeURIComponent("“thorough”")}&url=${encodeURIComponent("https://example.com/a")}`);
  await expect(page).toHaveURL(`${baseUrl}/app/words`);
  const addDialog = page.getByRole("dialog", { name: "Додати слово" });
  await expect(addDialog).toBeVisible();
  await expect(addDialog.getByRole("textbox").first()).toHaveValue("thorough");
  await shot(page, "share-word");
  await addDialog.getByRole("button", { name: "Закрити" }).last().click();

  const post = await page.request.post(`${baseUrl}/app/share`, { form: { text: "figure out" }, maxRedirects: 0 });
  expect(post.status()).toBe(303);
  expect(post.headers().location).toContain("/app/words?add=figure+out");

  const hasAi = await page.getByRole("button", { name: "З тексту" }).isVisible();
  if (!hasAi) {
    console.log("Share of a longer text skipped: AI is not configured on the server.");
    return;
  }
  const text = "My commute takes about forty minutes, so I listen to podcasts on the way.";
  await page.goto(`${baseUrl}/app/share?text=${encodeURIComponent(text)}`);
  await expect(page).toHaveURL(`${baseUrl}/app/words`);
  const textDialog = page.getByRole("dialog", { name: "Слова з тексту" });
  await expect(textDialog.getByText("Тапни слова, яких не знаєш", { exact: false })).toBeVisible();
  await expect(textDialog.getByRole("button", { name: "podcasts" })).toBeVisible();
  await shot(page, "share-text");
  await textDialog.getByRole("button", { name: "Закрити" }).last().click();
}

/** Chrome considers the app installable (manifest + service worker), checked via DevTools. */
async function assertInstallable(page, context) {
  await page.goto(`${baseUrl}/app`);
  const hasWorker = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return false;
    const ready = navigator.serviceWorker.ready.then(() => true);
    return Promise.race([ready, new Promise((resolve) => setTimeout(() => resolve(false), 10_000))]);
  });
  if (!hasWorker) {
    console.log("Installability skipped: the service worker registers only in a production build.");
    return;
  }
  const cdp = await context.newCDPSession(page);
  const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
  await cdp.detach();
  // Playwright contexts count as incognito, where Chrome never offers install.
  const problems = installabilityErrors.map((error) => error.errorId).filter((id) => id !== "in-incognito");
  if (problems.length > 0) throw new Error(`Not installable: ${problems.join(", ")}`);
}

/** A guest who shares a word signs in and lands on "Add word" with it. */
async function assertShareAfterSignIn(browser) {
  const context = await browser.newContext({ viewport: mobile });
  try {
    const page = await context.newPage();
    await page.goto(`${baseUrl}/app/share?text=grumpy`);
    await expect(page.getByRole("dialog", { name: "З поверненням" })).toBeVisible();
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Пароль", { exact: true }).fill(password);
    await page.getByRole("dialog").locator('form button[type="submit"]').click();
    await expect(page).toHaveURL(`${baseUrl}/app/words`, { timeout: 30000 });
    await expect(page.getByRole("dialog", { name: "Додати слово" }).getByRole("textbox").first()).toHaveValue("grumpy");
  } finally {
    await context.close();
  }
}

async function assertNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 1) throw new Error(`${page.url()} overflows horizontally by ${overflow}px.`);
}

async function assertNoConsoleErrors() {
  const meaningful = consoleProblems.filter((message) => !message.includes("Auth session missing"));
  if (meaningful.length > 0) throw new Error(`Browser console errors:\n${meaningful.join("\n")}`);
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);

/** After the answer is shown on a phone, the rating button is on screen, not under the tab bar. */
async function assertAboveTabBar(page, button) {
  await page.waitForTimeout(700); // the reveal scrolls the button into view smoothly
  const box = await button.boundingBox();
  const bar = await page.getByRole("navigation", { name: "Розділи" }).filter({ visible: true }).first().boundingBox();
  const limit = Math.min(bar?.y ?? Infinity, page.viewportSize()?.height ?? Infinity);
  if (!box || box.y + box.height > limit + 1) {
    throw new Error(`Rating button is hidden on a phone (bottom ${box ? box.y + box.height : "?"}px, tab bar at ${limit}px).`);
  }
}

function visibleSoon(locator, timeout = 5000) {
  return locator.waitFor({ state: "visible", timeout }).then(
    () => true,
    () => false,
  );
}
