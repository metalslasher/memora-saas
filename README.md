# Memora SaaS

Memora is a spaced-recall learning service for English vocabulary and QA knowledge. This repository contains a Ukrainian-first, dark-only, mobile-first product build backed by Supabase, plus the product and technical specifications in [`docs`](docs).

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

- Next.js App Router + TypeScript + Tailwind CSS v4 design tokens.
- Supabase Auth + Postgres persistence with RLS; server actions for mutations.
- Public landing with an interactive demo card.
- Mobile-first cabinet: practice, English words, QA terms, progress, profile, help.
- Practice: optional typing with auto-check, FSRS interval preview on grade
  buttons, keyboard shortcuts, pronunciation, optimistic grading, undo,
  daily new-card limit, session summary.
- CSV import/export, JSON backup/restore, PWA manifest.

See [`docs/current-implementation.md`](docs/current-implementation.md) for details.

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
