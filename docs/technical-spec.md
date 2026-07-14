# Memora Technical Specification

## Architecture Summary

Recommended stack:

| Layer | Choice |
| --- | --- |
| Frontend | Next.js + React + TypeScript |
| Backend | Node.js + TypeScript |
| API | REST for MVP |
| Database | PostgreSQL |
| Cache/queue | Redis |
| Scheduler | `ts-fsrs` |
| Auth | Standard session/JWT auth provider |
| Media storage | S3-compatible object storage |
| Observability | OpenTelemetry-compatible logs and metrics |
| Mobile strategy | Responsive web first, PWA later |

TypeScript end-to-end is preferred because it simplifies shared validation schemas, scheduler integration, and Codex-assisted development.

Current MVP note: the Supabase-backed version uses the browser Supabase client for Auth and Next.js server actions for authenticated learning mutations, profile settings, note editing, and CSV import. RLS remains the database ownership boundary.
Account settings are stored in `profiles`; password reset and password update are handled through Supabase Auth.
CSV import history is stored in `imports` and `import_rows`; backup/export is generated from the authenticated in-app state.

## Suggested Application Boundaries

Frontend:

- Onboarding.
- Dashboard/home queue.
- Study review UI.
- Note editor.
- Import UI.
- Analytics views.
- Deck/settings management.

Backend:

- Auth/session integration.
- Note and card generation.
- Study queue generation.
- Review submission and scheduling.
- CSV import processing.
- Analytics aggregation.
- Media metadata handling.

Background jobs:

- CSV import processing.
- Daily analytics rollups.
- Optional future reminders.
- Optional future FSRS parameter optimization.

## Domain Model

Core entities:

| Entity | Key Fields |
| --- | --- |
| `users` | `id`, `email`, `locale`, `timezone`, `level`, `goals` |
| `decks` | `id`, `user_id`, `module_type`, `title`, `settings` |
| `notes` | `id`, `deck_id`, `note_type`, `source`, `content_json`, `status` |
| `cards` | `id`, `note_id`, `card_type`, `state`, `due_at`, `stability`, `difficulty`, `retrievability` |
| `review_logs` | `id`, `card_id`, `reviewed_at`, `rating`, `elapsed_ms`, `was_correct` |
| `tags` | `id`, `label`, `parent_id` |
| `note_tags` | `note_id`, `tag_id` |
| `imports` | `id`, `user_id`, `file_name`, `status`, `row_count` |
| `import_rows` | `id`, `import_id`, `row_number`, `status`, `error_json`, `raw_json` |
| `media` | `id`, `note_id`, `kind`, `url` |
| `analytics_daily` | `user_id`, `date`, `reviews_done`, `new_done`, `retention`, `minutes` |

Design rules:

- Separate notes from cards.
- Store type-specific note fields in `content_json` for MVP speed, but validate with strict schemas.
- Persist review logs immutably.
- Store scheduler fields on cards for fast queue lookup.
- Keep user timezone on the user profile because due-day logic depends on it.

## Suggested PostgreSQL Shape

Use enums or constrained text for these values:

- `module_type`: `english`, `qa`
- `note_type`: `english_vocab`, `qa_concept`
- `card_state`: `new`, `learning`, `review`, `relearning`, `suspended`, `leech`, `archived`
- `review_rating`: `again`, `hard`, `good`, `easy`
- `note_status`: `active`, `suspended`, `archived`
- `import_status`: `uploaded`, `validating`, `ready`, `processing`, `completed`, `failed`

Useful indexes:

- `cards(due_at, state)`
- `cards(note_id)`
- `notes(deck_id, status)`
- `decks(user_id, module_type)`
- `review_logs(card_id, reviewed_at)`
- `analytics_daily(user_id, date)`
- `note_tags(tag_id, note_id)`

## API Surface

MVP REST endpoints:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/auth/register` | Create account |
| `POST` | `/auth/login` | Login |
| `GET` | `/study/queue` | Fetch today's queue |
| `POST` | `/study/review` | Submit rating and update schedule |
| `POST` | `/notes` | Create note |
| `GET` | `/notes/:id` | Get note details |
| `PATCH` | `/notes/:id` | Edit note |
| `POST` | `/notes/:id/suspend` | Suspend note or generated cards |
| `POST` | `/imports/csv` | Upload/import deck rows |
| `GET` | `/imports/:id` | Inspect import status and row errors |
| `GET` | `/decks` | List user decks |
| `POST` | `/decks` | Create deck |
| `PATCH` | `/decks/:id/settings` | Change retention, limits, and mode |
| `GET` | `/analytics/overview` | Dashboard metrics |
| `GET` | `/analytics/topic/:tag` | Topic-specific stats |

## Review Queue Contract

`GET /study/queue` should return:

```json
{
  "date": "2026-07-12",
  "timezone": "Europe/Kiev",
  "mode": "daily",
  "summary": {
    "dueReviews": 42,
    "newAvailable": 10,
    "estimatedMinutes": 18,
    "desiredRetention": 0.9,
    "trueRetention": 0.88,
    "backlogWarning": false
  },
  "cards": [
    {
      "cardId": "uuid",
      "noteId": "uuid",
      "moduleType": "english",
      "cardType": "productive_translation",
      "state": "review",
      "prompt": {
        "text": "помилка у програмі",
        "language": "uk"
      },
      "answer": {
        "text": "bug",
        "language": "en",
        "example": "I found a bug in the checkout flow."
      }
    }
  ]
}
```

Implementation note: the answer can be sent in the payload if the client enforces reveal correctly, but for stronger integrity the API may provide a separate reveal endpoint later. MVP can keep it simple.

## Review Submission Contract

`POST /study/review` request:

```json
{
  "cardId": "uuid",
  "rating": "again",
  "responseText": "optional raw typed answer",
  "elapsedMs": 8420,
  "reviewedAt": "2026-07-12T10:15:00Z"
}
```

Backend steps:

1. Authenticate user.
2. Validate card ownership.
3. Validate card state and rating.
4. Write immutable review log.
5. Run FSRS transition.
6. Persist new card state and scheduling fields.
7. Update or enqueue analytics aggregation.
8. Return next due time and updated card snapshot.

Response:

```json
{
  "cardId": "uuid",
  "state": "review",
  "dueAt": "2026-07-15T08:00:00Z",
  "stability": 2.71,
  "difficulty": 5.32,
  "retrievability": 0.9,
  "mastery": {
    "card": "learning",
    "note": "mixed",
    "topic": "needs_attention"
  }
}
```

## Note Creation Contract

`POST /notes` request:

```json
{
  "deckId": "uuid",
  "noteType": "english_vocab",
  "content": {
    "lemma_en": "bug",
    "translation_uk": "помилка у програмі",
    "part_of_speech": "noun",
    "example_en": "I found a bug in the checkout flow.",
    "topic_tags": ["QA", "work"]
  },
  "generateCards": true
}
```

Backend steps:

1. Validate content against note-type schema.
2. Create note.
3. Attach tags.
4. Generate default cards for the note type and deck settings.
5. Return note and generated cards.

## Card Generation Rules

English vocabulary:

- Always generate productive translation.
- Generate receptive translation unless deck settings disable it.
- Generate cloze card when `example_en` contains the lemma or phrase.
- Generate collocation card when collocations exist.
- Do not generate listening recall until audio/TTS is implemented.

QA:

- Always generate term -> definition.
- Generate definition -> term when the term is distinctive.
- Generate acronym card when `expansion` exists.
- Generate contrast card when `counterexample` or paired concept exists.
- Generate scenario card when `example` is scenario-like.
- Generate code/tool card when `code_snippet` exists.

## Frontend Screens

MVP screens:

- Auth/register/login.
- Onboarding.
- Home/today queue.
- Study review.
- Session summary.
- Deck list.
- Note list.
- Note editor.
- CSV import.
- Analytics overview.
- Deck settings.

Study UI state:

- `prompt`
- `attempting`
- `revealed`
- `submitting`
- `scheduled`
- `error`

The UI must avoid showing the answer before reveal.

## Security And Data Safety

MVP requirements:

- User can only access own decks, notes, cards, logs, imports, and analytics.
- Review logs are append-only from the application perspective.
- CSV uploads must be validated and size-limited.
- Backup/export must only include the authenticated user's loaded state.
- Escape or sanitize user-provided examples and snippets before rendering.
- Use parameterized queries or ORM-safe methods.
- Do not trust client-provided `wasCorrect`; derive it from rating or grading mode.

## Performance Expectations

Personal-use MVP targets:

- `GET /study/queue`: under 300 ms for normal personal decks.
- `POST /study/review`: under 200 ms excluding cold starts.
- CSV import: synchronous server actions for small personal files; move to route handlers or jobs for larger imports.
- Export: generated client-side from already authorized state for personal-sized data.
- Dashboard: use rollups for daily metrics instead of recomputing all logs every time.

## Observability

Log structured events for:

- User onboarding completion.
- Queue fetch.
- Review submit.
- Scheduling errors.
- CSV import validation errors.
- Note generation errors.
- Analytics rollup jobs.

Metrics:

- Queue fetch latency.
- Review submit latency.
- Review submit error rate.
- Import failure rate.
- Cards due per user distribution.
- Average daily reviews completed.
