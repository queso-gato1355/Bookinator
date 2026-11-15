// Optional extras shown next to a book: a short sourced description, a mood photo and the
// "most found" list. All of it is fetched at runtime from the source itself (nothing is written by
// us, nothing is invented) and every failure simply returns null — the game never depends on it.
//
//   description  Wikipedia intro (exact page id from the book's own source link, CC BY-SA) or the
//                Open Library work description (exact work id). Never looked up by title guess.
//   photo        Unsplash, through the `book-image` Edge Function so the API key stays server-side.
//   popular      popular_books() RPC: how many readers confirmed each book.
import { contributionsEnabled, SUPABASE_CONFIG } from "./community/client.ts";
import type { CatalogBook } from "./engine/model.ts";

export interface BookBlurb {
  text: string;
  lang: "en" | "ko";
  sourceLabel: string;
  sourceUrl: string;
}

export interface BookImage {
  url: string;
  alt: string | null;
  photographer: string;
  photographer_url: string;
  photo_url: string;
}

export interface PopularBook {
  book_id: string;
  found_count: number;
}

const memo = new Map<string, Promise<unknown>>();
function once<T>(key: string, load: () => Promise<T | null>): Promise<T | null> {
  let p = memo.get(key) as Promise<T | null> | undefined;
  if (!p) {
    p = load().catch(() => null);
    memo.set(key, p);
  }
  return p;
}

async function getJson(url: string, init?: RequestInit, timeoutMs = 6000): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Plain text, at most `max` characters, cut at a sentence end when there is one. */
export function trimBlurb(raw: string, max = 420): string | null {
  const text = raw
    .split(/\n-{3,}|\(\[source\]|\[source\]/i)[0]
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_#>`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < 40) return null;
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  return end > max * 0.5 ? cut.slice(0, end + 1) : `${cut.replace(/\s+\S*$/, "")}…`;
}

/** Books a reader can reach: every single-book target plus every volume of a series target. */
export function titleCount(catalog: { books: unknown[]; coverage?: { titles_reachable?: number } }): number {
  return catalog.coverage?.titles_reachable ?? catalog.books.length;
}

/** A series target's volume as a displayable book: its own title and, when the id names it, its own source. */
export function volumeBook(series: CatalogBook, v: NonNullable<CatalogBook["volumes"]>[number]): CatalogBook {
  const pageId = /^cmu:enwiki:(\d+)$/.exec(v.id)?.[1];
  const own = pageId ? series.sources.filter((s) => s.url === `https://en.wikipedia.org/?curid=${pageId}`) : [];
  return { ...series, id: v.id, title_en: v.title, title_ko: null, aliases: [], volumes: undefined, series_id: series.id, series_number: v.number,
    openlibrary_work_id: null, editions: [], sources: own.length ? own : series.sources };
}

/** Read the stored work's Wikipedia article, resolving other languages through that article's links.
 * Open Library descriptions have no dependable language tag, so they are never labelled as English.
 */
export function fetchBlurb(book: CatalogBook, lang: "en" | "ko" = "en"): Promise<BookBlurb | null> {
  return once(`blurb:${book.id}:${lang}`, async () => {
    if (book.volumes) return null;
    const source = book.sources.find((s) => /^https:\/\/en\.wikipedia\.org\/(?:wiki\/|\?curid=)/.test(s.url));
    if (!source) return null;
    const url = new URL(source.url);
    const id = url.searchParams.get("curid");
    const title = id ? null : decodeURIComponent(url.pathname.replace(/^\/wiki\//, ""));
    const params = new URLSearchParams({ action: "query", format: "json", origin: "*", prop: "extracts|langlinks", exintro: "1", explaintext: "1", exsentences: "3", redirects: "1", lllang: lang });
    if (id) params.set("pageids", id); else if (title) params.set("titles", title); else return null;
    type Page = { pageid?: number; extract?: string; langlinks?: { lang: string; "*": string }[] };
    type Response = { query?: { pages?: Record<string, Page> } };
    const enData = await getJson(`https://en.wikipedia.org/w/api.php?${params}`) as Response;
    const page = Object.values(enData.query?.pages ?? {})[0];
    if (!page) return null;
    if (lang === "en") {
      const text = trimBlurb(page.extract ?? "");
      return text ? { text, lang, sourceLabel: "Wikipedia (CC BY-SA)", sourceUrl: source.url } : null;
    }
    const translated = page.langlinks?.find((link) => link.lang === lang)?.["*"];
    if (!translated) return null;
    params.delete("pageids"); params.delete("lllang"); params.set("titles", translated); params.set("prop", "extracts");
    const data = await getJson(`https://${lang}.wikipedia.org/w/api.php?${params}`) as Response;
    const localized = Object.values(data.query?.pages ?? {})[0];
    const text = trimBlurb(localized?.extract ?? "");
    return text ? { text, lang, sourceLabel: "Wikipedia (CC BY-SA)", sourceUrl: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(translated)}` } : null;
  });
}

export function fetchCover(book: CatalogBook): Promise<{ url: string } | null> {
  return once(`cover:${book.id}`, async () => {
    if (book.volumes || !book.openlibrary_work_id || !/^OL\d+W$/.test(book.openlibrary_work_id)) return null;
    const data = await getJson(`https://openlibrary.org/works/${book.openlibrary_work_id}.json`) as { covers?: number[] };
    const id = data.covers?.find((n) => Number.isSafeInteger(n) && n > 0);
    return id ? { url: `https://covers.openlibrary.org/b/id/${id}-L.jpg?default=false` } : null;
  });
}

export function displayLanguage(code: string, lang: "en" | "ko"): string {
  try { return new Intl.DisplayNames([lang], { type: "language" }).of(code) ?? code; }
  catch { return code; }
}

const PHOTO_CACHE = "bookinator-photo:";
const PHOTO_TTL_MS = 7 * 24 * 3600 * 1000;

/**
 * One Unsplash photo for a search phrase, through the `book-image` Edge Function (the key stays
 * server-side). Cached in localStorage for a week: the Unsplash demo key allows only 50 requests an hour.
 */
export function fetchPhoto(query: string): Promise<BookImage | null> {
  const q = query.trim().slice(0, 80);
  return once(`photo:${q}`, async () => {
    if (!contributionsEnabled || q.length < 2) return null;
    try {
      const saved = JSON.parse(window.localStorage.getItem(PHOTO_CACHE + q) ?? "null") as { at: number; img: BookImage | null } | null;
      if (saved && Date.now() - saved.at < PHOTO_TTL_MS) return saved.img;
    } catch {
      /* storage unavailable */
    }
    const data = (await getJson(`${SUPABASE_CONFIG.url}/functions/v1/book-image?q=${encodeURIComponent(q)}`)) as {
      image?: BookImage | null;
      reason?: string;
    };
    const img = data.image;
    // Only Unsplash-hosted images and links are ever rendered.
    const ok =
      img &&
      img.url.startsWith("https://images.unsplash.com/") &&
      img.photographer_url.startsWith("https://unsplash.com/") &&
      img.photo_url.startsWith("https://unsplash.com/");
    // Remember "no photo" only when Unsplash really had none (not on a rate-limit or outage).
    if (ok || data.reason === "no_result") {
      try {
        window.localStorage.setItem(PHOTO_CACHE + q, JSON.stringify({ at: Date.now(), img: ok ? img : null }));
      } catch {
        /* storage unavailable */
      }
    }
    return ok ? img : null;
  });
}

/** A mood photo for a book: searched by its English title. */
export function fetchImage(book: CatalogBook): Promise<BookImage | null> {
  return fetchPhoto(book.title_en);
}

export interface LibraryLoan {
  title: string;
  author: string;
  loans: number | null;
}

/** Most-borrowed literature in Korean public libraries (Data4Library, via the Edge Function). */
export function fetchLibraryPopular(limit = 5): Promise<LibraryLoan[] | null> {
  return once("library-popular", async () => {
    if (!contributionsEnabled) return null;
    const data = (await getJson(`${SUPABASE_CONFIG.url}/functions/v1/library-popular`, undefined, 9000)) as { books?: LibraryLoan[] };
    if (!Array.isArray(data.books)) return null;
    return data.books
      .filter((b) => typeof b.title === "string" && b.title)
      .slice(0, limit)
      .map((b) => ({ title: b.title, author: typeof b.author === "string" ? b.author : "", loans: Number(b.loans) || null }));
  });
}

export function fetchPopular(catalogVersion: string, limit = 5): Promise<PopularBook[] | null> {
  return once(`popular:${catalogVersion}`, async () => {
    if (!contributionsEnabled) return null;
    const rows = (await getJson(
      `${SUPABASE_CONFIG.url}/rest/v1/rpc/popular_books`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_CONFIG.anonKey!,
          Authorization: `Bearer ${SUPABASE_CONFIG.anonKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ release_version: catalogVersion, max_results: limit }),
      },
      4000,
    )) as PopularBook[];
    return Array.isArray(rows) ? rows.map((r) => ({ book_id: String(r.book_id), found_count: Number(r.found_count) })) : null;
  });
}
