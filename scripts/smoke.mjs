import { chromium, expect } from "@playwright/test";

const baseUrl = process.env.MEMORA_SMOKE_URL ?? "http://localhost:3000";
const email = process.env.MEMORA_SMOKE_EMAIL;
const password = process.env.MEMORA_SMOKE_PASSWORD;
const shouldMutate = process.env.MEMORA_SMOKE_MUTATE !== "0";
const consoleProblems = [];

async function main() {
  await assertServerReady();

  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

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
    await assertLoginScreen(page);

    if (!email || !password) {
      console.log("Smoke OK: login screen. Authenticated checks skipped because MEMORA_SMOKE_EMAIL/PASSWORD are not set.");
      return;
    }

    await signIn(page, email, password);
    await assertTodayView(page);
    await assertHelpAndAccount(page);

    if (shouldMutate) {
      await assertAddAndEditEnglishNote(page);
    } else {
      console.log("Mutation checks skipped because MEMORA_SMOKE_MUTATE=0.");
    }

    await assertNoConsoleErrors();
    console.log("Smoke OK: authenticated UI flow.");
  } finally {
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

async function assertLoginScreen(page) {
  await expect(page.getByText("Memora").first()).toBeVisible();
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

async function assertTodayView(page) {
  await page.getByRole("button", { name: "Практика", exact: true }).click();
  await expect(page.getByRole("button", { name: "Усе", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Додати матеріал", exact: true })).toHaveCount(0);
  await expect(page.getByLabel(/Серія навчання/)).toBeVisible();
  await expect(page.getByText("Повторити")).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "Навчання", exact: true })).toBeVisible();
  await expect(page.locator('input[type="range"]')).toHaveAttribute("max", "50");
  await expect(page.getByRole("heading", { name: "Безпека", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Дані", exact: true })).toBeVisible();

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
