// Tiny hash router (no dependency): "#/catalog?q=…&page=2", "#/book/<id>", "#/leaderboard", "#/programs",
// "#/guide", "#/about". Hash URLs work on any static host (Vercel, GitHub Pages) without rewrite rules, and the
// game's own state is untouched by navigation.
import { useEffect, useState } from "react";

export type Page = "home" | "catalog" | "book" | "leaderboard" | "programs" | "guide" | "about";

export interface Route {
  page: Page;
  /** Book id for "book". */
  id: string | null;
  params: URLSearchParams;
}

const PAGES: readonly Page[] = ["home", "catalog", "book", "leaderboard", "programs", "guide", "about"];

export function parseRoute(hash: string): Route {
  const h = hash.replace(/^#\/?/, "");
  const [path, query = ""] = h.split("?");
  const [head, ...rest] = path.split("/").filter(Boolean);
  const page = (PAGES as readonly string[]).includes(head ?? "") ? (head as Page) : "home";
  let id: string | null = null;
  if (page === "book" && rest.length) {
    try {
      id = decodeURIComponent(rest.join("/"));
    } catch {
      id = null;
    }
  }
  return { page, id, params: new URLSearchParams(query) };
}

export function href(page: Page, opts: { id?: string; params?: Record<string, string | number | undefined> } = {}): string {
  if (page === "home") return "#/";
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(opts.params ?? {})) if (v !== undefined && v !== "") q.set(k, String(v));
  const qs = q.toString();
  return `#/${page}${opts.id ? `/${encodeURIComponent(opts.id)}` : ""}${qs ? `?${qs}` : ""}`;
}

export function navigate(to: string): void {
  if (window.location.hash !== to) window.location.hash = to;
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parseRoute(window.location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}
