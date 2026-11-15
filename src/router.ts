// Tiny hash router (no dependency): "#/catalog?q=…&page=2", "#/book/<id>", "#/leaderboard", "#/programs",
// "#/guide", "#/about". Hash URLs work on any static host (Vercel, GitHub Pages) without rewrite rules, and the
// game's own state is untouched by navigation.
import { useEffect, useState } from "react";
import { parseRoute, type Route } from "./route.ts";

export { href, parseRoute, type Page, type Route } from "./route.ts";

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
