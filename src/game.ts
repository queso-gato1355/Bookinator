// Wires the active catalog + config into a compiled engine for the UI.
import { ACTIVE_CATALOG, refreshActiveCatalog } from "./data/index.ts";
import { makeConfig, questionBankSize } from "./engine/config.ts";
import { compileCatalog } from "./engine/model.ts";
import { isDemoMode } from "./demo.ts";
import type { Session } from "./engine/session.ts";

export let CONFIG = makeConfig({ maxQuestions: questionBankSize(ACTIVE_CATALOG) });
export let CC = compileCatalog(ACTIVE_CATALOG, CONFIG.channel, CONFIG.unknownPYes);

export function refreshGameCatalog(): void {
  const catalog = refreshActiveCatalog();
  CONFIG = makeConfig({ maxQuestions: questionBankSize(catalog) });
  CC = compileCatalog(catalog, CONFIG.channel, CONFIG.unknownPYes);
}

type Env = Record<string, string | undefined>;
const env: Env = ((import.meta as unknown as { env?: Env }).env ?? {}) as Env;
export const LINK_OPTIONS = {
  localSearchTemplate: env.VITE_LOCAL_LIBRARY_SEARCH_URL,
  localSearchLabel: env.VITE_LOCAL_LIBRARY_LABEL,
};

export const AVAILABILITY = {
  proxyUrl: env.VITE_LIBRARY_PROXY_URL,
  libCode: env.VITE_LIBRARY_CODE,
  libName: env.VITE_LIBRARY_NAME,
};

// Session persistence is a light convenience only: it may be unavailable or empty.
const STORAGE_KEY = `that-book-session:${ACTIVE_CATALOG.catalog_version}${isDemoMode() ? ":demo" : ""}`;

export function loadSession(): Session | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!Array.isArray(parsed.events) || typeof parsed.options !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session: Session | null): void {
  try {
    if (session) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable — the game still works */
  }
}
