// Playability gate that uses the real game engine (the same module as the UI).
//
//   npx tsx scripts/gate_catalog.ts [--catalog src/data/cmu.catalog.json] [--report data/cmu/coverage_report.json]
//
// Input: a catalog built with `build_cmu_catalog.py --gate none` (every in-scope candidate).
// A book is PLAYABLE when a reader who answers exactly what its own labels say — Yes for labels
// above 0.5, No below, "Don't know" for unknown cells, no hedging, no mistakes — gets it as the
// engine's FIRST guess, with the unchanged thresholds in src/engine/config.ts.
//
// That is a necessary condition, not a success rate: a book the engine cannot find even from
// its own perfect answers can never be found by a person. The gate removes failing books in
// rounds (lowest priority first) because every removal changes the other games, and repeats
// until every remaining book passes. Removed books stay imported and labelled; the coverage
// report says why each one is not playable. Run the simulator afterwards for noisy scenarios.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { makeConfig } from "../src/engine/config.ts";
import { compileCatalog, type Catalog } from "../src/engine/model.ts";
import { mulberry32, playGame, type Scenario } from "./simulate.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PERFECT: Scenario = { name: "own_labels", description: "answers exactly the labels", unknownRate: 0, wrongRate: 0, hedgeRate: 0 };
const REMOVE_SHARE = 0.25;

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

interface CoverageRow { id: string; rank: number; playable: boolean; reason: string | null }

function main() {
  const catalogPath = resolve(ROOT, arg("catalog", "src/data/cmu.catalog.json"));
  const reportPath = resolve(ROOT, arg("report", "data/cmu/coverage_report.json"));
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8")) as Catalog & { coverage: Record<string, number>; notice: string };
  const report = JSON.parse(readFileSync(reportPath, "utf8")) as { counts: Record<string, number>; status_breakdown: Record<string, number>; gate: Record<string, unknown>; records: CoverageRow[] };
  const config = makeConfig();
  const rank = new Map(report.records.map((r) => [r.id, r.rank]));

  const featuresOf = new Map<string, Catalog["features"]>();
  for (const f of catalog.features) {
    if (!featuresOf.has(f.book_id)) featuresOf.set(f.book_id, []);
    featuresOf.get(f.book_id)!.push(f);
  }
  const compile = (bs: Catalog["books"]) =>
    compileCatalog({ ...catalog, books: bs, features: bs.flatMap((b) => featuresOf.get(b.id) ?? []) }, config.channel, config.unknownPYes);
  const own = (cc: ReturnType<typeof compile>, i: number) => playGame(cc, config, cc.x, i, PERFECT, mulberry32(1), false, true, true);
  const started = Date.now();

  // Phase 1 (seed): remove failing books in rounds, lowest priority first, until all remaining pass.
  // A one-book catalog gives the engine nothing to ask, so forward selection needs this seed.
  let books = catalog.books.slice();
  const removed = new Map<string, string>();
  for (let round = 1; books.length; round++) {
    const cc = compile(books);
    const failed: { id: string; why: string }[] = [];
    cc.books.forEach((b, i) => {
      const r = own(cc, i);
      if (r.outcome !== "first_guess") {
        failed.push({ id: b.id, why: r.wrongGuesses.length ? `engine guessed ${cc.books[r.wrongGuesses[0]].title_en} first`
          : `engine never became confident (shortlist after ${r.questions} questions)` });
      }
    });
    if (failed.length === 0) break;
    failed.sort((a, b) => (rank.get(b.id) ?? 0) - (rank.get(a.id) ?? 0));
    const drop = failed.slice(0, Math.max(1, Math.ceil(failed.length * REMOVE_SHARE)));
    for (const d of drop) removed.set(d.id, d.why);
    const dropIds = new Set(drop.map((d) => d.id));
    books = books.filter((b) => !dropIds.has(b.id));
  }
  console.log(`seed: ${books.length} books`);

  // Phase 2 (forward): retry every removed book in priority order. It joins only if, with it
  // added, it AND every book already admitted are still found as the first guess.
  const retry = catalog.books.filter((b) => removed.has(b.id)).sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
  for (const cand of retry) {
    const trial = [...books, cand];
    const cc = compile(trial);
    let why: string | null = null;
    for (let i = cc.books.length - 1; i >= 0 && !why; i--) {
      const r = own(cc, i);
      if (r.outcome === "first_guess") continue;
      const other = r.wrongGuesses.length ? cc.books[r.wrongGuesses[0]].title_en : null;
      why = i === cc.books.length - 1
        ? other ? `engine guessed ${other} first` : `engine never became confident (shortlist after ${r.questions} questions)`
        : `adding it stops the engine finding ${cc.books[i].title_en}`;
    }
    if (why) removed.set(cand.id, why);
    else { books = trial; removed.delete(cand.id); }
  }
  console.log(`after forward pass: ${books.length} books`);
  const keep = new Set(books.map((b) => b.id));
  catalog.books = books;
  catalog.features = catalog.features.filter((f) => keep.has(f.book_id));
  for (const r of report.records) {
    if (removed.has(r.id)) {
      r.playable = false;
      r.reason = `engine gate: ${removed.get(r.id)} when answering from its own labels`;
    }
  }
  const playable = books.length;
  const breakdown: Record<string, number> = {};
  for (const r of report.records) {
    const k = r.playable ? "playable" : r.reason?.startsWith("engine gate") ? "not identifiable by the engine from its own labels"
      : r.reason?.startsWith("form hold") ? "form hold (not a novel)"
      : r.reason?.startsWith("part of series") ? "grouped into a series target" : r.reason?.startsWith("only") ? "too few supported cells" : (r.reason ?? "other");
    breakdown[k] = (breakdown[k] ?? 0) + 1;
  }
  report.status_breakdown = breakdown;
  report.counts.playable_game_targets = playable;
  // A series target covers its volumes: the reader picks the volume from a list after the series is found.
  const titles = books.reduce((n, b) => n + (((b as { volumes?: unknown[] }).volumes?.length) ?? 1), 0);
  (report.counts as Record<string, number>).titles_reachable = titles;
  (catalog.coverage as Record<string, number>).titles_reachable = titles;
  report.gate = { ...report.gate, engine: "first guess when answering exactly from own labels (scripts/gate_catalog.ts); thresholds unchanged" };
  catalog.coverage.playable_game_targets = playable;
  const titlesNow = books.reduce((n, b) => n + (((b as { volumes?: unknown[] }).volumes?.length) ?? 1), 0);
  catalog.notice = catalog.notice.replace(/tell apart \d+ of them/,
    `tell apart ${playable} targets covering ${titlesNow} titles (a series counts once; you pick the volume)`);
  writeFileSync(catalogPath, JSON.stringify(catalog) + "\n");
  writeFileSync(reportPath, JSON.stringify(report, null, 1) + "\n");
  console.log(`titles reachable: ${titles}`);
  console.log(`playable: ${playable}; removed by the engine gate: ${removed.size} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
}

main();
