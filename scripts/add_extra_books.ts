// Adds the books that teammates' AI labellers answered OUTSIDE the 500-record research pool
// (data/ai_recall/extra/<labeller>_new_books.json, written by import_ai_labels.ts) to the research catalog
// as new single-book targets. Idempotent: earlier "ai:" books and their cells are removed first.
//
//   npx tsx scripts/add_extra_books.ts   # then add_signature_questions.ts, then gate_catalog.ts
//
// Rules
//   * labellers disagree on a cell -> no cell (unknown); agree -> the stronger value (same as apply_ai_recall.ts)
//   * every cell: status ai_recall, no source, reviewed=false; books get NO sources, ISBNs or Open Library ids
//   * skipped: books without an original language (never guessed), books whose title already names a target
//     by the same author (e.g. a subtitle variant), and books by an author who has a SERIES target (a volume of
//     a series must not become a rival target of its own series)
//   * books then go through the unchanged engine gate like every other target.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Catalog, CatalogBook, CatalogFeature } from "../src/engine/model.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EXTRA = resolve(ROOT, "data/ai_recall/extra");
const catalogPath = resolve(ROOT, "src/data/cmu.catalog.json");

interface Extra { key: string; title: string; author: string; first_publication_year: number | null; original_language: string | null; answers: Record<string, number> }

const norm = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/\([^)]*\)/g, " ").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/^(the|a|an) /, "");
const surnames = (a: string) => norm(a).split(" ").filter((t) => t.length > 2);
const slug = (s: string) => norm(s).replace(/ /g, "-").slice(0, 60);

const catalog = JSON.parse(readFileSync(catalogPath, "utf8")) as Catalog;
catalog.books = catalog.books.filter((b) => !b.id.startsWith("ai:"));
catalog.features = catalog.features.filter((f) => !f.book_id.startsWith("ai:"));
const qids = new Set(catalog.questions.map((q) => q.id));

// merge labellers
const merged = new Map<string, Extra & { from: string[]; cells: Map<string, number> }>();
for (const f of readdirSync(EXTRA).filter((x) => x.endsWith("_new_books.json")).sort()) {
  const who = f.replace(/_new_books\.json$/, "");
  for (const e of (JSON.parse(readFileSync(resolve(EXTRA, f), "utf8")) as { books: Extra[] }).books) {
    let m = merged.get(e.key);
    if (!m) { m = { ...e, from: [], cells: new Map() }; merged.set(e.key, m); }
    m.from.push(who);
    for (const [q, v] of Object.entries(e.answers)) {
      if (!qids.has(q) || /^s\d{2}$/.test(q)) continue;
      const old = m.cells.get(q);
      if (old === undefined) m.cells.set(q, v);
      else if (Number.isNaN(old)) continue;
      else if ((old - 0.5) * (v - 0.5) < 0) m.cells.set(q, NaN);
      else if (Math.abs(v - 0.5) > Math.abs(old - 0.5)) m.cells.set(q, v);
    }
  }
}

const seriesAuthors = new Set(catalog.books.filter((b) => b.volumes).flatMap((b) => surnames(b.author)));
const existing = catalog.books.map((b) => ({ titles: [b.title_en, ...b.aliases, ...(b.volumes ?? []).map((v) => v.title)].map(norm), authors: surnames(b.author) }));
const skipped: Record<string, string[]> = { no_language: [], already_a_target: [], series_author: [], too_few_answers: [] };
const added: CatalogBook[] = [];
const ids = new Set<string>();
for (const e of merged.values()) {
  const label = `${e.title} — ${e.author}`;
  if (!e.original_language) { skipped.no_language.push(label); continue; }
  const t = norm(e.title), a = surnames(e.author);
  if (existing.some((x) => x.authors.some((s) => a.includes(s)) && x.titles.some((y) => y && (y === t || y.startsWith(t + " ") || t.startsWith(y + " "))))) { skipped.already_a_target.push(label); continue; }
  if (a.some((s) => seriesAuthors.has(s))) { skipped.series_author.push(label); continue; }
  const cells = [...e.cells].filter(([, v]) => !Number.isNaN(v));
  if (cells.length < 12) { skipped.too_few_answers.push(label); continue; }
  let id = `ai:${slug(e.title)}--${slug(a.at(-1) ?? "unknown")}`;
  for (let n = 2; ids.has(id); n++) id = `${id}-${n}`;
  ids.add(id);
  added.push({ id, title_en: e.title, title_ko: null, aliases: [], author: e.author, original_language: e.original_language,
    first_publication_year: e.first_publication_year, series_id: null, series_number: null, openlibrary_work_id: null,
    editions: [], sources: [] } as CatalogBook);
  for (const [q, v] of cells) catalog.features.push({ book_id: id, question_id: q, p_yes: v, status: "ai_recall", source_ids: [], reviewed: false } as CatalogFeature);
}
catalog.books.push(...added);
const summary = { books_in_extra_files: merged.size, added: added.length, skipped: Object.fromEntries(Object.entries(skipped).map(([k, v]) => [k, v.length])) };
(catalog as Catalog & { extra_books?: unknown }).extra_books = { ...summary,
  note: "Books from teammates' AI labellers outside the research pool (scripts/add_extra_books.ts): AI general knowledge only, no source, not reviewed." };
writeFileSync(catalogPath, JSON.stringify(catalog) + "\n");
writeFileSync(resolve(ROOT, "data/ai_recall/extra/added_books_report.json"), JSON.stringify({ ...summary, skipped_books: skipped }, null, 1) + "\n");
console.log(JSON.stringify(summary));
