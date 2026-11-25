# Memora — архітектура (поточний стан коду)

Оновлено: 2026-11-25, пачка 6 (своє речення й говоріння). Цільовий продукт описано в
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
| `/app/onboarding` | Онбординг і повторний тест: тест рівня → перевірка значень → результат → цілі → хвилини | `src/app/app/onboarding/page.tsx`, `components/memora/onboarding-flow.tsx` |
| `/app/words`, `/app/words/[id]` | Бібліотека слів, деталі слова | `src/app/app/words/*`, `components/memora/words/*` |
| `/app/progress` | Прогрес | `components/memora/progress-view.tsx` |
| `/app/settings` | Профіль і налаштування, бекап, небезпечна зона | `components/memora/settings-workspace.tsx` |
| `/app/help` | Довідка | `components/memora/help-view.tsx` |
| `/app/share` | Прийом «Поділитися → Memora» (Web Share Target, GET і POST): слово/фраза (≤ 4 слова, ≤ 60 символів, без знаків речення) → `/app/words?add=…`, довший текст → `/app/words?text=…` (до 3000 символів), лише посилання → `?shared=link`. Правила — `lib/memora/share.ts` | `src/app/app/share/route.ts` |
| `/manifest.webmanifest` | Маніфест PWA: `start_url /app`, standalone, іконки PNG 192/512 (any + maskable), `share_target`, ярлик «Додати слово» | `src/app/manifest.ts` |
| `/pwa/*.png` | Іконки маніфесту, рендеряться під час білду (`lib/memora/app-icon.tsx`, той самий малюнок — `apple-icon`) | `src/app/pwa/[icon]/route.tsx` |
| `/sw.js` | Мінімальний service worker без кешу (офлайн — «пізніше»); сюди пачка 7 додасть `push`/`notificationclick` | `public/sw.js` |
| `/beta` | «Закрита бета» для акаунтів поза allowlist | `components/memora/beta-screen.tsx` |

`src/app/app/layout.tsx` + `components/memora/app-shell.tsx` — спільна оболонка
(сайдбар на десктопі ≥ 1024 px; на телефоні й планшеті — верхня панель з назвою розділу + нижні 4 вкладки, тости).
На телефоні назва розділу лише у верхній панелі: `PageHeader` ховає h1 візуально (`max-lg:sr-only`), опис лишається.
Серія у верхній панелі й сайдбарі показується лише з 1 дня. `components/memora/pwa.ts` — реєстрація service worker
(лише production) і `useInstallPrompt` (подія `beforeinstallprompt`): кнопка «Встановити» у верхній панелі
(зникає на 30 днів після «Ні») і блок «Memora на телефоні» в Профілі.

## Доступ і безпека (три рівні)
1. `src/proxy.ts` — оновлює сесійну cookie; гостей з `/app/*` веде на `/?next=<шлях>` (лендінг одразу
   відкриває вхід і після нього повертає на `next`, лише шляхи `/app…` — `safeNextPath`); акаунти
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
| `profiles` | `daily_minutes`, `speaking_enabled` (перемикач «Говоріння»), `goals` (general/work/travel/talk), `level_estimate` (результат тесту рівня, jsonb), `onboarded_at` (онбординг пройдено — лише тоді працює автоподача), `known_rank`/`program_rank` (позиція програми), `calibrated_at`, `timezone` |
| `lexicon` | Спільний словник: частотні списки (`frequency_rank` — ранг у загальній частотності NGSL 31K, `source_list` — перший список слова, `part_of_speech` = '' — ключ кешу) + AI-контент. Читають усі з allowlist, пише лише service role |
| `lexicon_lists` | Належність слова до списку програми з рангом у ньому: `ngsl`, `ngsl_spoken`, `bsl`, `theme_work`, `theme_travel`, `theme_talk` (одне слово може бути в кількох) |
| `user_words` | Слово в бібліотеці: `lemma`, `source` (program/manual/text/import), `status`, `content` jsonb, `lexicon_id`, `assumed_known` (тест зарахував як знайоме → стартує з recall) |
| `cards` | Картка = слово × `kind` (recognition, recall, cloze, listening, sentence, speaking) + FSRS-поля. Створюються ліниво: нове слово — лише recognition, решта відкривається (`exercise-unlock.ts`). Текст картки не зберігається |
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

Міграція `20261124100000_program_onboarding` (додавальна): колонки профілю й `assumed_known`, `lexicon_lists`,
нове слово = слово без жодного повторення (а не «recognition з reps 0»; для старих даних те саме, а слова з recall
першою карткою теж рахуються новими), свої слова в черзі нових — перед програмними; `get_program_candidates`
(наступні слова списку, яких нема в бібліотеці), `get_program_calibration` (перші повторення програмних слів),
фічі `ai_usage`: `program`, `program_build`.

Міграція `20261125100000_writing_speaking` (додавальна): `profiles.speaking_enabled` (за замовчуванням true),
фічі `ai_usage`: `sentence`, `speak`, `transcribe`. Види карток `sentence`/`speaking` були в enum з baseline;
код `main` до пачки 6 показує їх як «згадати», тож нові картки його не ламають.

Типи БД генеруються: `supabase gen types typescript --linked > src/lib/supabase/database.types.ts`.

## Шар коду
- `lib/memora/data/*` — читання/запис по фічах (words, practice, progress, profile, backup).
- `lib/memora/actions/*` — server actions (`"use server"`): words, practice
  (`gradeCardAction`, `undoReviewAction`, …), account. Повертають лише змінене.
- `lib/memora/card-render.ts` — текст картки (питання/відповідь) з `content` + `kind`;
  `cloze.ts` — речення з пропуском із прикладу слова.
- `lib/memora/exercise-unlock.ts` — поступове відкриття вправ (recognition → recall →
  cloze/listening → sentence, коли recall у Review з інтервалом ≥ 7 днів → speaking після sentence у Review).
- `lib/memora/production.ts` — «Своє речення» / «Скажи вголос» (чиста логіка): денна квота з хвилин на день,
  відбір карток у межах квоти, оцінка з фідбеку (wrong → Again, помилки → Hard, інакше Good; Easy — ніколи),
  «слово розпізнано» в транскрипті (словоформи), ідеї для речення (без AI).
- `lib/memora/data/production.ts` — скільки таких вправ ще можна сьогодні (квота мінус `ai_usage` за 24 год;
  0, якщо AI вимкнений чи бюджет вичерпано; говоріння — 0, якщо вимкнене). Викликається з `getPracticeSession`.
- `lib/memora/actions/production.ts` — `checkSentenceAction`, `checkSpeechAction` (FormData з аудіо, ≤ 900 КБ):
  слово береться з БД за карткою, ліміт/бюджет повертається як `status: "blocked"` з повідомленням.
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
- `lib/memora/vocab-test.ts` — тест рівня (чиста логіка): адаптивні блоки по тисячах, псевдослова, перевірка
  значень, формула оцінки (коментар у файлі), повторне оцінювання на сервері з відповідей (`rebuildTest`).
  `vocab-test-pool.ts` — пул слів (10 діапазонів, згенеровано `scripts/build-program.ts`, вичитано вручну).
- `lib/memora/program.ts` — правила програми: стартова позиція, скільки слів доливати (`feedNeed`), відбір
  (`planFeed`: ⅓ з цілей, решта NGSL), «знайоме» слово, калібрування за першими повтореннями.
- `lib/memora/data/program.ts` — `runDailyFeed`: калібрування → кандидати (RPC) → AI-заповнення лише відсутніх
  у `lexicon` (фіча `program`) → вставка слів; після відповіді (`after()`) готує слова на завтра.
  Викликається на `/app` (лише після онбордингу) і в кінці онбордингу (`actions/program.ts`).
- `components/memora/practice/use-practice-session.ts` — стан сесії: оптимістична
  оцінка, черга записів на сервер (оцінки й undo йдуть строго по черзі), undo, таймер сесії.
- `components/memora/practice/study-card.tsx` — картка вправи, автооцінка, панель leech.
- `components/memora/practice/production-card.tsx` — картка «Своє речення» / «Скажи вголос»: поле або запис
  (MediaRecorder, Opus 32 кбіт/с, ≤ 15 с), фідбек, оцінка з можливістю змінити; без мікрофона/AI — пояснення й
  «Далі без цієї вправи» (ховає такі картки до кінця сесії). Без MediaRecorder «вголос» не подається.
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
- `feedback.ts` — схема й промпт фідбеку на речення (носій-американець, без чіпляння до стилю, пояснення
  живою українською без родових форм; для транскрипту — ігнорувати пунктуацію й слова-паразити), валідація;
  промпт транскрипції («записуй дослівно з помилками», цільове слово навмисно не передається).
- `production-service.ts` — фідбек (`sentence`/`speak`) і транскрипція (`transcribe`, OpenAI `gpt-transcribe`,
  оплата похвилинно або токенами, якщо модель їх повертає) через бюджет/облік; аудіо не зберігається.
- `lib/supabase/admin.ts` — service-role клієнт (потрібен `SUPABASE_SERVICE_ROLE_KEY` і на Vercel).
- `actions/ai.ts` — `enrichWordAction`, `enrichPickedWordsAction` (до 20 слів одним запитом),
  `speechUrlAction`. `lib/memora/text-pick.ts` — токенізація тексту, сусідні тапи → фраза,
  речення-контекст, приглушення слів бібліотеки (з формами).
- UI: `words/add-word-form.tsx` (кнопка «Заповнити» / Enter), `words/ai-extras.tsx`,
  `words/from-text-panel.tsx`; `speech.tsx` → `playEnglish` (хмарний кліп або Web Speech).
- Скрипти порівняння: `scripts/ai-compare.ts`, `scripts/tts-compare.ts` (`npx tsx --env-file=.env.local …`).
- Програма: `data/lexicon/` (списки NGSL з атрибуцією, тематичні добірки), `scripts/build-program.ts`
  (разова генерація добірок і пулу тесту, фіча `program_build`), `scripts/import-lexicon.ts` (ідемпотентний
  імпорт у `lexicon` + `lexicon_lists`; після зміни файлів у `data/lexicon` — запустити ще раз).

## Тести й перевірки
- `pnpm test` — Vitest, чиста логіка й AI-провайдери на моках (168 тестів).
- `pnpm smoke` — Playwright, повний сценарій від імені тестового користувача
  (`pnpm test-user` створює/скидає `memora.e2e@example.com`, скидає онбординг і засіває 6 слів так, що в
  черзі є по картці кожного типу вправи — smoke проходить усі 6 на телефонному екрані (своє речення й «вголос» —
  з реальним AI, ≈ $0.0007 за прогін; мікрофон — фейковий пристрій Chromium, на Windows він «говорить» речення
  системним голосом SAPI; відмова мікрофона — підміною `getUserMedia`; `MEMORA_SMOKE_AI=0` — сервер без AI) і
  перевіряє, що кнопка оцінки не ховається під нижнім меню). Також: маніфест, іконки, `/sw.js`, share target
  (GET і POST, гість → вхід → повернення на «Додати слово»), installability через DevTools
  (`Page.getInstallabilityErrors`; `in-incognito` ігнорується — контексти Playwright анонімні).
  Знімки (`MEMORA_SMOKE_SHOTS`) — 375, 768 і 1440. Перед практикою smoke проходить онбординг
  (пропозиція тесту → тест як учень із 4 000 слів → перевірка значень → цілі → хвилини) і перевіряє, що
  автоподача поставила в практику 6 нових слів. Якщо на сервері налаштовано AI —
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
`MEMORA_TTS_PROVIDER`, `MEMORA_TTS_MODEL`, `MEMORA_TTS_VOICE`, `MEMORA_TRANSCRIBE_MODEL` (`gpt-transcribe`). Лише локально: `MEMORA_SMOKE_EMAIL/PASSWORD`.

## Відомі обмеження
- Lighthouse mobile `/app` (локальний prod-білд, 2026-11-24): доступність 100, кращі практики 100, швидкість 73
  (LCP 7,1 с під емуляцією повільного 4G/CPU ×4; відповідь сервера ~0,9 с — запити до Supabase; ~430 КБ
  невикористаного JS) — оптимізація в пачці 9.
- Share target приймає лише текст і посилання (без файлів); сторінку за посиланням Memora не завантажує.
- Бекапи старої версії (v1) не відновлюються; історії CSV-імпортів більше немає.
- Відновлення бекапу — до 4 МБ (ліміт тіла запиту Vercel 4.5 МБ).
- Константи темпу (`pace.ts`: 12 с на повторення, 45 с на нове слово) — евристика,
  відкалібрувати на реальних `review_logs`.
- Кеш збагачення — за словником (lemma): перший контекст визначає порядок значень для всіх.
  Форма слова («running») не кешується окремо від словникової («run»).
- Програма дає слова лише з NGSL (2 809), NGSL-Spoken, BSL і тематичних добірок; для рівня вище ~4–5 тис.
  слів NGSL — уже активна практика знайомих слів (поглиблення списками 3k+ — пізніше).
- Константи калібрування й частка ⅓ тематичних слів — експеримент (`program.ts`).
- `lexicon.audio_url` не використовується (аудіо адресується хешем тексту) — кандидат у cleanup.
- Квота письма/говоріння (`dailyProductionQuota`) і поріг відкриття (7 днів) — евристика; «слово розпізнано» —
  лише проксі вимови (експеримент), не оцінка вимови.
- `pnpm test-user` відв'язує (`user_id → null`) записи `ai_usage` тестового акаунта для письма/говоріння,
  щоб звільнити денну квоту; гроші лишаються в місяці.
- Gemini 3.x подорожчає вдвічі з 2027-01-01 (нас не стосується, поки за замовчуванням OpenAI).
