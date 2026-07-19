# Memora MVP Backlog And Acceptance Criteria

## MVP Goal

Ship a responsive web app where a user can onboard, study English and QA cards with FSRS scheduling, add/import content, and inspect progress.

## Release 0: Project Foundation

Deliverables:

- Next.js + TypeScript application scaffold.
- Database connection and migrations.
- Auth/session foundation.
- Account/profile settings and password recovery foundation.
- Shared validation schemas.
- Basic layout and navigation.
- In-app help/reference screen for onboarding and daily usage.

Acceptance criteria:

- App runs locally.
- User can register/login/logout.
- User can edit profile settings and reset/update password through Supabase Auth.
- Database migrations create core tables.
- Protected routes require auth.
- User can open a Ukrainian help screen that explains the service, daily flow, app sections, review buttons, imports, exports, and profile settings.

## Release 1: Core SRS Engine

Deliverables:

- Note/card/review data model.
- FSRS scheduler integration.
- Review log persistence.
- Queue generation.
- Review submission endpoint.

Acceptance criteria:

- Cards are scheduled by FSRS, not a hardcoded ladder.
- A new card can enter learning and graduate to review.
- A failed review can enter relearning.
- Review logs are immutable and queryable.
- Queue returns due reviews before new cards.

## Release 2: English Vocabulary Module

Deliverables:

- English note schema.
- English card generation.
- English study UI for productive and receptive cards.
- Basic built-in general deck seed.
- Manual English note creation.

Acceptance criteria:

- User can study Ukrainian -> English cards.
- User can study English -> Ukrainian cards.
- Productive translation and cloze cards work.
- User can add, edit, pause, and delete English notes.
- Generated cards stay linked to the source note.

## Release 3: QA Knowledge Module

Deliverables:

- QA note schema.
- QA card generation.
- QA study UI for term, definition, contrast, and scenario cards.
- Basic QA seed deck.
- Manual QA note creation.

Acceptance criteria:

- User can study term -> definition cards.
- User can study definition -> term cards.
- Contrast cards show both concepts after reveal.
- Scenario cards support explanation after reveal.
- QA notes can be tagged by topic and difficulty.

## Release 4: CSV Import

Status: implemented for the personal MVP. Larger background imports remain deferred.

Deliverables:

- CSV upload. Implemented.
- English CSV schema validation. Implemented.
- QA CSV schema validation. Implemented.
- Row-level error reporting. Implemented in preview.
- Import status screen. Implemented as a compact persistent import history in the content manager.

Acceptance criteria:

- User can import valid English notes. Implemented.
- User can import valid QA notes. Implemented.
- Invalid rows do not create partial broken notes. Implemented.
- User can see row number and reason for each validation error. Implemented in preview.
- Import metadata is persisted. Implemented through `imports` / `import_rows` plus imported note source.

## Release 5: Dashboard And Analytics

Deliverables:

- Home queue summary.
- Retention snapshot.
- Review completion metrics.
- Lapse and leech metrics.
- Mature card count.
- Topic accuracy.
- Daily workload minutes.

Acceptance criteria:

- Home shows due reviews, new cards, and estimated minutes.
- Dashboard shows true retention and desired retention.
- Dashboard identifies weak topics.
- Analytics are based on persisted review logs.

## Release 6: Content Repair And Leech Flow

Status: partially implemented for weak-card repair. Full leech marking/recommendations remain deferred.

Deliverables:

- Weak-card detection from lapses/recent failed reviews. Implemented.
- Weak-card list. Implemented in Progress.
- Note repair UI. Implemented through weak-card-to-note editor flow.
- Leech detection. Deferred.
- Edit/suspend/split recommendations. Deferred.

Acceptance criteria:

- User can inspect weak cards from Progress. Implemented.
- User can open the source material from a weak card and edit it. Implemented.
- Repeatedly failed cards are marked as leech. Deferred.
- Leech status is visible but not punitive. Deferred.

## MVP Test Plan

### Unit Tests

- Note schema validation.
- Card generation rules.
- FSRS adapter behavior.
- Review state transitions.
- CSV row validation.
- Analytics metric calculations.

### Integration Tests

- Register/login -> create deck -> create note -> generate cards.
- Fetch queue -> submit review -> due date changes.
- Import CSV -> creates notes/cards.
- Unauthorized user cannot access another user's cards.

### End-To-End Tests

- Onboarding creates first study setup.
- User completes a daily study session.
- User adds an English note and studies generated card.
- User adds a QA note and studies generated card.
- User imports CSV and fixes validation errors.

## Definition Of Done

A feature is done when:

- User-facing flow works in the browser.
- Backend validates inputs and ownership.
- Data persists correctly.
- Error states are visible and recoverable.
- Tests cover the main success path and at least one failure path.
- No answer is exposed before reveal in review UI.
- Documentation is updated if the behavior affects product or technical specs.

## Roadmap After MVP

Next:

- Audio/TTS.
- Typed answer grading.
- Better leech repair UI.
- PWA offline mode.
- Per-user FSRS parameter optimization.

Later:

- AI-assisted note generation with human approval.
- Topic recommendations.
- Study plans.
- Interview mode.
- Mock quiz mode.
- Streaks and accountability features.
