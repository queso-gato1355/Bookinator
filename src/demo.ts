// A reproducible question order for a live audience round. No target title enters the session.
export const DEMO_SEED = 12;
export const DEMO_BOOK_IDS = ["fx-harry-potter-1", "fx-the-hobbit", "fx-murder-orient-express"] as const;

export function isDemoMode(search = (globalThis as { location?: { search: string } }).location?.search ?? ""): boolean {
  const params = new URLSearchParams(search);
  return params.get("demo") === "1" && params.get("collection") === "classic";
}

export function demoHref(href = (globalThis as { location?: { href: string } }).location?.href ?? "http://localhost/"): string {
  const url = new URL(href);
  url.searchParams.set("collection", "classic");
  url.searchParams.set("demo", "1");
  return url.pathname + url.search + "#live-challenge";
}
