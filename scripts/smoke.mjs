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

async function assertLandingAndLogin(page) {
  await expect(page.getByRole("heading", { name: "Memora", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Почати навчання", exact: true }).first()).toBeVisible();
  await expect(page.getByText("Три кроки замість нескінченного перечитування.")).toBeVisible();

  await page.getByRole("button", { name: "Увійти", exact: true }).first().click();
  await expect(page.getByRole("dialog", { name: "Вхід до Memora" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Пароль")).toBeVisible();
  await expect(page.locator('form button[type="submit"]')).toContainText("Увійти");
}

async function signIn(page, userEmail, userPassword) {
  await page.getByLabel("Email").fill(userEmail);
  await page.getByLabel("Пароль").fill(userPassword);
  await page.locator('form button[type="submit"]').click();
  await expect(page.getByRole("button", { name: "Практика", exact: true })).toBeVisible({
    timeout: 20000,
  });
}

async function assertPracticeView(page) {
  await page.getByRole("button", { name: "Практика", exact: true }).click();
  await expect(page.getByRole("button", { name: "Усе", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Додати матеріал", exact: true })).toHaveCount(0);
  await expect(page.getByLabel(/Серія навчання/)).toBeVisible();
  await expect(page.getByText("Повторити")).toBeVisible();

  const answerBox = page.locator("textarea").first();
  if (await answerBox.isVisible().catch(() => false)) {
    await answerBox.fill("smoke");
    await page.getByRole("button", { name: "Перевірити відповідь" }).click();
    await expect(page.getByRole("dialog", { name: "Правильна відповідь" })).toBeVisible();
    await page.getByLabel("Закрити відповідь").last().click();
    await expect(page.getByRole("dialog", { name: "Правильна відповідь" })).toHaveCount(0);
  }
}

async function assertHelpAndAccount(page) {
  await page.getByRole("button", { name: "Як користуватись", exact: true }).click();
  await expect(page.getByText("Зміст", { exact: true })).toBeVisible();
  await expect(page.locator("#help-core").getByText("Суть і алгоритм", { exact: true })).toBeVisible();
  await expect(page.locator("#help-profile").getByText("Профіль і дані", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Профіль", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Профіль", exact: true })).toBeVisible();
  await expect(page.getByText("Мова інтерфейсу")).toHaveCount(0);
  await expect(page.getByText("Часовий пояс")).toHaveCount(0);
  await expect(page.getByText("Хвилин на день")).toHaveCount(0);
  await expect(page.getByLabel("Нових карток на день")).toBeVisible();
  await expect(page.locator('input[type="number"][max="50"]')).toBeVisible();
  await expect(page.getByLabel("Оцінювання")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Безпека", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Надіслати", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Оновити пароль", exact: true })).toBeDisabled();
  await expect(page.getByRole("heading", { name: "Дані", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Очищення даних", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Англійські слова", exact: true }).click();
  await expect(page.getByRole("region", { name: "Новий матеріал" })).toBeVisible();
  await expect(page.getByText("Імпорт слів", { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("Пошук")).toBeVisible();
  await expect(page.getByText("Активні", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "QA та тестування", exact: true }).click();
  await expect(page.getByRole("region", { name: "Новий матеріал" })).toBeVisible();
  await expect(page.getByText("Імпорт QA-термінів", { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("Пошук")).toBeVisible();
  await expect(page.getByText("Усього", { exact: true })).toBeVisible();
}

async function assertCsvImportPreview(page) {
  const stamp = Date.now();
  const csv = [
    "lemma_en,translation_uk,example_en",
    `smoke csv ${stamp},csv перевірка ${stamp},This CSV smoke row stays in preview.`,
  ].join("\n");

  await page.getByRole("button", { name: "Англійські слова", exact: true }).click();
  await page
    .locator('input[type="file"][accept*=".csv"]')
    .setInputFiles({
      name: `memora-smoke-${stamp}.csv`,
      mimeType: "text/csv",
      buffer: Buffer.from(csv, "utf8"),
    });

  await expect(page.getByText(`memora-smoke-${stamp}.csv`)).toBeVisible();
  await expect(page.getByText("Готові", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Додати \d+ з CSV/ })).toBeVisible();
}

async function assertBackupExportAndRestorePreview(page) {
  await page.getByRole("button", { name: "Профіль", exact: true }).click();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Повна копія JSON" }).click();
  const download = await downloadPromise;
  const restorePath = path.join(os.tmpdir(), `memora-smoke-backup-${Date.now()}.json`);
  await download.saveAs(restorePath);

  await page
    .locator('input[type="file"][accept*="json"]')
    .setInputFiles(restorePath);

  await expect(page.getByText("Дата копії", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Відновити копію", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Скасувати", exact: true }).click();
  await expect(page.getByText("Дата копії", { exact: true })).toHaveCount(0);
}

async function assertProgressWeakCardEdit(page) {
  await page.getByRole("button", { name: "Прогрес", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Слабкі картки", exact: true })).toBeVisible();

  const editButtons = page.getByRole("button", { name: "Виправити матеріал", exact: true });
  if ((await editButtons.count()) === 0) {
    console.log("Weak-card edit check skipped because there are no weak cards yet.");
    return;
  }

  await editButtons.first().click();
  await expect(page.getByRole("dialog", { name: "Деталі матеріалу" })).toBeVisible({
    timeout: 10000,
  });
  await page.getByRole("button", { name: "Закрити", exact: true }).last().click();
}

async function assertMobileNavigation(page) {
  await page.setViewportSize({ width: 430, height: 932 });
  await expect(page.getByLabel("Відкрити меню")).toBeVisible();
  await page.getByLabel("Відкрити меню").click();
  await expect(page.getByRole("button", { name: "Прогрес", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Прогрес", exact: true }).click();
  await expect(page.getByLabel("Відкрити меню")).toBeVisible();

  await page.getByLabel("Відкрити меню").click();
  await page.getByRole("button", { name: "Практика", exact: true }).click();
  await expect(page.getByRole("button", { name: "Усе", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
}

async function assertAddAndEditEnglishNote(page) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const phrase = `smoke phrase ${stamp}`;
  const translation = `тестова фраза ${stamp}`;
  const updatedTranslation = `оновлена тестова фраза ${stamp}`;

  await page.getByRole("button", { name: "Англійські слова", exact: true }).click();
  const newMaterial = page.getByRole("region", { name: "Новий матеріал" });
  await newMaterial.getByLabel("Слово або фраза").fill(phrase);
  await newMaterial.getByLabel("Значення").fill(translation);
  await newMaterial.getByLabel("Приклад").fill(`This is a ${phrase}.`);
  await newMaterial.getByRole("button", { name: "Додати", exact: true }).click();
  await expect(page.getByText("Додано англійський матеріал та 2 картки.")).toBeVisible({
    timeout: 20000,
  });

  await page.getByPlaceholder("Пошук").fill(phrase);
  await page.locator("button").filter({ hasText: phrase }).click();
  const details = page.getByRole("dialog", { name: "Деталі матеріалу" });
  await details.getByLabel("Значення").fill(updatedTranslation);
  await details.getByRole("button", { name: "Зберегти" }).click();
  await expect(page.getByText("Матеріал збережено.")).toBeVisible({
    timeout: 20000,
  });
  await details.getByRole("button", { name: "Закрити" }).last().click();

  const mergeTranslation = `злита тестова фраза ${stamp}`;
  await newMaterial.getByLabel("Слово або фраза").fill(phrase);
  await newMaterial.getByLabel("Значення").fill(mergeTranslation);
  await newMaterial.getByLabel("Приклад").fill(`Merged duplicate for ${phrase}.`);
  await expect(newMaterial.getByText("Схожий запис уже є")).toBeVisible();
  await newMaterial.getByRole("button", { name: "Оновити існуючий" }).click();
  const mergedDetails = page.getByRole("dialog", { name: "Деталі матеріалу" });
  await expect(mergedDetails).toBeVisible({
    timeout: 20000,
  });
  await expect(mergedDetails.getByLabel("Значення")).toHaveValue(mergeTranslation);
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
