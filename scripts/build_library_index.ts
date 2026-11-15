// Builds src/data/library_index.json: every novel the project learned from, for the "자료 찾기" (catalog) pages.
//
//   npx tsx scripts/build_library_index.ts      (npm run library:index)
//
// Sources, nothing invented:
//   * data/cmu/coverage_report.json  — the research pool (CMU Book Summary Corpus × goodbooks-10k), with the
//                                      goodbooks popularity rank and whether the game can find each record
//   * src/data/cmu.catalog.json      — labels of the playable research targets (series volumes use the series)
//   * src/data/fixture.catalog.json  — the classic shelf (Korean titles, years, Open Library ids)
// Tags are DERIVED from labels the engine already uses (p_yes ≥ 0.7 on a question with that meaning), matched by
// question TEXT because the two shelves use different question ids.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Catalog } from "../src/engine/model.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = <T>(p: string) => JSON.parse(readFileSync(resolve(ROOT, p), "utf8")) as T;
const cmu = read<Catalog>("src/data/cmu.catalog.json");
const fixture = read<Catalog>("src/data/fixture.catalog.json");
const report = read<{ records: { rank: number; id: string; title: string; authors: string[]; playable: boolean; reason: string | null; series?: string }[] }>(
  "data/cmu/coverage_report.json",
);

/** tag id → regex on the English question text (both banks). */
const TAG_RULES: Record<string, RegExp> = {
  fantasy: /prominently involve magic|mainly set in an invented world/i,
  sf: /space travel is part|space travel part|set in an imagined future/i,
  mystery: /solving a crime a main storyline/i,
  romance: /romantic relationship a main storyline/i,
  coming_of_age: /focus on growing up/i,
  war: /real historical war a major part/i,
  dystopia: /large disaster already changed society/i,
  horror: /intended to be frightening/i,
  humor: /humor a major part/i,
  sea: /aboard a ship or at sea/i,
  family: /conflict within a family a main storyline/i,
  friendship: /strongly focus on friendship/i,
  journey: /long journey a main storyline/i,
  survival: /surviving physical danger a main storyline/i,
  school: /school a major setting/i,
  classic_era: /most of the story set before 1900/i,
  animals: /animals that speak or behave like people/i,
  loneliness: /loneliness or isolation/i,
  grief: /grief or loss/i,
  philosophy: /moral or philosophical questions/i,
  korean: /originally written in Korean/i,
  japanese: /originally written in Japanese/i,
  series: /part of a named series/i,
};

function tagsOf(cat: Catalog, bookId: string): string[] {
  const q = new Map(cat.questions.map((x) => [x.id, x.text]));
  const tags = new Set<string>();
  for (const f of cat.features) {
    if (f.book_id !== bookId || f.p_yes < 0.7) continue;
    const text = q.get(f.question_id) ?? "";
    for (const [tag, re] of Object.entries(TAG_RULES)) if (re.test(text)) tags.add(tag);
  }
  return [...tags].sort();
}

const norm = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/^(the|a|an) /, "");

export interface LibraryEntry {
  id: string;
  rank: number | null;
  title: string;
  title_ko: string | null;
  author: string;
  year: number | null;
  lang: string | null;
  /** playable: the game can find it · series: found as a volume of a series target · candidate: imported, not yet findable */
  status: "playable" | "series" | "candidate";
  shelf: "research" | "classic";
  /** The book (or series) id in that shelf's catalog, for its labels and links. */
  target: string | null;
  series_title: string | null;
  wiki: string | null;
  openlibrary: string | null;
  tags: string[];
}

const cmuById = new Map(cmu.books.map((b) => [b.id, b]));
const entries: LibraryEntry[] = [];
for (const r of report.records) {
  if (r.id.startsWith("series:")) continue; // a series is listed through its volumes
  const own = cmuById.get(r.id);
  const seriesId = r.series ?? (/part of series target (series:[^\s]+)/.exec(r.reason ?? "")?.[1] ?? null);
  const series = seriesId ? cmuById.get(seriesId) : undefined;
  const status: LibraryEntry["status"] = own ? "playable" : series ? "series" : "candidate";
  const target = own ? own.id : series ? series.id : null;
  entries.push({
    id: r.id,
    rank: r.rank,
    title: r.title,
    title_ko: own?.title_ko ?? null,
    author: r.authors.join(", "),
    year: own?.first_publication_year ?? null,
    lang: own?.original_language ?? series?.original_language ?? null,
    status,
    shelf: "research",
    target,
    series_title: series?.title_en.replace(/ series$/i, "") ?? null,
    wiki: /^cmu:enwiki:(\d+)$/.exec(r.id)?.[1] ?? null,
    openlibrary: own?.openlibrary_work_id ?? null,
    tags: target ? tagsOf(cmu, target) : [],
  });
}

// Classic shelf: merge into the research record of the same book, else add it.
for (const b of fixture.books) {
  const key = norm(b.title_en) + "|" + norm(b.author).split(" ").pop();
  const same = entries.find((e) => norm(e.title) + "|" + norm(e.author).split(" ").pop() === key);
  const classicTags = tagsOf(fixture, b.id);
  if (same) {
    same.title_ko ??= b.title_ko;
    same.year ??= b.first_publication_year;
    same.lang ??= b.original_language;
    same.openlibrary ??= b.openlibrary_work_id;
    if (same.status === "candidate") { same.status = "playable"; same.shelf = "classic"; same.target = b.id; }
    same.tags = [...new Set([...same.tags, ...classicTags])].sort();
  } else {
    entries.push({
      id: b.id, rank: null, title: b.title_en, title_ko: b.title_ko, author: b.author, year: b.first_publication_year,
      lang: b.original_language, status: "playable", shelf: "classic", target: b.id, series_title: null,
      wiki: b.sources.map((s) => /curid=(\d+)/.exec(s.url)?.[1]).find(Boolean) ?? null,
      openlibrary: b.openlibrary_work_id, tags: classicTags,
    });
  }
}

entries.sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9) || a.title.localeCompare(b.title));
const counts = { books: entries.length, playable: entries.filter((e) => e.status !== "candidate").length,
  tagged: entries.filter((e) => e.tags.length).length };
writeFileSync(resolve(ROOT, "src/data/library_index.json"), JSON.stringify({
  notice: "Generated by scripts/build_library_index.ts from the research pool and both shelves. Tags are derived from labels (unreviewed).",
  rank_source: "goodbooks-10k historical popularity (number of ratings), via the research pack's priority ranking",
  counts, tags: Object.keys(TAG_RULES), books: entries,
}) + "\n");
console.log(JSON.stringify(counts), "tag use:", JSON.stringify(Object.fromEntries(Object.keys(TAG_RULES).map((t) => [t, entries.filter((e) => e.tags.includes(t)).length]))));
