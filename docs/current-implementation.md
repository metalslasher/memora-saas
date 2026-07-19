# Current Implementation Notes

Last updated: 2026-07-19

## What Exists Now

The repository now has a single-user Next.js product build backed by Supabase Auth and PostgreSQL.

Implemented:

- Next.js App Router + TypeScript + Tailwind CSS.
- `ts-fsrs` scheduler adapter with 0.90 desired retention, same-day learning steps, and relearning steps.
- Supabase browser client using `.env.local` publishable credentials.
- Supabase Auth sign-in/sign-up gate.
- Profile workspace with email, English level, learning goal, numeric daily-new-card setting, review-button mode selector, password reset email, password update flow after Supabase recovery links, backup/restore tools, and destructive data cleanup actions.
- Next.js server actions for authenticated learning mutations.
- PostgreSQL schema and migrations under `supabase/migrations`.
- Row level security on all public app tables.
- Remote persistence for profiles, decks, notes, cards, review logs, card/note status changes, note editing, and study settings.
- Idempotent first-login seed guard plus unique `(user_id, module_type)` deck constraint.
- Ukrainian-first starter English and QA notes/cards.
- Ukrainian-first card templates for generated English and QA cards.
- Idempotent starter-content upgrade for existing Supabase seed rows without resetting review schedules.
- Daily queue sorted as reviews first, then new cards.
- Practice queue is the focused daily learning screen: metrics, mode selector, segmented progress, typed attempt, reveal, answer dialog, and self-grade buttons.
- Review interaction: prompt -> typed attempt -> answer dialog -> self-grade -> next card.
- Simple review buttons by default: `Знову`, `Добре`.
- Optional advanced buttons: `Знову`, `Важко`, `Добре`, `Легко`.
- Manual note creation for English and QA in their dedicated content-manager sections.
- New-material success feedback after generated cards are created.
- Generated-card preview before saving new material.
- Duplicate detection with open-existing, merge/update-existing, and create-anyway paths.
- CSV import for English and QA from content manager views, with delimiter detection, row-level validation, duplicate preview, downloadable templates, persistent import history, and server-side duplicate filtering.
- Backup/export from Profile: full JSON backup plus English and QA CSV exports.
- Restore from JSON backup with file validation, preview counts, cancel/confirm flow, and a Supabase RPC that atomically replaces decks, notes, cards, review history, and CSV import history.
- Maintenance RPCs for deleting all materials and resetting learning statistics without touching authentication data.
- Real sidebar navigation for Practice, English words, QA/testing, Progress, Profile, and Help.
- In-app Help workspace with Ukrainian guide copy, learning-loop visualization, section explanations, review-rating guidance, content workflows, profile/data explanations, and a table of contents.
- Ukrainian-first visible product interface.
- Product UI no longer shows MVP/dev/sync labels in the main sidebar.
- English and QA content manager views with note search, note grid, top-level create/import panels, modal note details, editable source fields, generated-card inspection, pause controls, and full material deletion.
- Content manager has empty states for no notes/imports/cards, human-readable statuses, generated-card explanations, and quick field cleanup for note editing.
- Progress workspace with learning dynamics, recent attempts, weak-card review, weak-card-to-note repair flow, and material overview. Long lists scroll inside their panels instead of stretching the page.
- Review logs and basic analytics.
- Card suspension from the study view.
- Dark-only product theme across the full interface.
- Legacy localStorage domain helpers still exist in `src/lib/memora/store.ts` for tests and older local helpers, but the UI uses `src/lib/memora/remote-store.ts`.

## Important Temporary Choices

These are intentionally temporary for the current MVP:

- No multi-user product surface yet; Supabase Auth exists, but the app is still designed for one owner account.
- Browser-side Supabase is still used for Auth; learning mutations now go through server actions and still rely on RLS.
- CSV import uses synchronous server actions for small personal files; larger imports should move to route handlers or background jobs later.
- No curated external seed corpus yet; current seed data is a small hand-authored starter set.
- Supabase migration history in the hosted project has older remote-only timestamps from the initial setup. Avoid a blanket `supabase db push` until migration history is repaired; the atomic restore RPC was applied directly with `supabase db query --linked --file ...`.

## Files To Know

| File | Purpose |
| --- | --- |
| `src/components/memora-app.tsx` | Main client UI and review flow |
| `src/app/actions.ts` | Server actions for authenticated load and learning mutations |
| `src/lib/memora/types.ts` | Domain types |
| `src/lib/memora/action-validation.ts` | Shared validation for server action payloads |
| `src/lib/memora/scheduler.ts` | `ts-fsrs` adapter |
| `src/lib/memora/card-generator.ts` | Shared note-to-card generation helpers for English and QA |
| `src/lib/memora/csv-import.ts` | Shared CSV parsing, header mapping, row validation, duplicate preview, and templates |
| `src/lib/memora/export.ts` | JSON backup and CSV export helpers |
| `src/lib/memora/backup.ts` | JSON backup parsing, validation, preview metadata, and restore-safe normalization |
| `src/lib/memora/language-policy.ts` | Shared Ukrainian-first learning language policy helpers |
| `src/lib/memora/starter-content.ts` | Shared starter notes/cards used by local and Supabase seed flows |
| `src/lib/memora/duplicates.ts` | Shared duplicate detection and lookup normalization helpers |
| `src/lib/memora/seed.ts` | Local starter-state assembly from shared starter content |
| `src/lib/memora/store.ts` | Queue, summary, analytics helpers plus legacy local persistence helpers |
| `src/lib/memora/remote-store.ts` | Supabase persistence, profile mapping, data mapping, note/card update operations, and seed-content upgrades |
| `src/lib/supabase/server.ts` | Supabase server client using Next.js cookies |
| `src/lib/supabase/browser.ts` | Supabase browser client factory |
| `supabase/migrations/*.sql` | PostgreSQL schema, RLS policies, indexes, and defaults |

## Verification

Verified locally:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`
- Supabase linked DB query:
  - `restore_memora_backup(backup_state jsonb)` exists in `public`
  - `authenticated` can execute the restore RPC
  - `clear_memora_materials()` and `reset_memora_learning_stats()` exist in `public`
  - `authenticated` can execute both maintenance RPCs
  - Supabase advisors only report Auth leaked-password protection as disabled
- Earlier Supabase checks:
  - migrations applied: `initial_memora_schema`, `fix_memora_advisors`, `add_auth_uid_defaults`
  - cleanup migration applied: `dedupe_seed_and_unique_decks`
  - schema/security advisors have no RLS/table issues
  - Supabase Auth advisor recommends enabling leaked password protection
  - performance advisors only report expected unused-index info for a new database
  - current first-user seed state: 2 decks, 6 notes, 8 cards, 0 review logs
- Browser check at `http://localhost:3000` with system Chrome:
  - page loads,
  - no Next.js error overlay,
  - no console errors,
  - signed-out auth screen renders,
  - no false `Auth session missing!` banner,
  - desktop and mobile layouts render without horizontal overflow,
  - dark theme renders without white page or panel backgrounds,
  - Next dev indicator disabled for local UI work.
- Browser check in the logged-in Chrome session:
- Practice view renders the focused study flow,
  - English view renders content manager, editable note fields, and generated cards,
  - QA view renders QA note fields and generated cards,
  - Progress view renders learning dynamics, recent attempts, weak cards, and materials,
  - Profile view renders profile settings, security, export, restore, and data cleanup,
  - no browser console errors.
- Automated smoke script:
  - `pnpm smoke` verifies the login screen.
  - with `MEMORA_SMOKE_EMAIL` and `MEMORA_SMOKE_PASSWORD`, it verifies Practice including the answer dialog, Help, Profile, English/QA content views, CSV preview, backup export, restore preview/cancel, weak-card repair entry, mobile navigation, and add/edit/merge English note flow.

## Recommended Next Step

Recommended next hardening:

1. Repair/align Supabase migration history so future migrations can be pushed with `supabase db push` safely.
2. Move larger import/background work to route handlers or jobs when needed.
3. Add a dedicated restore-commit smoke test against a disposable account or disposable backup.
4. Add more focused tests around weak-card repair after repeated failed reviews.
