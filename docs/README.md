# Memora Documentation Index

This folder is the working specification pack for Memora. It distills the attached PDF into development-ready documents and adds implementation notes so future work can start quickly without re-reading the full source document.

Source PDF:

- `C:\Users\Oleg\Documents\Memora\Technical specification for a spaced recall learning service for English vocabulary and QA automatio.pdf`

## How To Use These Specs

Start here when building or changing the product:

1. Read [product-spec.md](product-spec.md) to understand what Memora is and what the user experience should do.
2. Read [learning-and-content-spec.md](learning-and-content-spec.md) before touching scheduling, cards, decks, review flows, or learning content.
3. Read [technical-spec.md](technical-spec.md) before designing database tables, services, APIs, jobs, auth, or deployment.
4. Read [mvp-backlog.md](mvp-backlog.md) when choosing the next implementation task.
5. Read [open-questions.md](open-questions.md) before making irreversible product or architecture decisions.
6. Read [current-implementation.md](current-implementation.md) to see what already exists in the local MVP.
7. Read [deployment-and-smoke-checklist.md](deployment-and-smoke-checklist.md) before Vercel deploys or production-like testing.

## Locked Product Decisions

These decisions are considered stable unless the user explicitly changes direction:

| Area | Decision |
| --- | --- |
| Product type | Evidence-based spaced-recall learning service, not a generic flashcard CRUD app |
| Initial modules | English vocabulary and QA knowledge |
| English support language | Ukrainian |
| English target language | English |
| Core learning loop | Prompt -> user attempt -> reveal -> feedback -> self-grade -> schedule |
| Scheduler | FSRS via a TypeScript-compatible implementation, preferably `ts-fsrs` |
| Default desired retention | 0.90 |
| Default study order | Due reviews first, then new cards |
| Default grading UI | Two-button mode: `Again` and `Good` |
| Advanced grading UI | Optional four-button mode: `Again`, `Hard`, `Good`, `Easy` |
| MVP platform | Responsive web app first |
| Later platform | PWA/offline support after core web MVP |
| Stack preference | Next.js, React, TypeScript, Node.js, PostgreSQL, Redis |

## Product In One Sentence

Memora helps Ukrainian-speaking learners build practical English vocabulary and QA automation knowledge through active recall, corrective feedback, and adaptive spaced repetition.

## Non-Negotiable Learning Principles

Every implementation decision should protect these principles:

- A review must require a real retrieval attempt before showing the answer.
- Feedback must be visible after reveal: correct answer, concise explanation, and ideally one example or contrast.
- Reviews must be scheduled over time; fixed one-session drilling is not enough.
- English vocabulary needs both receptive and productive practice.
- QA knowledge needs definition, contrast, scenario, decision, and tool/code cards, not only glossary cards.
- Notes and cards must be separate domain objects because one note can generate multiple card types.
- Repeated lapses usually mean the note/card needs rewriting, splitting, or more context.
