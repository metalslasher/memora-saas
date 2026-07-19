# Memora Learning And Content Specification

## Learning Model

Memora is built around active retrieval, spaced repetition, and corrective feedback.

The system should optimize for long-term recall and transfer:

- English recall should transfer into speaking, writing, meetings, and workplace contexts.
- QA recall should transfer into interviews, debugging, test design, and automation decisions.

## Language Policy

Memora is Ukrainian-first because the primary learner studies through Ukrainian.

- Product UI uses Ukrainian.
- English vocabulary keeps the target word or phrase in English, but prompts, explanations, and support text use Ukrainian.
- English productive cards ask from Ukrainian to English.
- English receptive cards ask what the English item means in Ukrainian.
- QA terms can stay in English when that is the common professional term, but definitions, explanations, hints, and study prompts use Ukrainian.
- QA examples can contain English code, selectors, commands, or workplace phrases when useful, but the learning explanation should still be Ukrainian.
- Avoid raw technical labels such as `active`, `seed`, `term_definition`, or MVP/dev wording in reader-facing UI.

## Core Learning Loop

Every review uses the same loop:

1. Prompt.
2. User response attempt.
3. Reveal.
4. Feedback.
5. Self-grade.
6. Schedule.

The reveal step must include:

- Correct answer.
- Concise explanation.
- Example, contrast, or usage note when useful.

## Scheduler

Use FSRS through a TypeScript-compatible implementation, preferably `ts-fsrs`.

Default settings:

| Setting | Recommendation |
| --- | --- |
| Engine | FSRS |
| Initial parameters | Official defaults |
| Desired retention | 0.90 |
| Allowed retention UI range | 0.85-0.95 |
| Learning steps | 10 minutes, 30 minutes |
| Relearning steps after lapse | 10 minutes, 1 day |
| New-card priority | Reviews first, then new cards |
| Due queue order | Lowest retrievability first |
| Per-user optimization | Enable after enough review history, initially around 500+ reviews |

Implementation notes:

- Do not hardcode a fixed interval ladder as the primary scheduling engine.
- Same-day learning and relearning steps should stay under one day.
- Review logs are mandatory because future FSRS optimization depends on history.
- The backend owns scheduling transitions; the frontend only submits the user's rating and metadata.

## Card State Machine

| State | Meaning |
| --- | --- |
| `new` | Never studied |
| `learning` | In same-day acquisition steps |
| `review` | Graduated into FSRS schedule |
| `relearning` | Lapsed and being repaired |
| `suspended` | Temporarily removed from scheduling |
| `leech` | Repeatedly failed; needs rewrite or split |
| `archived` | Legacy retained status; current UI uses full material deletion instead |

Allowed transitions:

- `new` -> `learning`
- `learning` -> `learning`
- `learning` -> `review`
- `review` -> `review`
- `review` -> `relearning`
- `relearning` -> `review`
- Any active state -> `suspended`
- `suspended` -> previous active state when restored
- Any active state -> `leech` after repeated lapses
- Current UI: any material can be deleted after confirmation; legacy archived rows are treated as outside active learning.

Leech behavior:

- Mark as leech after repeated lapses.
- Show a content repair workflow.
- Recommend rewriting, adding context, splitting, or suspending.
- Do not treat leech as only a motivational failure; it is often a content design signal.

## Mastery Model

Track mastery at three levels:

| Layer | Meaning |
| --- | --- |
| Card mastery | Estimated retrievability, stability, lapse rate, last success |
| Note mastery | Aggregate over generated cards from the same note |
| Topic mastery | Aggregate over tags or topic tree |

Card-level fields:

- stability.
- difficulty.
- retrievability.
- due_at.
- last_reviewed_at.
- lapse_count.
- review_count.
- mature flag or maturity derived from interval/stability.

## English Note Model

An English note stores one lexical item or phrase plus support fields.

| Field | Required | Notes |
| --- | --- | --- |
| `note_id` | Yes | UUID |
| `lemma_en` | Yes | Base English form |
| `translation_uk` | Yes | Short Ukrainian meaning |
| `part_of_speech` | Yes | noun, verb, adjective, phrase, phrasal verb |
| `ipa_or_pronunciation` | No | IPA or simplified pronunciation |
| `audio_url` | No | TTS or licensed audio |
| `example_en` | Yes | Natural sentence |
| `example_uk` | No | Translation or gloss |
| `collocations` | No | Example: `file a bug`, `run a test` |
| `topic_tags` | Yes | general, IT, QA, meetings, product |
| `cefr_or_frequency_band` | No | A1-C2 or frequency band |
| `distractors` | No | Common confusions |
| `source` | Yes | curated, user, imported |
| `status` | Yes | active, suspended; archived may exist as legacy data |

Recommended English card types:

| Card Type | Prompt | Expected Answer | Priority |
| --- | --- | --- | --- |
| Productive translation | Ukrainian meaning or sentence | English word or phrase | Highest |
| Receptive translation | English word or phrase | Ukrainian meaning | Medium |
| Cloze in context | Sentence with blank | Missing word | Highest |
| Listening recall | Audio or TTS | Type/select word | Later release |
| Collocation recall | Start of phrase | Complete phrase | Medium |

English content rules:

- Prefer natural examples over dictionary fragments.
- Productive and cloze cards should be prominent.
- Include collocations for workplace usefulness.
- Add distractors for commonly confused words.
- Keep one note focused; split overloaded vocabulary items.

## QA Note Model

A QA note supports definitional, contrastive, scenario, decision, and code/tool prompts.

| Field | Required | Notes |
| --- | --- | --- |
| `note_id` | Yes | UUID |
| `term` | Yes | Example: `boundary value analysis` |
| `expansion` | No | Acronym expansion |
| `short_definition` | Yes | One-sentence answer |
| `full_explanation` | No | Two to five sentences |
| `example` | No | Concrete example |
| `counterexample` | No | What it is not |
| `topic` | Yes | fundamentals, API, automation, agile, security |
| `subtopic` | No | waits, locators, state transitions |
| `code_snippet` | No | Optional |
| `diagram_or_table_ref` | No | Optional |
| `tags` | Yes | manual, automation, interview, selenium, playwright |
| `difficulty` | Yes | basic, intermediate, advanced |
| `source` | Yes | ISTQB, MDN, Playwright, Selenium, OWASP, user |
| `status` | Yes | active, suspended; archived may exist as legacy data |

Recommended QA card types:

| Card Type | Prompt | Expected Answer |
| --- | --- | --- |
| Term -> concise definition | Поясни українською: що таке Regression testing? | 1-2 sentence Ukrainian definition |
| Definition -> term | Українське визначення або опис | Correct professional term |
| Acronym -> expansion and meaning | `BDD`: що означає і навіщо використовується? | Full form and Ukrainian purpose |
| Contrast card | Regression testing vs confirmation testing: у чому різниця? | Key distinction in Ukrainian |
| Scenario card | Mini situation in Ukrainian, with English tool names when needed | Best concept, technique, or next step |
| Code/tool card | Snippet or automation anti-pattern plus Ukrainian question | Identify problem or correct fix |
| Decision card | Testing situation in Ukrainian | Choose useful technique |

QA content rules:

- Keep definitions short enough to recall.
- Add examples and counterexamples for similar terms.
- Use scenario cards for transfer.
- Use code/tool cards for automation concepts.
- Source-aware authoring matters: use authoritative docs as anchors, but write learner-facing prompts in original concise language.

## CSV Import Schemas

MVP should support two import types.

### English CSV

Required columns:

- `lemma_en`
- `translation_uk`
- `part_of_speech`
- `example_en`
- `topic_tags`

Optional columns:

- `ipa_or_pronunciation`
- `example_uk`
- `collocations`
- `cefr_or_frequency_band`
- `distractors`
- `source`

### QA CSV

Required columns:

- `term`
- `short_definition`
- `topic`
- `tags`
- `difficulty`
- `source`

Optional columns:

- `expansion`
- `full_explanation`
- `example`
- `counterexample`
- `subtopic`
- `code_snippet`
- `diagram_or_table_ref`

CSV import acceptance criteria:

- Validate required fields before creating notes.
- Return row-level errors.
- Let the user preview counts before committing.
- Generate cards after successful note creation.
- Preserve original import metadata for debugging.

Current MVP implementation notes:

- English import accepts headers such as `lemma_en`, `translation_uk`, and `example_en`, plus common aliases like `english`, `meaning`, and `example`.
- QA import accepts headers such as `term`, `short_definition`, and `example`, plus aliases like `definition` and `explanation`.
- Comma, semicolon, and tab-delimited files are supported for small personal imports.
- Persistent import history is stored through `imports` and `import_rows`; imported notes are also marked as imported content.

## Backup And Export

Current personal MVP export rules:

- Full JSON backup includes settings, notes, cards, review logs, and import history.
- English CSV export uses `lemma_en`, `translation_uk`, `part_of_speech`, `example_en`, `source`, and `status`.
- QA CSV export uses `term`, `short_definition`, `example`, `source`, and `status`.
- Restore-from-backup is intentionally separate from export and should validate ownership, schema version, and duplicate behavior before writing data.

## Analytics Definitions

| Metric | Definition |
| --- | --- |
| True retention | Share of reviewed eligible cards answered correctly over a selected period |
| Desired retention gap | True retention minus configured desired retention |
| Review completion rate | Completed due reviews divided by due reviews |
| New-card completion rate | Learned new cards divided by daily new-card goal |
| Average answer latency | Average elapsed milliseconds before reveal or grading |
| Lapse rate | Again ratings on review cards divided by total review-stage reviews |
| Leech rate | Leech cards divided by active cards |
| Mature card count | Cards above maturity threshold |
| Topic accuracy | Correct reviews grouped by tag/topic |
| Daily workload minutes | Total active study time per day |
