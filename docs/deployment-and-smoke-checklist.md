# Deployment And Smoke Checklist

Last updated: 2026-07-19

Use this checklist before and after deploying Memora to Vercel.

Production URL:

- https://memora-saas.vercel.app

## Required Environment Variables

Local `.env.local`, `.env.example`, and Vercel project env vars must contain:

| Variable | Where to get it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project settings or API page |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase API keys, publishable/anon key |

Do not expose service-role keys in the browser or `NEXT_PUBLIC_*` variables.

## Supabase Auth URLs

Production configuration:

- Site URL: `https://memora-saas.vercel.app`
- Redirect URLs:
  - `http://localhost:3000`
  - `http://localhost:3000/**`
  - `https://memora-saas.vercel.app`
  - `https://memora-saas.vercel.app/**`

Password reset uses the current app origin, so local and production origins both need to be allowed.

## Pre-Deploy Commands

Run from the project root:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm smoke
```

All commands should pass before deployment.

Supabase note: the hosted project currently has older remote-only migration timestamps from the first setup. Do not run a blanket `supabase db push` until migration history is aligned. The current atomic restore RPC is stored in `supabase/migrations/20260719072833_atomic_restore_backup.sql` and has been applied to the linked database with `supabase db query --linked --file ...`.

`pnpm smoke` checks the login screen by default. To run the authenticated browser flow, provide a test owner account:

```bash
$env:MEMORA_SMOKE_EMAIL="you@example.com"
$env:MEMORA_SMOKE_PASSWORD="your-password"
pnpm smoke
```

By default, the authenticated smoke flow creates, edits, and duplicate-merges one timestamped English note. It also checks CSV preview, JSON export, restore preview/cancel, weak-card repair entry, and mobile navigation. To verify navigation without changing learning data:

```bash
$env:MEMORA_SMOKE_MUTATE="0"
pnpm smoke
```

Use `MEMORA_SMOKE_URL` to test a Vercel preview or production URL instead of `http://localhost:3000`.

Production navigation smoke without changing learning data:

```powershell
$env:MEMORA_SMOKE_URL="https://memora-saas.vercel.app"
$env:MEMORA_SMOKE_EMAIL="owner@example.com"
$env:MEMORA_SMOKE_PASSWORD="owner-password"
$env:MEMORA_SMOKE_MUTATE="0"
pnpm smoke
```

## Manual Browser Smoke Test

Use a clean browser session and the owner account.

1. Open the app locally or on the Vercel preview URL.
2. Sign in.
3. Confirm Practice shows metrics, the mode selector, segmented progress, and the current card.
4. Reveal one card, submit a rating, and confirm the next queue state loads.
5. Add one English note from the English words section and confirm generated cards appear.
6. Add one QA note from the QA/testing section and confirm generated cards appear.
7. Open English and QA content manager views, open a note modal, edit a note field, and save.
8. Import a small CSV preview in English or QA and confirm duplicate preview works.
9. Export JSON backup from Profile.
10. Select the exported JSON backup, confirm the restore preview, and cancel unless intentionally testing restore.
11. If intentionally testing restore, first download a fresh JSON backup, then restore and confirm counts match the preview.
12. Open Profile, update profile/study settings, and confirm the saved state remains after refresh.
13. Sign out and sign back in.

## Verified Production Checks

- Vercel production deploy renders the login screen.
- Supabase Site URL and Redirect URLs are configured for production and local development.
- Owner password reset was tested successfully on production.
- Owner logout and login were tested successfully on production.
- Authenticated production smoke passed with `MEMORA_SMOKE_MUTATE=0`.

## Known Production Follow-Ups

- Align Supabase migration history before relying on `supabase db push` for future migrations.
- Add a destructive restore-commit smoke test only against a disposable account.
- Move large imports to a route handler or background job if personal CSV files become large.
