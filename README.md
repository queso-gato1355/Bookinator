# Bookinator

*(project name during the hackathon: "That Book")*

**Remember the story. Forget the title.**

A reader half-remembers a novel. Bookinator's seagull (북키네이터 갈매기) asks short questions (Yes / Probably / Don't know / Probably not / No), narrows down a fixed collection with a local Bayesian engine, proposes a best match with source-linked clues, and links to library catalogs. With an optional proxy, it also checks a library's holdings. Undo, wrong-guess recovery, a top-3 shortlist and an honest "not in this collection" exit are built in.

Theme: **Library + "Because I'm Lazy"**: the system chooses the search questions, so the reader doesn't need an author, title, ISBN or a good search query. There are no LLM calls during play.

> ⚠ **Current data is a 10-book DEVELOPMENT FIXTURE.** Labels were first written from general knowledge by an AI assistant. **171 of 589 labels were then checked against cited Wikipedia and Open Library pages** (status `supported`), and several guesses were corrected. 4 are marked `ambiguous` with notes; the rest are still unchecked. **No human has reviewed any of it.** The app shows a banner saying so, and clues show whether they're source-checked.

---

## Quick start

```bash
npm install
npm run dev            # http://localhost:5173
npm run verify         # type-check + all tests + catalog validation + Vite build (what CI runs)
npm test               # engine, simulator, availability and proxy tests (node:test via tsx)
npm run test:py        # data-pipeline, validator and HTTP-client tests (stdlib Python)
npm run simulate       # seeded simulations on the active catalog
npm run simulate:truth # simulations answering only from source-checked facts
npm run validate       # validate the fixture catalog against the data contract
npm run proxy          # optional Data4Library proxy (needs DATA4LIBRARY_AUTH_KEY)
npm run build          # production build into dist/ (static; works offline after load)
```

Requires Node 20+ and Python 3.10+. **CI** (`.github/workflows/ci.yml`) runs `npm install && npm run verify` on every push. **Deploy** (`deploy-pages.yml`) rebuilds the site on every push to `main` and publishes it to the `gh-pages` branch: **https://wiseshrestha.github.io/Bookinator/** (use this URL for the demo QR code).

A ready-made **offline single-file build** and a **labelled backup recording** are shipped alongside the zip.

### Optional library integrations (`.env.local`, see `.env.example`)

| Variable | Effect |
| --- | --- |
| `VITE_LOCAL_LIBRARY_SEARCH_URL` | A catalog search URL **you verified by hand**, with `{query}`. Uses the Korean title when known. |
| `VITE_LIBRARY_PROXY_URL`, `VITE_LIBRARY_CODE`, `VITE_LIBRARY_NAME` | Adds a "Check if [library] has it" button that calls `server/library-proxy.mjs`. Hidden unless all are set. |

The proxy keeps the Data4Library key **server-side**: `DATA4LIBRARY_AUTH_KEY=… npm run proxy`. It exposes `/health`, `/availability?isbn13=&libCode=` (bookExist) and `/libraries?isbn=&region=` (libSrchByBook). It validates inputs, times out after 6 s, and caches for 5 min. It returns `cached` and `fetchedAt`, so the UI never presents a cached result as live. Any failure (no key, upstream error, timeout, unexpected response) produces a message and the catalog link, never invented availability. The UI queries the book's **Korean edition ISBN** when one is stored and says exactly which edition it checked.

### Keyboard

`1`–`5` answer · `Y`/`N` on a guess · `U` undo · everything is a native button reachable with `Tab`. Focus moves to each new heading so screen readers announce it. The layout is a single column on phones, with a history sidebar from 860 px.

---

## Project layout

```
src/engine/            pure TypeScript shared by UI, tests and simulator
  model.ts  config.ts  posterior.ts  selectQuestion.ts  session.ts  explain.ts  links.ts
src/availability.ts    proxy client (never invents availability)
src/components/        start, question, history, guess, shortlist, found, no-match, availability
src/data/index.ts      the ONE line that chooses which catalog ships
src/data/fixture.catalog.json        generated 10-book fixture
server/library-proxy.mjs             optional Data4Library proxy (stdlib Node)
data/question_bank.json              64 questions, groups, recallability, flags
data/curation/fixture_labels.json    fixture labels + sources + which cells each source supports
data/curation/titles.csv             the 10 fixture books in pipeline format (real input)
data/evidence/<id>.json              per-book sources with paraphrased evidence notes
data/truth/fixture_supported_truth.json   truth set: only source-checked cells
scripts/build_fixture.py  validate_catalog.py  prepare_catalog.py  review.py
scripts/openlibrary_lookup.py  simulate.ts  prompts/matrix_prompt.txt
tests/  engine · simulate · availability · proxy (.test.ts) · pipeline · http_clients (test_*.py)
reports/                             latest simulation outputs
.github/workflows/                   ci.yml, deploy-pages.yml
```

---

## Engine (as specified)

- **Channel** (P(answer | fact Yes) / P(answer | fact No)):
  - Yes .55/.05 · Probably .20/.10 · Don't know .10/.10 · Probably not .10/.20 · No .05/.55.
  - Each column must sum to 1 and every entry must be > 0, or the engine refuses to load. So no normal answer can eliminate a book.
- **Likelihood:** `L = x·ch[a].yes + (1−x)·ch[a].no`. Unlabeled cells use x = 0.5.
- **Posterior:** replayed from a uniform prior in log space with a stable softmax. Rejected books get −∞. If nothing finite remains, the result is no-match.
- **Question selection:** maximize `IG × recallability` over active, unasked questions, at most one per correlation group. Adaptation-sensitive questions are skipped in film mode. Ties go to the earlier question. A test checks the optimized IG against the brief's direct formula.
- **Next action:**
  1. Two rejections → shortlist.
  2. Guess when there are ≥6 informative answers, top p ≥ 0.80, top/second ≥ 4, and ≥1 answer since the last rejection (the one addition to the brief; set `questionsAfterRejection = 0` to match the pseudocode literally).
  3. 18 questions asked, or no eligible questions → shortlist.
  4. Best score < 0.01 → shortlist.
  5. Otherwise ask.
- **Session:** an append-only event log, so Undo is exact, including un-rejecting a book.
- **Clues:** "Why this book" prefers source-checked labels and links the source. Unchecked labels are marked as such. No posterior percentages are shown.

---

## Data pipeline (Person B)

1. **Titles:** one row per work in `data/curation/titles.csv`. It already contains the 10 fixture books; extend it. Fill Korean titles, aliases, Open Library work IDs and ISBNs **only when verified**. `scripts/openlibrary_lookup.py` suggests work IDs for you to confirm.
2. **Evidence:** `data/evidence/<id>.json`, with real URLs, the license or terms, and an excerpt or paraphrased note. Check with `python3 scripts/prepare_catalog.py check`.
3. **Labelling:** `prepare_catalog.py label --dry-run`, then a 10-book pilot with `--model`, `--input-rate`, `--output-rate` and `--cap`.
   - Batches of 1–10 books; exact-ID, value and source checks.
   - Up to 3 retries; checkpoints; it stops *before* any call that could break the cap.
   - Works with Anthropic or OpenAI. Keys are read from the environment only.
4. **Merge:** `prepare_catalog.py merge --runtime-out src/data/catalog.json` validates, keeps earlier review decisions, and refuses to write a broken runtime file.
5. **Review:** `review.py export` covers demo books, 100 seeded random cells, and the separating cells of the closest pairs. Fill in verdicts, run `review.py apply`, then re-merge.
6. **Ship:** point `src/data/index.ts` at `./catalog.json`; use `merge --production` only after human review.

The validator checks:
- IDs and references; allowed probabilities and statuses;
- that supported cells cite their own book's sources;
- no placeholder URLs or licenses; Open Library ID format; **ISBN-13 checksums**;
- that edition ISBNs cite a source; no fixture labels in production;
- thinly labelled books, and book pairs the engine cannot separate.

---

## Verification results (14 Nov 2026, in the build environment)

| Check | Result |
| --- | --- |
| Full strict `tsc` incl. every React component, against **real `@types/react` 19** (fetched via git) | **pass** |
| Strict `tsc` on engine, scripts and tests (`tsconfig.engine.json`) | **pass** |
| `npm test`: engine, simulator, availability client, library proxy against a mock Data4Library | **49/49** |
| Python: validator, pipeline (mocked LLM), **HTTP clients against a local mock server** (Anthropic and OpenAI request formats, usage accounting, retry after HTTP 500, Open Library lookup with User-Agent, rate limit and cache) | **15/15** |
| `validate_catalog.py` on the fixture | **OK**, 0 errors, 0 warnings |
| `prepare_catalog.py check` and `label --dry-run` on the real 10-book inputs | **OK** |
| Chromium playtest at 390×844 and 1280×860, keyboard-driven: Undo, guess, two rejections → shortlist → no-match, reload-resume | **pass, no console errors** |
| Backup recording: real keyboard-driven game in Chromium (guesses *The Vegetarian* after 7 answers), captioned "RECORDED DEMO · not a live run" | **made** |

### Simulations (seed 42, 30 games × 10 books per scenario)

| Scenario | Top-1 (self-consistency) | Found incl. shortlist | Top-1 (crisp labels) | Top-1 (**only source-checked facts**) | Found incl. shortlist (source-checked) |
| --- | --- | --- | --- | --- | --- |
| clear | 92.7% (278/300) | 100% (300/300) | 100% (300/300) | 56.7% (170/300) | 88.7% (266/300) |
| half | 67.0% (201/300) | 96.0% (288/300) | 92.0% (276/300) | 24.0% (72/300) | 80.3% (241/300) |
| difficult | 34.3% (103/300) | 85.3% (256/300) | 63.0% (189/300) | 9.3% (28/300) | 69.3% (208/300) |
| one mistake | 76.0% (228/300) | 97.0% (291/300) | 100% (300/300) | 44.0% (132/300) | 81.0% (243/300) |

- **Self-consistency:** answers are drawn from the same labels the engine uses, and 0.7/0.3 labels count as false 30% of the time.
- **Crisp labels:** labels other than 0.5 are treated as certain.
- **Source-checked facts:** answers come only from the 171 source-checked cells; everything else is answered "Don't know". In that mode there was **1 wrong guess in 300 clear-memory games**: the engine stays cautious when evidence is thin. The low first-guess rate comes from having only 11–26 sourced facts per book out of 63 questions, so the 18-question budget runs out before it's confident.
- **Takeaway for the real catalog:** label coverage per book matters more than engine tuning. The `channel` scenario samples unknowns and is not comparable in truth mode; full outputs are in `reports/`.
- **Scale warning (synthetic random 200-book catalog, crisp truth):** clear top-1 was only 62.7%, needing about 16 questions. Measure the real catalog as soon as it loads. The levers are well-sourced 0.9/0.1 labels, sharper questions, a smaller demo pool, and channel tuning from playtests, not simply a lower guess threshold.

---

## Status of every item from the first handoff

| Item | Now |
| --- | --- |
| Vite never ran | **Resolved (14 Nov 2026).** Real `npm install` (vite 7.3.8, TypeScript 5.9.3, lockfile committed), `npm run verify` incl. `vite build`, and a Chromium playtest of `npm run dev` at phone and desktop size all pass. Python scripts now run through `scripts/py.mjs` so Windows without `python3` works (launcher not yet run on real Windows). |
| Fixture labels unchecked | **171/589 checked against cited sources**, several corrected (e.g. Darcy central, *1984* set in an imagined future, *The Vegetarian* film, *The Little Prince* TV series; *Orient Express* TV series downgraded). Korean titles for all 10, aliases (e.g. 상실의 시대), **8 Open Library work IDs**, **10 checksum-valid ISBNs** (6 Korean editions). **Still no human review.** |
| LLM labelling and Open Library lookup never executed | **Executed over HTTP against a mock server** with provider-shaped responses. A real call still needs a key and network: run a 1-book pilot first. |
| No live availability | **Built**: proxy + UI + tests. Data4Library has **not** been called with a real key; parameter names come from the API page as used by independent clients. Test with a key before the demo. |
| Backup recording | **Done** (MP4, labelled). Re-record once the real catalog is in. |
| QR code | Deploy workflow added; generate the QR from the Pages URL once deployed. |
| Human playtests, timed rehearsals | **Can't be done by me.** Recruit 10 fresh testers and record outcomes with exact denominators. |

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

## Front end: the seagull, the clouds and the sea

The interface follows the design canvas *북키네이터 (Bookinator) 프론트엔드 디자인*: a seagull in a pale sky asks
each question in a speech bubble under a hanging "Question N" sign, and the five answers are cloud buttons
floating on the sea (keys 1–5). Korean and English (`src/i18n/`, Korean question wording keyed by the English
text), PC layout from 900 px and a phone layout below it. Guesses hang from a rope as a book card with a generated
cover (no cover images: their rights are not established). After a miss, "Which book was it?" searches the shelf
for a similar book and, when Supabase is configured, lets the reader add the book and — only if they tick the
box — send their answers (`src/components/Contribute.tsx`, design: `docs/community/DESIGN.md`). Everything is CSS
and inline SVG; animation stops under `prefers-reduced-motion`.

## ChatGPT's research source code

`research/chatgpt_source/` holds the source code used for the 500-book research pass (labelling, source
parsing, enrichment, validation, the five-book demo) exactly as supplied, with its own README and
attribution. Its 31 + 8 Python tests and the demo checks run in `npm run verify` (`npm run test:research`).
Its large data directories are not committed; see the research catalog section above.

## Limitations

- The catalog is still a 10-book fixture; the 200-book catalog needs Person B's sourcing and human review.
- "Source-checked" means an AI assistant read the cited page; treat it as a strong first pass, not review.
- Simulations are stress scenarios, not human behavior.
- `q56` (short novel) stays inactive until "short" is defined. Adaptation-sensitive flags are a judgment call.
- Not built, per the brief: accounts, online learning, vector search, live LLM, covers, related books.
