# Current Implementation Notes

Last updated: 2026-10-09

## What Exists Now

A single-user Next.js product backed by Supabase Auth and PostgreSQL, with a
Ukrainian-first, dark-only, mobile-first interface.

### Public landing (signed-out)

- Hero with an **interactive demo card** (type → check → grade) that runs the
  real answer checker, no account needed.
- Forgetting-curve illustration, how-it-works steps, English/QA directions,
  feature grid, FAQ, final CTA.
- Auth as a bottom sheet on phones / dialog on desktop: sign-in, sign-up,
  password reset ("Забули пароль?"), show/hide password, Supabase errors
  translated to Ukrainian.

### Learning cabinet (signed-in)

- **Shell**: collapsible desktop sidebar (state remembered in localStorage),
  mobile top bar with streak chip + help, mobile bottom tab bar
  (Практика / Слова / QA / Прогрес / Профіль), toast notifications with
  optional action (e.g. undo pause).
- **Practice**
  - Greeting header, due/new counts, ≈ minutes; mode switch (Усе / Англійська / QA)
    with per-mode counts. The English mode now includes *all* English cards.
  - Card with module/stage badges, edit and pause shortcuts.
  - Typing is optional. Typed answers are auto-checked (`answer-check.ts`):
    case, punctuation, leading articles, comma/slash alternatives and small
    typos are forgiven; long QA explanations are left for self-judgement.
  - Inline animated reveal, English pronunciation via Web Speech API.
  - Grade buttons show the next interval (FSRS preview) and highlight the
    suggested grade. Simple mode: «Не згадав / Згадав»; advanced adds
    «Важко / Легко».
  - Keyboard: Enter / Space reveal, 1–4 grade, Z undo.
  - **Optimistic grading**: the next card appears instantly; server writes run
    in an ordered background chain (`gradeCardAction`) that touches only the
    graded card. Errors resync state and show a toast.
  - **Undo last grade** (`undoReviewAction`) restores `schedule_before` and
    deletes the review log.
  - **Daily new-card limit is enforced** (`dailyNewLimit`, counting cards first
    reviewed today). After a session the learner can pull "Ще 5 нових".
  - Session summary (cards, % recalled, time, streak, next due) and
    "all done" / "first material" empty states.
  - The due queue is re-evaluated every minute so learning steps reappear.
- **Words / QA terms**: list-first layout with search and filters
  (Усі / В навчанні / На паузі / Складні), progress indicator per note.
  Add, CSV import (drag & drop, template, preview, history) and note details
  open as dialogs. Adding keeps the dialog open for fast batch entry.
- **Progress**: KPIs (streak, week reviews, 30-day recall, mature cards),
  18-week activity heatmap, 7-day review forecast, memory stages
  (new → learning → young → mature), weak cards with edit shortcut, recent answers.
- **Profile**: new-cards-per-day stepper with presets, 2/4-button mode,
  English level, goal; password change; JSON/CSV export, restore with preview
  and confirmation, danger zone (reset stats / delete all). Sign-out and help
  are reachable here on phones.
- **Help**: compact accordion guide incl. ratings table, keyboard shortcuts
  and "add to home screen" instructions.
- **PWA basics**: `manifest.webmanifest`, generated `apple-icon`, theme colour,
  safe-area insets.

### Backend

- Next.js server actions for all mutations, Supabase RLS on every table.
- FSRS via `ts-fsrs` (0.90 retention, learning steps 10m/30m, relearning 10m/1d).
- Starter-content upgrade runs only on the initial state load, not on every
  mutation.
- Paused/archived cards store their status in `cards.state`; the mapper now
  derives the FSRS state from `reps`, so a paused new card returns as *New*
  instead of a broken *Review* card.

## Design System

Tokens live in `src/app/globals.css` (`--ink`, `--surface-1..4`, `--line`,
`--text`, `--muted`, `--accent`, `--violet`, `--amber`, `--danger`, …) and are
exposed to Tailwind as `bg-surface-2`, `text-muted`, `border-line`, etc.
Shared primitives are in `src/components/memora/shared-ui.tsx`
(`Button`, `Dialog`, `SegmentedControl`, `Toast`, `PageHeader`, fields).
Font: Geist + Geist Mono (Latin + Cyrillic) via `next/font`.
Brand mark: `src/components/memora/brand.tsx` and `src/app/icon.svg`.

## Files To Know

| File | Purpose |
| --- | --- |
| `src/components/memora-app.tsx` | Auth/state orchestration, optimistic review + undo, routing between views |
| `src/components/memora/practice.tsx` | Practice screen, card, grading, session summary |
| `src/components/memora/layout.tsx` | Sidebar, mobile top bar, bottom tab bar, streak widgets |
| `src/components/memora/landing-page.tsx` | Public landing with demo card |
| `src/components/memora/content-manager.tsx` | Words/QA list, add/import/detail dialogs |
| `src/components/memora/analytics-workspace.tsx` | Progress charts |
| `src/components/memora/speech.tsx` | Pronunciation (Web Speech API) |
| `src/app/actions.ts` | Server actions (incl. `gradeCardAction`, `undoReviewAction`, `pauseCardAction`) |
| `src/lib/memora/store.ts` | Queue (daily new limit, modes), summary, next-due helpers |
| `src/lib/memora/answer-check.ts` | Typed-answer comparison |
| `src/lib/memora/scheduler.ts` | `ts-fsrs` adapter + interval preview/formatting |
| `src/lib/memora/remote-store.ts` | Supabase persistence and mapping |

## Important Temporary Choices

- One owner account; no multi-user product surface yet.
- Full-state server actions are still used for note/CSV/restore mutations;
  only grading, undo and pause use the lightweight path.
- CSV import is synchronous (≤ 200 rows, ≤ 1 MB).
- Supabase migration history has remote-only timestamps; avoid a blanket
  `supabase db push` until it is repaired. This release needed **no** migration.

## Verification

- `pnpm lint`, `pnpm typecheck`, `pnpm test` (43 tests), `pnpm build` — pass.
- `pnpm smoke` (signed-out): landing, demo card, sign-in dialog — pass.
- Authenticated smoke needs `MEMORA_SMOKE_EMAIL` / `MEMORA_SMOKE_PASSWORD`
  (selectors updated for the new UI).
- Visual check at 1024px and 375px of landing, practice, words, note dialog,
  progress, profile; no horizontal overflow.

## Recommended Next Steps

1. Run the authenticated smoke against a test account.
2. Move note/CSV mutations to lightweight responses like grading.
3. Daily reminder (web push) once the PWA is installed.
4. Repair Supabase migration history.
