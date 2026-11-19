# Memora — архітектура (поточний стан коду)

Оновлено: 2026-11-19, після пачки 1 (схема v2 + маршрути). Цільовий продукт описано в
`product.md`, план робіт — у `roadmap.md`.

## Стек
Next.js 16 (App Router, server components, server actions) · React 19 · TypeScript ·
Tailwind v4 · Supabase (Auth + Postgres + RLS) · `ts-fsrs` 5.x · Vitest · Playwright
(smoke). Хостинг: Vercel Hobby (`main` = прод, гілки = preview). Supabase Free,
project `whqfpktgwwctqhqvsoqm`. Preview і прод ділять одну БД.

## Маршрути
| URL | Що | Файл |
|---|---|---|
| `/` | Лендінг; залогіненим замість входу показує «Відкрити Memora» | `src/app/page.tsx`, `components/memora/landing-page.tsx` |
| `/app` | Практика (черга на сьогодні) | `src/app/app/page.tsx`, `components/memora/practice/*` |
| `/app/words`, `/app/words/[id]` | Бібліотека слів, деталі слова | `src/app/app/words/*`, `components/memora/words/*` |
| `/app/progress` | Прогрес | `components/memora/progress-view.tsx` |
| `/app/settings` | Профіль і налаштування, бекап, небезпечна зона | `components/memora/settings-workspace.tsx` |
| `/app/help` | Довідка | `components/memora/help-view.tsx` |
| `/beta` | «Закрита бета» для акаунтів поза allowlist | `components/memora/beta-screen.tsx` |

`src/app/app/layout.tsx` + `components/memora/app-shell.tsx` — спільна оболонка
(сайдбар на десктопі, верхня панель + нижні 4 вкладки на телефоні, тости).

## Доступ і безпека (три рівні)
1. `src/proxy.ts` — оновлює сесійну cookie; гостей з `/app/*` веде на `/`; акаунти
   поза allowlist (`is_current_user_allowed()`) — на `/beta`.
2. `lib/memora/data/context.ts` — `getAppContext()` для сторінок,
   `requireActionContext()` для server actions (перевіряє користувача й allowlist).
3. RLS у БД: доступ лише до своїх рядків + restrictive-політика allowlist на кожній таблиці.

Allowlist — таблиця `allowed_emails` (без політик, читає лише security-definer функція).
Додати людину: `insert into public.allowed_emails (email) values ('...')`.
Публічний запуск = змусити `is_current_user_allowed()` повертати `true` + свій SMTP.

Також: security headers у `next.config.ts`, парольна політика
`lib/memora/password-policy.ts` (8+ символів, літера й цифра).

## Дані: схема v2
Міграція `supabase/migrations/20261119180000_memora_v2_baseline.sql` (baseline,
замінює всю історію v1).

| Таблиця | Призначення |
|---|---|
| `profiles` | `daily_minutes`, `goals`, `level_estimate` (тест рівня, пачка 4), `settings` jsonb (тимчасово: `daily_new_limit`, `reviewButtons` — до пачки 2), `timezone` |
| `lexicon` | Спільний словник програми (пачка 4). Читають усі з allowlist, пише лише service role |
| `user_words` | Слово в бібліотеці: `lemma`, `source` (program/manual/text/import), `status`, `content` jsonb, `lexicon_id` |
| `cards` | Картка = слово × `kind` (recognition, recall, cloze, listening, sentence, speaking) + FSRS-поля. Текст картки не зберігається |
| `review_logs` | Кожна оцінка: rating, час, відповідь, `schedule_before/after` (для undo) |
| `allowed_emails` | Allowlist закритої бети |

SQL-функції (security invoker, RLS діє): `get_practice_summary`, `get_practice_queue`
(due-картки з лімітом нових на сьогодні), `get_streak`, `get_progress_stats`
(усе для екрана прогресу одним запитом), `restore_words_backup` (атомарне відновлення).

Типи БД генеруються: `supabase gen types typescript --linked > src/lib/supabase/database.types.ts`.

## Шар коду
- `lib/memora/data/*` — читання/запис по фічах (words, practice, progress, profile, backup).
- `lib/memora/actions/*` — server actions (`"use server"`): words, practice
  (`gradeCardAction`, `undoReviewAction`, …), account. Повертають лише змінене.
- `lib/memora/card-render.ts` — текст картки (питання/відповідь) з `content` + `kind`.
- `lib/memora/word-content.ts` — форма `content` слова, нормалізація.
- `lib/memora/scheduler.ts` — адаптер `ts-fsrs` (оцінка рахується на сервері).
- `lib/memora/queue.ts`, `progress.ts`, `streak.ts`, `word-progress.ts` — чиста логіка.
- `lib/memora/answer-check.ts` — перевірка введеної відповіді.
- `lib/memora/csv-import.ts`, `export.ts`, `backup.ts` — імпорт/експорт/бекап (лише v2-формат).
- `lib/memora/starter-content.ts` — 10 стартових слів при першому вході (до пачки 4).
- `components/memora/practice/use-practice-session.ts` — стан сесії: оптимістична
  оцінка, черга записів на сервер, undo.
- `components/memora/use-fresh-snapshot.ts` — після Back/Forward форсує свіжі дані.

## Тести й перевірки
- `pnpm test` — Vitest, чиста логіка (53 тести).
- `pnpm smoke` — Playwright, повний сценарій від імені тестового користувача
  (`pnpm test-user` створює/скидає `memora.e2e@example.com`). Env: `MEMORA_SMOKE_URL`,
  `MEMORA_SMOKE_MUTATE=0`, `MEMORA_SMOKE_BROWSER_PATH`, `MEMORA_SMOKE_SHOTS=<dir>`.
- CI (`.github/workflows/ci.yml`): lint, typecheck, test, build.

## Міграції БД — як застосовувати
MCP `apply_migration` у цьому клієнті зависає на невидимому підтвердженні. Робочий шлях —
Supabase CLI (залогінений, проєкт прив'язаний):
`supabase db query --linked -f <file.sql>` + запис у
`supabase_migrations.schema_migrations (version, name)`; файл зберегти як
`supabase/migrations/<version>_<name>.sql`.

## Env
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Vercel + `.env.local`);
лише локально: `SUPABASE_SERVICE_ROLE_KEY`, `MEMORA_SMOKE_EMAIL/PASSWORD`.

## Відомі обмеження
- Бекапи старої версії (v1) не відновлюються; історії CSV-імпортів більше немає.
- Відновлення бекапу — до 4 МБ (ліміт тіла запиту Vercel 4.5 МБ).
- Порядок повторень у `get_practice_queue` — наближена формула retrievability (FSRS-4.5);
  уточнити при переході на `ts-fsrs` 6 (пачка 2).
