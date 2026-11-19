# Memora — архітектура (поточний стан коду)

Опис того, що є в коді зараз (після пачки 0). Цільовий продукт — `product.md`,
план змін — `roadmap.md`.

## Стек
Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 ·
Supabase (Auth + Postgres + RLS) · `ts-fsrs` 5.x · Vitest · Playwright
(лише для smoke-скрипта). Хостинг — Vercel (Hobby), БД — Supabase Free
(проєкт `whqfpktgwwctqhqvsoqm`, eu-west-1; засинає після ~7 днів без запитів).
Прод: https://memora-saas.vercel.app, автодеплой із `main`.

## Структура
```
src/app/            layout, page.tsx (єдина сторінка), actions.ts (server actions),
                    manifest, іконки
src/proxy.ts        оновлює Supabase-сесію (cookie) на кожному запиті
src/components/
  memora-app.tsx    клієнтський оркестратор кабінету (~900 рядків, екрани через useState)
  memora/           practice, content-manager (слова/QA), analytics-workspace,
                    account-workspace, help-workspace, auth, layout, shared-ui,
                    landing/ (лендінг) тощо
src/lib/memora/     чиста логіка: scheduler (FSRS), answer-check, card-generator,
                    csv-import, duplicates, backup/export, streak, store (черга,
                    статистика), starter-content, action-validation,
                    password-policy, remote-store (усі запити до Supabase),
                    test-fixtures (тільки для тестів)
src/lib/supabase/   browser.ts / server.ts — клієнти @supabase/ssr
supabase/migrations SQL-міграції (історія розходиться з віддаленою БД —
                    буде скинуто в пачці 1)
scripts/            smoke.mjs, create-test-user.mjs
```

## Потік даних
1. Лендінг `/` для гостя; після входу той самий URL показує кабінет
   (`MemoraApp`). Вхід, реєстрація і скидання пароля йдуть з браузера
   напряму в Supabase Auth (`browser.ts`); пароль через наш сервер не
   проходить.
2. Кабінет викликає `loadMemoraStateAction`: сервер вантажить **усі** нотатки,
   картки й review_logs користувача в один об'єкт `MemoraState`; клієнт сам
   рахує чергу, статистику й прогрес (`store.ts`).
3. Мутації — server actions у `src/app/actions.ts`. Кожна: валідація входу
   (`action-validation.ts`) → `getAuthenticatedContext` → функція з
   `remote-store.ts` → `revalidatePath("/")` → `ActionResult`. Більшість
   повертає новий повний стан.
4. Оцінка картки: `gradeCardAction` (оновлює картку й пише `review_logs`,
   повертає `ReviewOutcome`), `undoReviewAction`, `pauseCardAction`.

Server actions: load/update profile і settings, restore backup, clear
materials, reset stats, grade/undo/pause, update card/note status, update note
content, delete note, add/import English та QA notes.

## Навчальна логіка
- FSRS через `ts-fsrs` (`scheduler.ts`); розклад зберігається в колонках
  картки (due, stability, difficulty, reps, lapses, state…).
- Слово = 2 картки (активний переклад uk→en, розуміння en→uk); QA-нотатка —
  картки термін/пояснення (`card-generator.ts`).
- Перевірка відповіді — нормалізація + Левенштейн (`answer-check.ts`).
- Ліміт нових карток на день і режим (усе / англійська / QA) — у `store.ts`.
- Стартовий контент (6 нотаток, 8 карток) додається при першому вході
  (`starter-content.ts`).

## Supabase
Таблиці (усі з RLS «тільки свої рядки», політики `*_own`):
`profiles`, `decks`, `notes`, `cards`, `review_logs`, `imports`, `import_rows`.
**Кодом не використовуються:** `tags`, `note_tags`, `media`, `analytics_daily`
(буде видалено в пачці 1).
RPC (`security invoker`): `restore_memora_backup`, `clear_memora_materials`,
`reset_memora_learning_stats`; тригерна функція `set_updated_at`.
Auth: email + пароль, підтвердження email, скидання пароля. Вбудований SMTP
шле листи лише членам команди проєкту. Leaked-password protection недоступний
на Free → власна політика пароля (8+ символів, літера й цифра,
`password-policy.ts`; мінімальну довжину дзеркалимо в налаштуваннях Supabase Auth).

## Безпека
Заголовки в `next.config.ts` (nosniff, HSTS, X-Frame-Options, Referrer-Policy,
Permissions-Policy, мінімальний CSP без script-src; nonce-CSP — пачка 9).
Секрети тільки в `.env.local` і Vercel env; service role key — лише для
скриптів, застосунок його не використовує.

## Змінні середовища
| Змінна | Де |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local`, Vercel |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local`, Vercel |
| `SUPABASE_SERVICE_ROLE_KEY` | лише `.env.local` (`create-test-user.mjs`) |
| `MEMORA_SMOKE_EMAIL` / `MEMORA_SMOKE_PASSWORD` | `.env.local`, пише `pnpm test-user` |
| `MEMORA_SMOKE_URL`, `MEMORA_SMOKE_MUTATE`, `MEMORA_SMOKE_BROWSER_PATH`, `MEMORA_SMOKE_HEADLESS` | необов'язкові, для `pnpm smoke` |

## Тести й перевірка
- `pnpm test` — Vitest, юніт-тести чистої логіки (`src/**/*.test.ts`).
- `pnpm smoke` — Playwright проти запущеного застосунку: лендінг, вхід, усі
  екрани кабінету, імпорт/бекап, мобільна навігація, додавання й
  редагування слова (`MEMORA_SMOKE_MUTATE=0` вимикає мутації). Тестовий
  акаунт: `pnpm test-user` створює або скидає `memora.e2e@example.com` і
  пише дані в `.env.local`. Локально без Chrome: `MEMORA_SMOKE_BROWSER_PATH`
  вказує на chromium з кешу Playwright.
- Перед пушем: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

## Розгортання
Vercel підключений до GitHub: `main` → прод; інші гілки → preview-URL
(preview і прод ділять одну БД). Env-змінні задаються у Vercel.
Менеджер пакетів — pnpm 11 (`packageManager` у `package.json`);
`pnpm-workspace.yaml` містить `packages: ["."]` і `allowBuilds`.

## Заплановані зміни (пачка 1)
QA видаляється повністю; схема v2 і baseline-міграція; маршрути `/app/*`;
черга/статистика в БД замість завантаження всього; розбиття `memora-app.tsx`;
allowlist реєстрації. Деталі — `roadmap.md` §4.
