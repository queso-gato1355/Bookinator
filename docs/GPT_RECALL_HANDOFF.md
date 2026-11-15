# Bookinator: independent GPT recall pass completed

The requested labelling pass is complete. Pull `main` and use `data/ai_recall/gpt.txt` as the second labeller. Do not restart the labelling work or paste separate batches into additional `*.txt` files: the importer treats every such file as another independent labeller.

## Delivered

| Worklist | Reviewed | Labelled | Skipped |
| --- | ---: | ---: | ---: |
| Task 1: new books | 273 | 269 | 4 |
| Task 2: independent second opinions | 219 | 219 | 0 |
| Total | 492 | 488 | 4 |

The 500-record source pool has eight form holds outside these novel worklists. These are not additional skipped novels.

- `data/ai_recall/gpt.txt`: 488 canonical book IDs and titles, 37,168 question answers. Exact requested `book_id | title | tokens` format, one book per line. Task 1 precedes Task 2 in the supplied priority order.
- `data/ai_recall/gpt_skipped.json`: the four unfamiliar books, with stable IDs and original worklist positions.
- `reports/gpt_recall_validation.json`: counts, file hashes and validation results. Also lists eight sparse entries with fewer than 40 answers; they were deliberately not padded.
- `reports/gpt_recall_adjustments.json`: final conservative audit, removing 41 uncertain cells and correcting one illness label.

The worklists and question definitions were taken from commit `7e9847a9408864b6dd78e3c1597637f1178840d8`. The final label-data commit is `4e5ee5c2b3bea8d436e4ac1df47db86b97c83d45`. Check the SHA-256 in the validation report to identify the exact delivered file.

Labels were saved to GitHub after each batch of 15 reviewed worklist rows, with smaller commits at worklist boundaries. Earlier partial files are superseded by the cumulative final file.

## Method and limits

These are answers from GPT's own novel knowledge, as requested, with Y/N for strong answers and y/n for qualified answers. Missing tokens mean unknown. No plot lookup or copying from the existing Claude labels was used. The second-opinion answers were produced without reading `data/ai_recall/labels.txt`.

All 37,168 tokens pass the current repository's actual `read_recall_file` parser. IDs and titles match the worklists; IDs and per-book question codes are unique; strengths are valid; inactive 56 and sourced-only 60–64 are absent; all 492 worklist rows are accounted for. GitHub `main` was checked against the final local label file.

This checks structure and importer compatibility, not literary accuracy. These remain `ai_recall`, with no citations and `reviewed=false`. Human-reviewed cells remain zero. Agreement between two models must not be reported as measured factual accuracy.

## Skipped for insufficient independent recall

| Book ID | Title |
| --- | --- |
| cmu:enwiki:22119663 | Hunted |
| cmu:enwiki:22105170 | Tempted |
| cmu:enwiki:24942721 | Burned |
| cmu:enwiki:33303850 | Awakened |

## Continue here

1. Pull `main`, read `CLAUDE.md`, and inspect the current importer. Preserve `labels.txt` and the single cumulative `gpt.txt` as separate independent labellers.
2. Review disagreements and sparse entries using evidence or reader knowledge. Do not force a consensus or convert unknowns into No. Keep conflicting cells unknown under the existing merge rules.
3. With the existing Core/research packs available, regenerate the catalog using `npm run catalog:research`. This runs the research merge, motifs, recall importer and real engine gate. If the external packs are missing, restore their expected locations first; do not fabricate replacements.
4. Run `npm run verify`. Then inspect the simulator CLI and rerun research simulations using the existing configuration and unchanged thresholds. Test representative books and series in the browser.
5. Report actual new playable-target and reachable-title counts, disagreement counts and simulation results. Update coverage/report documentation from those runs and commit the regenerated artifacts.

No runtime catalog regeneration, engine-gate run, full npm verification or browser playtest was performed as part of this data-only pass. Adding recall rows does not itself prove that 488 books are playable. Existing game coverage figures in `CLAUDE.md` remain prior-build figures until the catalog is rebuilt and tested.

## Prompt to resume in Claude

> Pull the latest WiseShrestha/Bookinator main and read docs/GPT_RECALL_HANDOFF.md. The independent GPT labelling pass is complete: 488 books, 37,168 answers, four explicitly skipped novels. Use data/ai_recall/gpt.txt as the second labeller without regenerating its answers. Review disagreements, rebuild the research catalog through the existing pipeline, run the real engine gate, npm run verify and research simulations, then browser-test representative books and series. Keep thresholds unchanged, preserve unknowns and unreviewed AI provenance, and report actual coverage and test results. Commit the resulting catalog/report changes.
