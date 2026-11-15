# CLAUDE.md — Bookinator (formerly That Book)

Hackathon project (IST-Tech IT Arena, theme "Library + Because I'm Lazy"). Deadline: **Sun 15 Nov 2026, 14:00 KST**.
An Akinator-style game: the reader answers Yes / Probably / Don't know / Probably not / No, a local Bayesian
engine narrows a fixed book catalog, proposes a best match with source-linked clues, and links to library catalogs.
No LLM calls at runtime. Full spec: `README.md` (product + engine) — read it before changing behaviour.

## First thing to do in a fresh checkout

```bash
npm install
npm run verify      # tsc + node tests + python tests + catalog validation + vite build
npm run dev         # http://localhost:5173
```

The project was first built in an environment without npm registry access. On 14 Nov 2026 the real
toolchain ran for the first time (Node 22, Python 3.13, Linux) and `npm run verify` is fully green:

- `npm install` resolved every declared range unchanged: vite 7.3.8, @vitejs/plugin-react 5.2.0,
  typescript 5.9.3, tsx 4.23.15, react 19.3.1. `package-lock.json` is committed.
- `tsc` 5.9 (both tsconfigs), 49 node tests, 15 python tests, validation and `vite build` all pass with no code changes.
- `vite dev` was playtested in Chromium at 1280×860 and 390×844: Undo, guess, rejection, undo of a rejection,
  18-question shortlist, reload-resume, no-match exit; no console errors.
- Python npm scripts go through `scripts/py.mjs`, which finds `python3`, `python` or `py -3` (3.10+; override
  with `PYTHON`). **Not yet run on a real Windows machine.**

When fixing, run `npm run verify` until green. Don't "fix" errors by deleting tests or weakening checks.

## Commands

| Command | What |
| --- | --- |
| `npm run verify` | everything CI runs |
| `npm run typecheck` / `npm run typecheck:engine` | full tsc / React-free strict tsc |
| `npm test` | node:test via tsx: engine, simulator, availability client, library proxy |
| `npm run test:py` | Python stdlib unittest: validator, pipeline (mocked LLM), HTTP clients vs mock server |
| `npm run validate` | `scripts/validate_catalog.py` on the fixture |
| `npm run simulate` / `npm run simulate:truth` | seeded simulations (same engine as UI) |
| `npm run proxy` | optional Data4Library proxy (`DATA4LIBRARY_AUTH_KEY` env) |
| `python3 scripts/build_fixture.py` | regenerate fixture catalog + titles.csv + evidence from `data/curation/fixture_labels.json` |

## Architecture (where things live)

- `src/engine/` — pure TS, shared by UI, tests and `scripts/simulate.ts`. Never import React here.
  - `model.ts` types + channel + `compileCatalog`; `config.ts` **all thresholds**; `posterior.ts` log-space replay;
    `selectQuestion.ts` expected information gain × recallability; `session.ts` event log, Undo, rejection,
    40-question cap (Akinator-style; DB setting `max_session_answers` must match), shortlist, no-match; `explain.ts` clues; `links.ts` catalog links.
- `src/components/` UI in the "Sea Library" Figma design (file `2y03ZMj6rMWmPFT4GwYa0n`): `ui.tsx` = reusable Header, MobileHeader, Footer,
  Button, AnswerButton, BookCard, LeaderboardRow, UnsplashImage; `screens.tsx` = Home, Question, Book (guess + found), Similar;
  `Contribute.tsx` = Not Found / add-a-book + opt-in answers. Colours only as CSS variables in `src/styles.css`; design wording in
  `src/i18n/library.ts` (ko/en); design sample content only in `src/mock/design.ts`; icons exported from Figma in `src/assets/icons/`.
  `src/bookInfo.ts` = sourced descriptions (Wikipedia page id / Open Library work id), Unsplash photo and popular lists via Edge Functions; `src/i18n/` Korean/English; `src/App.tsx` state + keyboard; `src/game.ts` wiring + env vars.
- `src/data/index.ts` — chooses the catalog: `?collection=research|classic` in the URL, else `VITE_CATALOG`, else the research shelf. Series targets (`volumes`) are
  guessed as a series; the reader then picks the volume.
- `server/library-proxy.mjs` — stdlib Node proxy keeping the Data4Library key server-side.
- `research/chatgpt_source/` — ChatGPT's research code, unchanged; tests via `npm run test:research`.
- `scripts/` — Python data pipeline (stdlib only) + simulator. `data/` — question bank, curation, evidence, truth set.

## Rules (from the build brief — keep them)

- **Never invent** book facts, ISBNs, Open Library IDs, Korean titles, citations, API parameters, availability,
  or benchmark numbers. Unknown = p_yes 0.5 / null. Fixture data stays visibly marked as development data.
- Thresholds stay configurable in `config.ts`. Don't lower the guess threshold to make numbers look better.
- No normal answer may hard-eliminate a book (channel entries must stay > 0). Don't-know must stay neutral.
- Simulations must use the same engine module as the UI.
- Secrets server-side only. Every external integration must fail gracefully (show catalog link, not a guess).
- Don't add accounts, vector databases, online learning or a live LLM chatbot.
- UI must not show raw posterior percentages as accuracy.

## Research catalog (500 imported records → 181 targets, 268 titles)

Two catalogs ship, switchable on the start screen (live: https://wiseshrestha.github.io/Bookinator/). The **CMU /
research catalog** ("Research shelf", 268 titles) is the **default**. The **10-book fixture** ("Classic shelf") is at
`?collection=classic`, `npm run dev:classic` or `VITE_CATALOG=classic`. Never report imported records as game coverage:

| Measure (14 Nov 2026) | Count |
| --- | ---: |
| Source records imported (CMU Core priority 500) | 500 |
| Records with a validated question matrix | 500 (7,348 source-linked cells; 468 have ≥12) |
| Form holds kept out of the novel pool | 8 |
| Cells reviewed by a person | **0** |
| **Playable game targets** | **181** covering **268** titles (27 before series + AI recall; 17 with the base 64 only) |

Pipeline (`npm run catalog:research`; needs the research and Core packs next to the repo, not committed):
1. `scripts/merge_research.py`: researched matrix (`core500_researched_labels.json`) merged by stable ID with
   this project's own 160 labelled books (`data/cmu/responses/`). 312 of our cells added where research had 0.5,
   none where research withheld or flagged a cell; 1 direction conflict (Water for Elephants q06) set to
   ambiguous; 497 agreeing cells keep the stronger value. **Calibration:** 3,200 cells whose recorded method is
   an explicit field or closed official list (language field, Nobel list, named series, corroborated publication
   period) go from qualified 0.7/0.3 to strong 0.9/0.1, as the labelling prompt's own scale defines. AI
   interpretations stay 0.7/0.3. The result passes the research pack's own `validate_evidence_matrix`.
2. `scripts/build_cmu_catalog.py --limit 500 --gate none`: compact runtime catalog, no plot text or quotes.
3. `scripts/gate_catalog.ts`: **engine gate** with the real engine and unchanged `config.ts` thresholds. A book
   is playable only if answering exactly from its own labels makes it the engine's first guess (backward seed,
   then forward retry in priority order). `tests/cmu_catalog.test.ts` re-checks this on every `npm test`.

Simulation (`reports/simulation_research.json`, seed 42, 30 games/book): see the motif table below.
Machine-labelled data: these are not accuracy claims. Why so few: most research labels are qualified 0.7/0.3, which the engine cannot turn into a
confident guess within 18 questions. More playable books need **stronger, distinguishing plot labels reviewed by
a person**, not lower thresholds. Every book's status and reason is in `data/cmu/coverage_report.json`.

### Motif questions (52 concrete story elements)

`scripts/motif_labels.py` adds 52 questions about things a reader remembers ("Does a dragon appear?", "Are
there vampires?", "Is someone kidnapped?", "Is there a courtroom trial?" …; full list in
`data/motifs/motif_questions.json`). Evidence comes only from story text: the CMU plot synopsis and the premise
paragraph that opens the Wikipedia article, never reception, background or category lines. Labels are
**positive only** (an explicit mention gives 0.9 with an exact quote); a summary not mentioning a dragon stays
unknown, never No. Patterns were tuned against their hits and 52 figurative or off-story hits were rejected by
an AI assistant (`data/motifs/rejected.json`); random samples of the broad motifs were checked. No person has
reviewed them. Result: 2,146 motif labels on 467 books.

| | base 64 questions | + 52 motif questions |
| --- | ---: | ---: |
| Playable books (engine gate, thresholds unchanged) | 17 | **27** |
| Clear memory: first guess right / found by any route | 26.3% / 92.7% | 31.9% / 82.7% |
| Half memory: first guess right / found by any route | 6.9% / 82.9% | 6.7% / 67.0% |

Experiment, **not shipped**: counting "the summary never mentions it" as a weak No (0.3) on motif questions
makes 178 books pass the gate, but clear-memory play falls to 8.6% first guess / 57.1% found. That breaks the
brief's "missing evidence is unknown, not No" rule and is a product decision, not a default.

### AI-recall labels and series targets (14 Nov 2026, evening)

**AI recall (replaces human review for now).** `data/ai_recall/labels.txt` holds an AI assistant's answers from
general knowledge for 219 well-known books (Y/N strong, y/n qualified; anything uncertain left unknown).
They only fill cells the sourced data leaves unknown, and they can say **No** ("no dragon in *Pride and
Prejudice*"), which source text can't. Check against the sourced labels: 2088 of 2245 overlapping cells agree
(**93.0%**); on the 157 disagreements the cell becomes unknown. Status `ai_recall`, no source, `reviewed=false`;
clues say "AI's general knowledge, no source". This is not a person's review.

**Series targets.** Series with ≥2 volumes in the pool (goodbooks tag "(Series, #n)") become one target: volumes
agreeing → that answer, disagreeing → unknown, "first in series?" → unknown. After Folio's guess the reader picks
the volume from a list. `--no-series` / `--no-ai-recall` turn each off.

**Second labeller.** `docs/GPT_LABELLING_BRIEF.md` is a paste-ready brief for ChatGPT with work lists in
`data/ai_recall/worklists/` (`scripts/export_worklists.py`). Its answers go in `data/ai_recall/gpt.txt`; labellers
that disagree on a cell leave it unknown, and per-labeller agreement is reported.

| | 64 + motif questions | + series + AI recall |
| --- | ---: | ---: |
| Playable targets (engine gate, thresholds unchanged) | 27 | **181** (28 of them series) |
| Titles a reader can reach | 27 | **268** |
| Clear memory: first guess right / found by any route | 31.9% / 82.7% | 20.4% / 73.3% |
| Half memory: first guess right / found by any route | 6.7% / 67.0% | 2.5% / 46.4% |
| One mistake: first guess right / found by any route | 15.7% / 70.1% | 8.7% / 57.0% |

Simulated readers answer from the same labels (internal consistency, not accuracy). More books means more to
confuse, so per-game rates drop while coverage grows tenfold.

### AI labels without a rebuild (15 Nov 2026, catalog `cmu-priority500-v2`)

`scripts/apply_ai_recall.ts --version <new>` applies every `data/ai_recall/*.txt` labeller (claude = labels.txt, gpt,
gemini) to the SHIPPED research catalog with the builder's rules (labellers disagree → unknown; AI vs sourced conflict →
unknown), then `scripts/gate_catalog.ts` re-gates. Used because the Core pack is not on this machine; series targets are
left unchanged until the next full `npm run catalog:research`. v2: 179 targets / 266 titles; stats in
`data/cmu/ai_recall_applied.json`. `gemini.txt` = a teammate's Gemini run over CMU summaries, its q01–q15 renumbered
to this bank by meaning (4 questions left out). Releases are immutable in Supabase: always bump the version.

### Teammates adding labels with any AI

`docs/AI_LABELLING_PROMPT.md` (generated by `scripts/export_labelling_prompt.ts` from the catalog's questions) is the ONE
prompt for every teammate/AI. `scripts/import_ai_labels.ts --name <ai> files…` validates lines, finds the book (id, else
title/alias + author), merges duplicates (same direction → stronger, opposite → dropped), writes pool books to
`data/ai_recall/<ai>.txt` and others to `data/ai_recall/extra/<ai>_new_books.json`. Then apply_ai_recall → gate → sync.

### Engine behaviour added 15 Nov 2026
40-question cap; Akinator-style check-ins (`checkpointQuestions` 15/25/35, tentative guess, "no" continues; 4 rejections
before the shortlist); seeded question variety (`questionSpread`/`questionTopK`, seed per UI game in
`session.options.seed`; no seed = fixed order, which the engine gate uses). All in `src/engine/config.ts`.

### Library pages (fictional "Sea Library" on Pohang's Yeongildae beach)

Hash routes (`src/router.ts`): `#/catalog` (505 novels from the research pool + classic shelf, 24 per page, tag/status
filters, generated covers — no cover images), `#/book/<id>` (own page: Wikipedia/Open Library story, Unsplash mood
photo, label-derived mood words and facts), `#/leaderboard`, `#/programs`, `#/guide`, `#/about`. Data:
`src/data/library_index.json` from `npm run library:index` (re-run after the catalogs change); tags are derived from
labels, ranks are goodbooks-10k popularity. Library wording/content: `src/i18n/pages.ts`, always marked fictional.
Unsplash results are cached for every visitor in `public.photo_cache` by the `book-image` Edge Function (demo key: 50/h).

### Second labeller: GPT recall pass (15 Nov 2026)

`data/ai_recall/gpt.txt` (GPT, independent of Claude's file; see `docs/GPT_RECALL_HANDOFF.md`): 488 books,
37,168 answers, 4 skipped; imported unchanged as a second labeller. Checks from the rebuild:

| Check | Result |
| --- | ---: |
| Claude recall vs sourced labels | 2083/2226 agree (93.6%) |
| GPT recall vs sourced labels | 6618/6757 agree (97.9%) |
| Claude vs GPT on the same cells | 7783 agree, 692 disagree → unknown (91.8% agreement) |
| Recall cells added to the catalog | 29,581 |

**Disagreement review.** Disagreements cluster on a few questions where the written definition was broader than
the question players see (e.g. "Is there a courtroom trial?" was defined as "a trial, lawyer or court case", so a
solicitor in *Dracula* counted). Rule added (`RELIABILITY_MIN_AGREE` = 0.75 in `build_cmu_catalog.py`, a data
rule, not an engine threshold): on questions where the two labellers agree < 75% of the time, an answer from only
one labeller is dropped and only agreed answers are kept. Affected: m12 (40/59), m13 (18/59), m27 (33/49), m34 (23/31), m36 (43/77), m49 (32/50), q22 (21/31); 1,742 single-labeller answers
dropped. The trial, battle and train definitions (and their keyword patterns) now match the question text.
Two AIs agreeing is not measured factual accuracy; every cell stays `ai_recall`, no source, `reviewed=false`.

**Catalog state after the merge of 15 Nov 2026:** the 341-target / 440-title build from that rebuild (commit
`f76ae8b`, still versioned `cmu-priority500-v1`) was replaced by `cmu-priority500-v2` (179 targets / 266 titles,
`scripts/apply_ai_recall.ts`) when main was merged in `460bfe6`. The shipped `src/data/cmu.catalog.json` and the
Supabase releases are v2. To ship the GPT rebuild: rebuild with the Core pack (now with gemini.txt and the extra
Claude lines too), give it a NEW version (v3; v1 is already a Supabase release), then `npm run library:index`,
`npm run verify` and `npm run community -- sync`.


## Known open items (not errors — need people or keys)

- Fixture: 171/589 labels AI-checked against cited sources; 414 unchecked; **no human review**.
- Research catalog: 500 imported, 181 targets / 268 titles, 0 human-reviewed (AI recall is not review). Human review of distinguishing labels is the next lever.
- LLM labelling and Data4Library proxy were tested only against mock servers; try one real call each.
- Human playtests, rehearsals, QR code (live site: https://wiseshrestha.github.io/Bookinator/, redeployed on every push to main).

## Community contributions (DRAFT — design in `docs/community/DESIGN.md`)

New requirement: Akinator-style reader contributions (new books after a miss, corrections, feature answers,
question and cover proposals) stored in Supabase (project ref `jvfxqusmnfdvslrgbjyv`, MCP server in `.mcp.json`).
Applied to the remote project on 15 Nov 2026: both migrations in `supabase/migrations/` and the `book-image` Edge
Function (Unsplash proxy, `supabase/functions/`). Not done yet: catalog `sync` (needs `SUPABASE_SERVICE_ROLE_KEY`),
Anonymous sign-ins (off in the dashboard, so contributions fail until enabled), `app_admins` rows. Decided (14 Nov 2026): D1 Supabase anonymous sign-in + CAPTCHA,
D2 opt-in consent asked at the end of each game (send nothing on decline), D7 no cover uploads (Open Library cover
links only). D3–D6 and D8–D13 are still open in the design doc — don't hard-code an answer to one of them.

- `supabase/migrations/…_community_contributions.sql`: catalog mirror (read-only) / raw contributions (insert-only via
  `submit_*` RPCs) / derived + review data (append-only). RLS + `is_admin()` from `app_admins`. Tested in PGlite:
  `npm run test:db` (`tests/db/`, Supabase auth/storage stubbed in `tests/db/supabase_stub.sql`).
- `src/community/consensus.ts`: aggregation `crowd-v1` (same channel as the engine; one vote per contributor;
  "Don't know" neutral but counted; not-asked = no row). Pure TS, never writes the catalog.
- `scripts/community.ts sync|consensus|export` (service-role key, maintainer only) and `scripts/community_lib.ts`
  (candidate catalog: accepted consensus fills only unlabelled/unreviewed cells, never `supported`/reviewed ones;
  approved books join only if the engine gate finds them). The JSON catalog in git stays the source of truth.
- Feature status `community_consensus` requires `reviewed: true` and `consensus` provenance (validator enforces).
- `scripts/py.mjs` runs Python in UTF-8 mode; with that, `npm run verify` is green on Windows (cp949 console).
- UI follows the Sea Library Figma design (Korean/English; desktop 1440 / mobile 390, breakpoint 760px). No match percentages are shown
  (posterior ≠ accuracy); free-text inputs from the design are visible but disabled (no LLM at runtime). Korean question
  wording lives in `src/i18n/questionsKo.ts` keyed by the English text — add a line when a question is added
  (`tests/contribute.test.ts` fails otherwise). Covers are generated (D7), never images.
- Browser contributions: `src/community/client.ts` (supabase-js loaded lazily, anonymous sign-in, Turnstile when
  `VITE_TURNSTILE_SITE_KEY` is set). Nothing is sent without the reader asking on that screen (D2); the exact
  payload is `src/community/payload.ts`. No `VITE_SUPABASE_*` env → game unchanged, contributions switched off.
- Dataset in Supabase: `npm run community -- sync` saves a shipped catalog, `get_release_catalog()` / `pull` load it
  back byte-for-byte equal (tested). `VITE_CATALOG_SOURCE=supabase` makes `main.tsx` play the DB copy of the same
  release, falling back to the bundle on any problem — the engine never depends on the server.
