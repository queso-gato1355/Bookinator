// Pure part of the hash router (no DOM): route parsing and link building. Hook and navigation: ./router.ts.
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

