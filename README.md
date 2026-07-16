# Memora SaaS

Memora is a spaced-recall learning service for English vocabulary and QA knowledge. This repository currently contains a Ukrainian-first, dark-only single-user product build backed by Supabase, plus the product and technical specifications in [`docs`](docs).

## Production

Production app:

- https://memora-saas.vercel.app

The production deployment is connected to GitHub through Vercel. Pushes to `main` trigger a Vercel deployment.

## Getting Started

Install dependencies and run the development server:

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

The app expects `.env.local` to contain the variables listed in `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

## Current Scope

- Next.js + TypeScript App Router scaffold.
- Supabase Auth + Postgres persistence with RLS.
- Account/profile settings and Supabase Auth password reset/update flow.
- Next.js server actions for authenticated learning mutations.
- Ukrainian-first starter English and QA cards.
- CSV import for English and QA with preview, row validation, duplicate handling, templates, and persistent import history.
- JSON backup plus English/QA CSV exports.
- FSRS scheduling through `ts-fsrs`.
- Ukrainian-first interface, daily queue, review attempt/reveal/grading loop, quick note creation with generated-card preview and duplicate warnings, content manager views, note/card status controls, settings persistence, in-app help guide, and basic analytics.

## Useful Commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm smoke
```

Production smoke without changing learning data:

```powershell
$env:MEMORA_SMOKE_URL="https://memora-saas.vercel.app"
$env:MEMORA_SMOKE_MUTATE="0"
pnpm smoke
```

## Specs

Start with [`docs/README.md`](docs/README.md), then follow the product, learning/content, technical, and MVP backlog documents from there.

## Deployment

Memora is deployed on Vercel and backed by Supabase Auth/Postgres. Browser-side Supabase is used for Auth, while learning mutations go through server actions with Supabase RLS.
