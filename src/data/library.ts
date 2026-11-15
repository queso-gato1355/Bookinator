// The catalog pages' data: every novel in src/data/library_index.json (built by scripts/build_library_index.ts),
// plus helpers to search, filter and page through it, and to show one book's labels.
import { normalize } from "../community/search.ts";
import type { Catalog, CatalogBook } from "../engine/model.ts";
import { COLLECTIONS } from "./index.ts";
import index from "./library_index.json";

export interface LibraryEntry {
  id: string;
  rank: number | null;
  title: string;
  title_ko: string | null;
  author: string;
  year: number | null;
  lang: string | null;
  status: "playable" | "series" | "candidate";
  shelf: "research" | "classic";
  target: string | null;
  series_title: string | null;
  wiki: string | null;
  openlibrary: string | null;
  tags: string[];
}

export const LIBRARY_BOOKS = (index as unknown as { books: LibraryEntry[] }).books;
export const LIBRARY_TAGS = (index as unknown as { tags: string[] }).tags;
export const LIBRARY_COUNTS = (index as unknown as { counts: { books: number; playable: number } }).counts;
const byId = new Map(LIBRARY_BOOKS.map((b) => [b.id, b]));

export const findEntry = (id: string) => byId.get(id) ?? null;

export interface CatalogQuery {
  q: string;
  tag: string;
  status: "all" | "playable" | "candidate";
  sort: "rank" | "title";
  page: number;
}

export const PAGE_SIZE = 24;

export function queryLibrary(query: CatalogQuery, lang: "ko" | "en") {
  const q = normalize(query.q);
  let rows = LIBRARY_BOOKS.filter((b) => {
    if (query.tag && !b.tags.includes(query.tag)) return false;
    if (query.status === "playable" && b.status === "candidate") return false;
    if (query.status === "candidate" && b.status !== "candidate") return false;
    if (!q) return true;
    return [b.title, b.title_ko, b.author, b.series_title].some((s) => s && normalize(s).includes(q));
  });
  if (query.sort === "title") {
    const t = (b: LibraryEntry) => (lang === "ko" && b.title_ko) || b.title;
    rows = [...rows].sort((a, b) => t(a).localeCompare(t(b), lang));
  }
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, query.page), pages);
  return { total: rows.length, pages, page, items: rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) };
}

/** The shelf catalog that holds this book's labels (its own target, or its series). */
export function catalogFor(e: LibraryEntry): Catalog | null {
  if (!e.target) return null;
  return e.shelf === "classic" || e.target.startsWith("fx-") ? COLLECTIONS.classic.catalog : COLLECTIONS.research.catalog;
}

/** A CatalogBook-shaped view of an entry, for the description fetcher and the library links. */
export function asCatalogBook(e: LibraryEntry): CatalogBook {
  const cat = catalogFor(e);
  const own = cat?.books.find((b) => b.id === e.id);
  if (own) return own;
  return {
    id: e.id, title_en: e.title, title_ko: e.title_ko, aliases: [], author: e.author, original_language: e.lang ?? "en",
    first_publication_year: e.year, series_id: null, series_number: null, openlibrary_work_id: e.openlibrary, editions: [],
    sources: e.wiki ? [{ id: `wiki:${e.wiki}`, url: `https://en.wikipedia.org/?curid=${e.wiki}`, license: "CC-BY-SA-4.0" }] : [],
  };
}

/** Firm labels (Yes/No) of the book's game target, strongest first, for "what this book is like". */
export function factsFor(e: LibraryEntry, max = 10): { text: string; yes: boolean; status: string }[] {
  const cat = catalogFor(e);
  if (!cat || !e.target) return [];
  const q = new Map(cat.questions.filter((x) => x.active !== false).map((x) => [x.id, x.text]));
  return cat.features
    .filter((f) => f.book_id === e.target && q.has(f.question_id) && (f.p_yes >= 0.9 || f.p_yes <= 0.1))
    // Yes facts first (they describe the book), then the most telling No's; sourced labels before AI ones.
    .sort((a, b) => Number(b.p_yes > 0.5) - Number(a.p_yes > 0.5) || Number(a.status !== "supported") - Number(b.status !== "supported"))
    .slice(0, max)
    .map((f) => ({ text: q.get(f.question_id)!, yes: f.p_yes > 0.5, status: f.status }));
}

/** The most popular books (goodbooks-10k rank) that the game can find. */
export const FAMOUS_BOOKS = LIBRARY_BOOKS.filter((b) => b.rank !== null && b.status !== "candidate").slice(0, 6);
