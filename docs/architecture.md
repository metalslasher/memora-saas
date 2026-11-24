# Memora — архітектура (поточний стан коду)

Оновлено: 2026-11-23, пачка 3 (AI-шар). Цільовий продукт описано в
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
| `profiles` | `daily_minutes`, `goals`, `level_estimate` (тест рівня, пачка 4), `settings` jsonb (не використовується; колонку видаляє міграція `practice_engine_cleanup` після merge пачки 2), `timezone` |
| `lexicon` | Спільний словник програми (пачка 4). Читають усі з allowlist, пише лише service role |
| `user_words` | Слово в бібліотеці: `lemma`, `source` (program/manual/text/import), `status`, `content` jsonb, `lexicon_id` |
| `cards` | Картка = слово × `kind` (recognition, recall, cloze, listening; sentence, speaking — пізніше) + FSRS-поля. Створюються ліниво: нове слово — лише recognition, решта відкривається (`exercise-unlock.ts`). Текст картки не зберігається |
| `review_logs` | Кожна оцінка: rating, час, відповідь, `schedule_before/after` (для undo) |
| `ai_usage` | Облік кожного платного AI-виклику: feature, provider, model, токени, символи/секунди аудіо, `cost_usd`, `status` (pending → ok/failed). Користувач читає свої рядки, пише лише service role. `user_id` при видаленні акаунта → null (витрати лишаються в місяці) |
| `allowed_emails` | Allowlist закритої бети |

SQL-функції (security invoker, RLS діє): `get_practice_overview` (лічильники для шапки),
`get_practice_cards` (повторення на сьогодні з урахуванням «одне слово — одна картка на
день» + кандидати в нові слова; порядок і темп рахує TS). Старі `get_practice_summary`,
`get_practice_queue` і колонки `profiles.settings`, `cards.elapsed_days` видаляє
`20261120100000_practice_engine_cleanup` (застосовується після merge пачки 2). Також: `get_streak`, `get_progress_stats`
(усе для екрана прогресу одним запитом), `restore_words_backup` (атомарне відновлення).

Міграція `20261123100000_ai_layer`: `ai_usage`, функції `ai_month_spend()` і `ai_reserve(...)`
(лише service role; advisory lock — паралельні виклики не перевищать бюджет), колонки
`lexicon.enriched_at`/`enrich_model`, публічний бакет Storage `tts` (читання за URL, запис лише service role).

Типи БД генеруються: `supabase gen types typescript --linked > src/lib/supabase/database.types.ts`.

## Шар коду
- `lib/memora/data/*` — читання/запис по фічах (words, practice, progress, profile, backup).
- `lib/memora/actions/*` — server actions (`"use server"`): words, practice
  (`gradeCardAction`, `undoReviewAction`, …), account. Повертають лише змінене.
- `lib/memora/card-render.ts` — текст картки (питання/відповідь) з `content` + `kind`;
  `cloze.ts` — речення з пропуском із прикладу слова.
- `lib/memora/exercise-unlock.ts` — поступове відкриття вправ (recognition → recall →
  cloze/listening).
- `lib/memora/pace.ts` — хвилини на день → кількість нових слів (формула в коментарі).
- `lib/memora/auto-grade.ts` — автооцінка введеної відповіді (Again/Hard/Good/Easy).
- `lib/memora/word-forms.ts` — словоформи (s/ed/ing, неправильні дієслова) для перевірки.
- `lib/memora/word-content.ts` — форма `content` слова, нормалізація.
- `lib/memora/scheduler.ts` — адаптер `ts-fsrs` 6 (FSRS-6, fuzz із сідом на картку;
  оцінка рахується на сервері, клієнт — оптимістично тим самим кодом).
- `lib/memora/queue.ts` (порядок за retrievability FSRS-6, sibling burying), `progress.ts`, `streak.ts`, `word-progress.ts` — чиста логіка.
- `lib/memora/answer-check.ts` — перевірка введеної відповіді: варіанти, синоніми,
  словоформи, артиклі/to, підсвітка різниці.
- `lib/memora/csv-import.ts`, `export.ts`, `backup.ts` — імпорт/експорт/бекап (лише v2-формат).
- `lib/memora/starter-content.ts` — 10 стартових слів при першому вході (до пачки 4).
- `components/memora/practice/use-practice-session.ts` — стан сесії: оптимістична
  оцінка, черга записів на сервер (оцінки й undo йдуть строго по черзі), undo, таймер сесії.
- `components/memora/practice/study-card.tsx` — картка вправи, автооцінка, панель leech.
- `components/memora/use-fresh-snapshot.ts` — після Back/Forward форсує свіжі дані.

## AI-шар (`lib/memora/ai/*`, лише сервер)
- `pricing.ts` — ціни моделей з датою звірки; невідома модель = помилка, а не вгадана ціна.
- `providers.ts` — OpenAI і Gemini через `fetch` (без SDK): `generateJson` (structured output
  за JSON-схемою) і `synthesize` (TTS: OpenAI MP3 зі stream-usage, Gemini PCM → WAV).
- `config.ts` — вибір провайдера/моделі/голосу з env; за замовчуванням `gpt-6-luna` і
  `gpt-4o-mini-tts`/`alloy` (переможці `docs/ai-compare.md`).
- `enrichment.ts` — схема картки слова (переклади, пояснення, 2–3 приклади з перекладом,
  accepted/synonyms/forms, CEFR, частотність), промпт, валідація відповіді. Приклад зі словом
  ставиться першим — з нього будується cloze.
- `budget.ts` — rate-limit на користувача (константи в одному місці), резерв оцінки перед
  викликом і запис фактичної вартості після; повідомлення «вимкнено до 1-го числа».
- `service.ts` — оркестрація: спільний кеш у `lexicon` (слово оплачується раз на всіх) →
  бюджет → провайдер → облік → кеш. TTS: кліп за sha256(провайдер|модель|голос|текст) у бакеті
  `tts`, генерується раз; перший раз віддається одразу (data URL), облік і завантаження в Storage —
  після відповіді (`after()`). Клієнт заздалегідь готує кліп слова (картка практики, кнопка вимови),
  тож натискання грає миттєво. Без ключа/бюджету — голос пристрою (Web Speech).
- `lib/supabase/admin.ts` — service-role клієнт (потрібен `SUPABASE_SERVICE_ROLE_KEY` і на Vercel).
- `actions/ai.ts` — `enrichWordAction`, `enrichPickedWordsAction` (до 20 слів одним запитом),
  `speechUrlAction`. `lib/memora/text-pick.ts` — токенізація тексту, сусідні тапи → фраза,
  речення-контекст, приглушення слів бібліотеки (з формами).
- UI: `words/add-word-form.tsx` (кнопка «Заповнити» / Enter), `words/ai-extras.tsx`,
  `words/from-text-panel.tsx`; `speech.tsx` → `playEnglish` (хмарний кліп або Web Speech).
- Скрипти порівняння: `scripts/ai-compare.ts`, `scripts/tts-compare.ts` (`npx tsx --env-file=.env.local …`).

## Тести й перевірки
- `pnpm test` — Vitest, чиста логіка й AI-провайдери на моках (111 тестів).
- `pnpm smoke` — Playwright, повний сценарій від імені тестового користувача
  (`pnpm test-user` створює/скидає `memora.e2e@example.com` і засіває 4 слова так, що в
  черзі є по картці кожного типу вправи — smoke проходить усі 4 на телефонному екрані й
  перевіряє, що кнопка оцінки не ховається під нижнім меню). Якщо на сервері налаштовано AI —
  ще «Заповнити з AI» і «З тексту» (слова беруться з кешу, повторні прогони безкоштовні). Env: `MEMORA_SMOKE_URL`,
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
`SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY` — сервер (Vercel + `.env.local`);
необов'язкові: `MEMORA_AI_MONTHLY_LIMIT_USD` (10), `MEMORA_AI_PROVIDER`, `MEMORA_AI_TEXT_MODEL`,
`MEMORA_TTS_PROVIDER`, `MEMORA_TTS_MODEL`, `MEMORA_TTS_VOICE`. Лише локально: `MEMORA_SMOKE_EMAIL/PASSWORD`.

## Відомі обмеження
- Бекапи старої версії (v1) не відновлюються; історії CSV-імпортів більше немає.
- Відновлення бекапу — до 4 МБ (ліміт тіла запиту Vercel 4.5 МБ).
- Константи темпу (`pace.ts`: 12 с на повторення, 45 с на нове слово) — евристика,
  відкалібрувати на реальних `review_logs`.
- Кеш збагачення — за словником (lemma): перший контекст визначає порядок значень для всіх.
  Форма слова («running») не кешується окремо від словникової («run»).
- `lexicon.audio_url` не використовується (аудіо адресується хешем тексту) — кандидат у cleanup.
- Gemini 3.x подорожчає вдвічі з 2027-01-01 (нас не стосується, поки за замовчуванням OpenAI).
