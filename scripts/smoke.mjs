import { chromium, expect } from "@playwright/test";
import os from "node:os";
import path from "node:path";

const baseUrl = process.env.MEMORA_SMOKE_URL ?? "http://localhost:3000";
const email = process.env.MEMORA_SMOKE_EMAIL;
const password = process.env.MEMORA_SMOKE_PASSWORD;
const shouldMutate = process.env.MEMORA_SMOKE_MUTATE !== "0";
const consoleProblems = [];

async function main() {
  await assertServerReady();

  const browser = await launchBrowser();
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleProblems.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    consoleProblems.push(error.message);
  });

  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    await assertNoNextOverlay(page);
    await assertLandingAndLogin(page);

    if (!email || !password) {
      console.log("Smoke OK: login screen. Authenticated checks skipped because MEMORA_SMOKE_EMAIL/PASSWORD are not set.");
      return;
    }

    await signIn(page, email, password);
    await assertPracticeView(page);
    await assertHelpAndAccount(page);
    await assertCsvImportPreview(page);
    await assertBackupExportAndRestorePreview(page);
    await assertProgressWeakCardEdit(page);
    await assertMobileNavigation(page);

    if (shouldMutate) {
      await assertAddAndEditEnglishNote(page);
    } else {
      console.log("Mutation checks skipped because MEMORA_SMOKE_MUTATE=0.");
    }

    await assertNoConsoleErrors();
    console.log("Smoke OK: authenticated UI flow.");
  } finally {
    await context.close();
    await browser.close();
  }
}

async function launchBrowser() {
  try {
    return await chromium.launch({
      channel: process.env.MEMORA_SMOKE_BROWSER_CHANNEL ?? "chrome",
      headless: process.env.MEMORA_SMOKE_HEADLESS !== "0",
    });
  } catch {
    return chromium.launch({
      headless: process.env.MEMORA_SMOKE_HEADLESS !== "0",
    });
  }
}

async function assertServerReady() {
  try {
    const response = await fetch(baseUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    throw new Error(
      `Memora is not reachable at ${baseUrl}. Start it with "pnpm dev" or set MEMORA_SMOKE_URL. ${error instanceof Error ? error.message : ""}`,
    );
  }
}

function section(page, label) {
  return page
    .getByRole("navigation", { name: "Розділи" })
    .getByRole("button", { name: new RegExp(`^${label}`) })
    .first();
}

async function assertLandingAndLogin(page) {
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Згадуй.");
  await expect(page.getByRole("button", { name: "Почати навчання", exact: true }).first()).toBeVisible();

  // The interactive demo card works without an account.
  await page.locator("#demo-answer").fill("flaky tset");
  await page.locator("#demo-answer").press("Enter");
  await expect(page.getByText("Майже — є описка")).toBeVisible();

  await page.getByRole("button", { name: "Увійти", exact: true }).first().click();
  await expect(page.getByRole("dialog", { name: "З поверненням" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Пароль", { exact: true })).toBeVisible();
  await expect(page.locator('form button[type="submit"]')).toContainText("Увійти");
}

async function signIn(page, userEmail, userPassword) {
  await page.getByLabel("Email").fill(userEmail);
  await page.getByLabel("Пароль", { exact: true }).fill(userPassword);
  await page.locator('form button[type="submit"]').click();
  await expect(section(page, "Практика")).toBeVisible({ timeout: 20000 });
}

async function assertPracticeView(page) {
  await section(page, "Практика").click();
  await expect(page.getByRole("tab", { name: /^Усе/ })).toBeVisible();

  const answerBox = page.locator("#practice-answer");
  if (await answerBox.isVisible().catch(() => false)) {
    await answerBox.fill("smoke");
    await answerBox.press("Enter");
    await expect(page.getByText("Відповідь", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Не згадав/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Згадав/ })).toBeVisible();
  } else {
    console.log("Practice card check skipped because the queue is empty.");
  }
}

async function assertHelpAndAccount(page) {
  await section(page, "Довідка").click();
  await expect(page.getByRole("heading", { name: "Довідка", exact: true })).toBeVisible();
  await expect(page.locator("#help-core")).toContainText("Як це працює");
  await expect(page.locator("#help-keys")).toContainText("Гарячі клавіші");

  await section(page, "Профіль").click();
  await expect(page.getByRole("heading", { name: "Профіль", exact: true })).toBeVisible();
  await expect(page.getByLabel("Нових карток на день")).toBeVisible();
  await expect(page.getByRole("tab", { name: "2 кнопки" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Оновити пароль", exact: true })).toBeDisabled();
  await expect(page.getByRole("heading", { name: "Дані", exact: true })).toBeVisible();
  await expect(page.getByText("Небезпечна зона")).toBeVisible();

  await section(page, "Англійські слова").click();
  await expect(page.getByRole("heading", { name: "Англійські слова", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Додати слово" }).first()).toBeVisible();

  await section(page, "QA-терміни").click();
  await expect(page.getByRole("heading", { name: "QA-терміни", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Додати термін" }).first()).toBeVisible();
}

async function assertCsvImportPreview(page) {
  const stamp = Date.now();
  const csv = [
    "lemma_en,translation_uk,example_en",
    `smoke csv ${stamp},csv перевірка ${stamp},This CSV smoke row stays in preview.`,
  ].join("\n");

  await section(page, "Англійські слова").click();
  await page.getByRole("button", { name: /Імпорт/ }).first().click();
  const dialog = page.getByRole("dialog", { name: "Імпорт з CSV" });
  await dialog.locator('input[type="file"][accept*=".csv"]').setInputFiles({
    name: `memora-smoke-${stamp}.csv`,
    mimeType: "text/csv",
    buffer: Buffer.from(csv, "utf8"),
  });

  await expect(dialog.getByText(`memora-smoke-${stamp}.csv`)).toBeVisible();
  await expect(dialog.getByText("готові", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /^Додати \d+/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
}

async function assertBackupExportAndRestorePreview(page) {
  await section(page, "Профіль").click();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Повна копія/ }).click();
  const download = await downloadPromise;
  const restorePath = path.join(os.tmpdir(), `memora-smoke-backup-${Date.now()}.json`);
  await download.saveAs(restorePath);

  await page.locator('input[type="file"][accept*="json"]').setInputFiles(restorePath);

  await expect(page.getByText("Дата копії", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Відновити", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Скасувати", exact: true }).click();
  await expect(page.getByText("Дата копії", { exact: true })).toHaveCount(0);
}

async function assertProgressWeakCardEdit(page) {
  await section(page, "Прогрес").click();
  await expect(page.getByRole("heading", { name: "Прогрес", exact: true })).toBeVisible();
  await expect(page.getByText("Активність", { exact: true })).toBeVisible();
  await expect(page.getByText("Слабкі місця", { exact: true })).toBeVisible();

  const editButtons = page.getByRole("button", { name: "Редагувати матеріал", exact: true });
  if ((await editButtons.count()) === 0) {
    console.log("Weak-card edit check skipped because there are no weak cards yet.");
    return;
  }

  await editButtons.first().click();
  await expect(page.getByRole("dialog", { name: "Матеріал" })).toBeVisible({ timeout: 10000 });
  await page.keyboard.press("Escape");
}

async function assertMobileNavigation(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(section(page, "Прогрес")).toBeVisible();
  await section(page, "Прогрес").click();
  await expect(page.getByRole("heading", { name: "Прогрес", exact: true })).toBeVisible();
  await section(page, "Профіль").click();
  await expect(page.getByRole("button", { name: "Вийти" }).first()).toBeVisible();
  await section(page, "Практика").click();
  await expect(page.getByRole("tab", { name: /^Усе/ })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  if (overflow > 1) throw new Error(`Mobile layout overflows horizontally by ${overflow}px.`);
  await page.setViewportSize({ width: 1440, height: 1000 });
}

async function assertAddAndEditEnglishNote(page) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const phrase = `smoke phrase ${stamp}`;
  const translation = `тестова фраза ${stamp}`;
  const updatedTranslation = `оновлена тестова фраза ${stamp}`;

  await section(page, "Англійські слова").click();
  await page.getByRole("button", { name: "Додати слово" }).first().click();
  let addDialog = page.getByRole("dialog", { name: "Додати слово" });
  await addDialog.getByLabel("Англійською").fill(phrase);
  await addDialog.getByLabel(/^Переклад/).fill(translation);
  await addDialog.getByLabel(/^Приклад речення/).fill(`This is a ${phrase}.`);
  await addDialog.getByRole("button", { name: "Додати", exact: true }).click();
  await expect(addDialog.getByText("Додано. Можна вводити наступне.")).toBeVisible({
    timeout: 20000,
  });
  await page.keyboard.press("Escape");

  await page.getByRole("searchbox", { name: "Пошук" }).fill(phrase);
  await page.locator("li button").filter({ hasText: phrase }).click();
  const details = page.getByRole("dialog", { name: "Матеріал" });
  await details.getByLabel(/^Переклад/).fill(updatedTranslation);
  await details.getByRole("button", { name: "Зберегти зміни" }).click();
  await expect(page.getByText("Зміни збережено.")).toBeVisible({ timeout: 20000 });
  await page.keyboard.press("Escape");

  const mergeTranslation = `злита тестова фраза ${stamp}`;
  await page.getByRole("button", { name: "Додати слово" }).first().click();
  addDialog = page.getByRole("dialog", { name: "Додати слово" });
  await addDialog.getByLabel("Англійською").fill(phrase);
  await addDialog.getByLabel(/^Переклад/).fill(mergeTranslation);
  await expect(addDialog.getByText(/Схоже, це вже є/)).toBeVisible();
  await addDialog.getByRole("button", { name: "Оновити наявний" }).click();
  const mergedDetails = page.getByRole("dialog", { name: "Матеріал" });
  await expect(mergedDetails).toBeVisible({ timeout: 20000 });
  await expect(mergedDetails.getByLabel(/^Переклад/)).toHaveValue(mergeTranslation);
}

async function assertNoNextOverlay(page) {
  const hasOverlay = await page.locator("[data-nextjs-dialog-overlay]").count();
  if (hasOverlay > 0) {
    throw new Error("Next.js error overlay is visible.");
  }
}

async function assertNoConsoleErrors() {
  const meaningful = consoleProblems.filter(
    (message) => !message.includes("Auth session missing"),
  );

  if (meaningful.length > 0) {
    throw new Error(`Browser console errors:\n${meaningful.join("\n")}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
