# Memora Product Specification

## Product Vision

Memora is a spaced-recall learning service for two practical learning goals:

- English vocabulary for daily life, IT, work, meetings, and professional communication.
- QA and QA automation knowledge for interviews, study, and real work.

The product should feel like a focused daily study tool. The main value is not that cards exist, but that the system makes the learner retrieve, get feedback, and return at the right time.

## Target Users

Primary initial user:

- Ukrainian-speaking learner.
- Wants to improve English for work and daily use.
- Wants to learn or strengthen QA automation concepts.
- Benefits from clear structure, daily queue discipline, and practical examples.

Secondary future users:

- Other English learners with a different support language.
- QA learners preparing for interviews.
- Manual QA specialists moving into automation.
- Developers or product people learning testing terminology.

## Product Modules

### English Vocabulary

Purpose: build active English recall, not only recognition.

Initial tracks:

| Track | Purpose | Default Study Style |
| --- | --- | --- |
| General | Daily life, conversation, common verbs, adjectives, nouns, and collocations | Balanced receptive and productive |
| IT and Work English | Technical workplace vocabulary, QA/dev language, meetings, Jira, Git, bugs, releases, deployments | Productive-first after onboarding |

The first release should be Ukrainian -> English and English -> Ukrainian. Productive recall is required because workplace fluency depends on producing the word or phrase in context.

### QA Knowledge

Purpose: teach testing terminology and applied QA reasoning through spaced retrieval.

Initial subdomains:

| Subdomain | Initial Scope |
| --- | --- |
| Testing fundamentals | error, defect, failure, verification, validation, QA, QC, debugging |
| Process and SDLC | test levels, test types, shift left, traceability, risk, entry/exit criteria |
| Test design | equivalence partitioning, boundary value analysis, decision tables, state transitions, branch testing, exploratory testing |
| Agile and collaboration | user story, acceptance criteria, BDD, ATDD |
| Web and API basics | HTTP methods, status codes, cookies, auth, JSON, REST basics |
| UI automation | locators, waits, assertions, retries, flakiness |
| Tooling | Selenium, Playwright, Git basics, CI basics, test reports |
| Security awareness | common web security testing concepts and OWASP basics |

The QA module should use ISTQB CTFL as the foundation and official docs for practical automation topics: Playwright, Selenium, MDN, and OWASP.

## Core User Experience

The home screen should revolve around today's study queue. Browsing decks is secondary.

Home screen should show:

- Reviews due today.
- New cards available today.
- Projected time to finish.
- Retention snapshot.
- Backlog warning.
- Current study mode.
- Quick action to start review.
- Quick action to add a note.

## Primary User Flows

### Onboarding

Goal: configure the first useful daily queue with minimal friction.

Steps:

1. Choose module: English, QA, or both.
2. For English, choose track: General, IT/work, or both.
3. Choose level: beginner, intermediate, advanced.
4. Choose daily goal: minutes per day or new cards per day.
5. Choose prompt direction preference:
   - Balanced.
   - Ukrainian -> English productive-first.
   - English -> Ukrainian receptive-first.
6. Confirm default retention and grading mode.
7. Generate initial daily queue.

Acceptance criteria:

- User can finish onboarding in under 3 minutes.
- User ends onboarding with at least one active deck.
- User can start a study session immediately.

### Daily Study

Goal: complete due reviews first, then optionally learn new cards.

Steps:

1. Open app.
2. See today's queue.
3. Start reviews.
4. For each card:
   - Read prompt.
   - Attempt answer.
   - Reveal answer.
   - Review feedback.
   - Self-grade.
5. After due reviews, optionally learn new cards.
6. See session summary.

Acceptance criteria:

- Correct answer is never visible before the attempt/reveal step.
- Review submission persists a review log.
- Card receives updated due time immediately.
- Session summary shows reviews done, new cards, accuracy, lapses, and time.

### Add Content

Supported modes:

- Manual note creation.
- CSV import.
- Add from curated built-in lists.

Acceptance criteria:

- User can create English vocabulary notes.
- User can create QA notes.
- User can tag, edit, pause, and delete notes.
- User can preview generated cards before or after note creation.

### Inspect Performance

Dashboard should show:

- Due reviews.
- True retention.
- Desired retention gap.
- Review completion rate.
- New-card completion rate.
- Average answer latency.
- Lapse rate.
- Leech rate.
- Mature card count.
- Topic accuracy.
- Daily workload minutes.

Acceptance criteria:

- Dashboard distinguishes learning progress from product usage.
- Topic-level weak areas are visible.
- Backlog overload is visible before it becomes demotivating.

### Edit Notes

Goal: improve bad content instead of repeatedly failing it.

Actions:

- Edit fields.
- Add examples.
- Add or remove tags.
- Pause note or card.
- Delete note when it is no longer needed.
- Split overloaded note into smaller notes.
- Mark repeated failures as leech.

## Review Interaction

Standard skeleton:

1. Show prompt.
2. Force a response attempt.
3. Reveal correct answer.
4. Show explanation and example.
5. Ask learner to self-grade.
6. Schedule next review.

Default grading:

- `Again`: answer was forgotten or wrong.
- `Good`: answer was recalled well enough.

Advanced grading:

- `Again`: forgotten or wrong.
- `Hard`: correct but difficult.
- `Good`: correct with normal effort.
- `Easy`: correct and effortless.

Important product rule: users must not be nudged to press `Hard` when the answer was forgotten, because that corrupts scheduling.

## Study Modes

MVP modes:

- Daily queue: standard due reviews and new cards.
- English productive mode: prioritize Ukrainian -> English and cloze cards.
- QA interview mode light: prioritize term, contrast, and scenario cards.

Later modes:

- Mock quiz.
- Interview drill.
- Weak-topic sprint.
- Listening recall.
- Offline PWA study.

## Content Strategy

Built-in content should be curated and authored for retrieval. Do not dump source material verbatim.

English seed layers:

| Layer | Source Logic | Example Size |
| --- | --- | --- |
| Core frequency | Oxford 3000 / NGSL-style general vocabulary | 1,500-3,000 notes |
| Daily life phrases | Common chunks and collocations | 500-1,000 notes |
| Work/IT | Curated or imported professional vocabulary | 300-800 notes |

QA seed phases:

| Phase | Source Anchor | Goal |
| --- | --- | --- |
| Foundation | ISTQB CTFL + glossary | Standard testing terminology and concepts |
| Web/API | MDN HTTP and web platform basics | Interview-ready web knowledge |
| UI automation | Playwright and Selenium docs | Modern automation practice |
| Security awareness | OWASP WSTG | Broader testing literacy |

## MVP Definition

MVP is complete when:

- FSRS scheduling works.
- English module supports Ukrainian -> English and English -> Ukrainian cards.
- QA module supports glossary, contrast, and scenario card types.
- Review flow forces attempt before reveal.
- Feedback is shown after reveal.
- User can add, edit, pause, delete, and tag notes.
- CSV import supports English and QA schemas.
- Dashboard shows due reviews, retention, lapses, mature cards, and daily workload.
- Review logs are persisted and recoverable.
