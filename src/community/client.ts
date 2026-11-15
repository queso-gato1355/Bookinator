// Browser side of the contribution database (docs/community/DESIGN.md §5). Everything here is
// optional: without VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY the game runs exactly as before and the
// contribution UI explains that adding books is switched off. Failures never break the game.
//
// D1: contributors sign in anonymously (no account), with a CAPTCHA token when a Turnstile site key is
//     configured (Supabase Auth must have Anonymous sign-ins and the same CAPTCHA provider enabled).
// D2: nothing is sent unless the reader asked for it on that screen.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Catalog } from "../engine/model.ts";
import type { SessionPayload } from "./payload.ts";
import { DEMO_REMOTE_KEY, storeDemoContribution, validDemoContribution, type DemoContribution } from "./demo.ts";

type Env = Record<string, string | undefined>;
const env: Env = ((import.meta as unknown as { env?: Env }).env ?? {}) as Env;

export const SUPABASE_CONFIG = {
  url: env.VITE_SUPABASE_URL?.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY,
  turnstileSiteKey: env.VITE_TURNSTILE_SITE_KEY,
  /** "supabase": load the playable catalog from get_release_catalog() at startup (falls back to the bundle). */
  catalogSource: env.VITE_CATALOG_SOURCE,
};

export const contributionsEnabled = Boolean(SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey);

let clientPromise: Promise<SupabaseClient> | null = null;

/** supabase-js is loaded only when contributions are configured and actually used. */
function client(): Promise<SupabaseClient> {
  if (!contributionsEnabled) return Promise.reject(new Error("contributions are not configured"));
  clientPromise ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(SUPABASE_CONFIG.url!, SUPABASE_CONFIG.anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: "bookinator-auth" },
    }),
  );
  return clientPromise;
}

export async function isSignedIn(): Promise<boolean> {
  const c = await client();
  const { data } = await c.auth.getSession();
  return Boolean(data.session);
}

/** Anonymous sign-in (D1). Reuses an existing session; `captchaToken` is needed only the first time. */
export async function ensureSignedIn(captchaToken?: string): Promise<void> {
  const c = await client();
  const { data } = await c.auth.getSession();
  if (data.session) return;
  const { error } = await c.auth.signInAnonymously(captchaToken ? { options: { captchaToken } } : undefined);
  if (error) throw error;
}

/** Error codes raised by the submit_* functions (supabase/migrations). */
export function errorKind(e: unknown): "rate_limit" | "blocked" | "invalid" | "other" {
  const code = (e as { code?: string } | null)?.code;
  return code === "53400" ? "rate_limit" : code === "42501" ? "blocked" : code === "22023" ? "invalid" : "other";
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const c = await client();
  const { data, error } = await c.rpc(fn, args);
  if (error) throw error;
  return data as T;
}

export interface RemoteBookHit {
  kind: "book" | "submission";
  id: string;
  title: string;
  title_ko: string | null;
  author: string;
  first_publication_year: number | null;
  status: string;
  score: number;
}

export function searchBooksRemote(q: string, maxResults = 5): Promise<RemoteBookHit[]> {
  return rpc<RemoteBookHit[]>("search_books", { q, max_results: maxResults });
}

export function submitGameSession(p: SessionPayload): Promise<string> {
  return rpc<string>("submit_game_session", { p });
}

export interface NewBook {
  title: string;
  /** Optional: readers may leave it blank. */
  author?: string;
  title_ko?: string;
  origin_session_id?: string;
  confirm_not_duplicate?: boolean;
  /** Free text the reader typed about the book (what they remember). */
  reason?: string;
}

export type SubmitBookResult =
  | { status: "created"; submission_id: string; flagged_possible_duplicates?: boolean }
  | { status: "duplicate_book"; book_id: string }
  | { status: "duplicate_submission"; submission_id: string }
  | { status: "possible_duplicates"; candidates: RemoteBookHit[] };

export function submitBook(book: NewBook): Promise<SubmitBookResult> {
  return rpc<SubmitBookResult>("submit_book", { p: { kind: "new_book", ...book } });
}

export function submitFeatureAnswers(p: {
  catalog_version: string;
  book_id?: string;
  submission_id?: string;
  answers: { question_id: string; answer: string }[];
}): Promise<number> {
  return rpc<number>("submit_feature_answers", { p });
}

/** Demo additions go straight to a playable overlay, never the review queue. */
export async function saveDemoContribution(entry: DemoContribution, captchaToken?: string): Promise<"shared" | "local"> {
  if (!validDemoContribution(entry)) throw new Error("Invalid demo contribution");
  let shared = false;
  if (contributionsEnabled) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        (async () => {
          await ensureSignedIn(captchaToken);
          // A device-local demo book may not exist on the shared server yet. Resolve it by title.
          const { book_id, ...metadata } = entry;
          const published = book_id?.startsWith("demo-book:") ? metadata : entry;
          await rpc("submit_demo_contribution", { p: published });
        })(),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Shared demo timed out")), 8000); }),
      ]);
      shared = true;
    } catch (error) {
      // Auth/connection/missing migration: a demo can still learn on this device.
      // Explicit validation, blocked-user and quota errors must not be bypassed.
      if (["rate_limit", "blocked", "invalid"].includes(errorKind(error))) throw error;
    } finally { clearTimeout(timer); }
  }
  try { storeDemoContribution(entry); }
  catch (error) { if (!shared) throw error; }
  const globals = globalThis as Record<string, unknown>;
  const previous = globals[DEMO_REMOTE_KEY];
  globals[DEMO_REMOTE_KEY] = [...(Array.isArray(previous) ? previous.filter((item) => item.id !== entry.id) : []), entry];
  return shared ? "shared" : "local";
}

export async function fetchDemoContributions(version: string): Promise<DemoContribution[]> {
  if (!contributionsEnabled) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/rpc/get_demo_contributions`, {
      method: "POST", signal: controller.signal,
      headers: { apikey: SUPABASE_CONFIG.anonKey!, "Content-Type": "application/json" },
      body: JSON.stringify({ release_version: version }),
    });
    if (!response.ok) return [];
    const entries: unknown = await response.json();
    return Array.isArray(entries) ? entries.filter(validDemoContribution) : [];
  } catch { return []; }
  finally { clearTimeout(timer); }
}

/**
 * Loads a release from the database (public read, no sign-in, no supabase-js) — the same JSON the
 * bundle ships, written there by `npm run community -- sync`. Null on any problem, so callers fall
 * back to the bundled catalog.
 */
export async function fetchReleaseCatalog(version: string, timeoutMs = 4000): Promise<Catalog | null> {
  if (!contributionsEnabled) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/rpc/get_release_catalog`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_CONFIG.anonKey!,
        Authorization: `Bearer ${SUPABASE_CONFIG.anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ release_version: version }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const cat = (await res.json()) as Catalog | null;
    return cat && cat.catalog_version === version && Array.isArray(cat.books) ? cat : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
