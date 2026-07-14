# Memora Open Questions, Assumptions, And Risks

## Current Assumptions

- Initial user language is Ukrainian.
- Initial target language is English.
- Initial product is web-first.
- The product can use authored cards based on source concepts rather than copying source text verbatim.
- The user wants one app with two modules, not two separate products.
- The first build can prioritize personal-use scale before multi-tenant enterprise scale.

## Product Questions

1. Should onboarding let the user choose only English, only QA, or must both be enabled by default?
2. Should English initially focus more on IT/work vocabulary or general daily vocabulary?
3. What is the desired default daily workload: minutes per day or new cards per day?
4. Should the product support typed answers in MVP, or only self-grading after reveal?
5. Should streaks be included early, or avoided until the learning loop is stable?
6. Should the first QA deck be interview-oriented, ISTQB-oriented, or practical automation-oriented?
7. Should users be able to share decks in the MVP?

## Content Questions

1. Which exact seed vocabulary list will be used first?
2. Who will author and review the first English examples?
3. Which QA source should anchor the first 100 cards?
4. Should QA cards be written in English, Ukrainian, or mixed?
5. How should source attribution be shown to users?
6. Should imported personal cards be private forever by default?

## Technical Questions

1. Which auth provider should be used?
2. Should the backend be implemented inside Next.js route handlers or as a separate Node service?
3. Which ORM/query layer should be used for PostgreSQL?
4. Should Redis be included in MVP or deferred until jobs/queues need it?
5. Should card answers be included in queue payloads or fetched through a reveal endpoint?
6. How much offline support is needed before PWA work begins?
7. Should analytics rollups be synchronous after review submit or async through a job?

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Building generic flashcards instead of a learning system | Product loses its core differentiation | Keep retrieval, feedback, FSRS, and analytics central |
| Bad seed content | Users fail cards because prompts are weak | Add content review rules and leech repair |
| Too much workload | User burns out | Show estimated minutes, backlog warning, and daily limits |
| Incorrect FSRS integration | Review schedule becomes untrustworthy | Isolate scheduler adapter and test transitions heavily |
| Copying source content too directly | Legal/content quality risk | Use sources as curriculum anchors and author original prompts |
| QA deck becomes glossary-only | Poor transfer to interviews/work | Include contrast, scenario, decision, and code/tool cards |
| UI reveals answers too early | Breaks active recall | Treat reveal behavior as a hard acceptance criterion |

## Decisions To Make Before Coding

High priority:

- Choose auth approach.
- Choose DB/ORM stack.
- Choose whether Next.js route handlers are enough for backend MVP.
- Choose exact MVP grading mode: two-button only or two-button plus advanced.
- Choose first seed deck scope.

Medium priority:

- Decide whether Redis is required immediately.
- Decide import file size limits.
- Decide answer reveal API strategy.
- Decide default daily goals.

Low priority:

- Decide streak and gamification strategy.
- Decide social/deck sharing strategy.
- Decide final PWA offline architecture.

