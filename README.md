# Memora

A web trainer for learning English, built for Ukrainian speakers. Active recall
plus spaced repetition (FSRS). The UI is in Ukrainian; the learning content is
English with Ukrainian translations.

Production: https://memora-saas.vercel.app (Vercel, auto-deploys from `main`).

## Setup

Requires Node 20+ and pnpm 11 (see `packageManager` in `package.json`).

```bash
pnpm install
cp .env.example .env.local   # then fill in the Supabase values
pnpm dev                     # http://localhost:3000
```

`.env.local` needs `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. `SUPABASE_SERVICE_ROLE_KEY` is only
used by `pnpm test-user`. Never commit secrets.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js dev server / production build / serve the build |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | ESLint / TypeScript / Vitest |
| `pnpm test-user` | Create or reset the e2e test user and save its credentials to `.env.local` |
| `pnpm smoke` | Playwright smoke test against a running app (`MEMORA_SMOKE_MUTATE=0` to avoid writes) |

## Docs

- [`CLAUDE.md`](CLAUDE.md) — working rules and conventions for each session
- [`docs/product.md`](docs/product.md) — target product (Ukrainian)
- [`docs/architecture.md`](docs/architecture.md) — current architecture (Ukrainian)
- [`docs/roadmap.md`](docs/roadmap.md) — audit, decisions, batch plan (Ukrainian)
