// Turns a finished game into the submit_game_session payload (supabase/migrations/…). Pure, so the
// exact data that leaves the browser is unit-tested: only answers, outcome and book ids — no free text.
import type { Answer, CompiledCatalog } from "../engine/model.ts";
import type { SessionState, Session } from "../engine/session.ts";

/** Version of the consent text shown before sending (D2). Bump it whenever that text changes. */
export const CONSENT_VERSION = "2026-11-14-v1";

export type SessionOutcome = "found_guess" | "found_shortlist" | "no_match_exit" | "no_match_all_rejected";

export interface SessionPayload {
  catalog_version: string;
  film_memory_mode: boolean;
  outcome: SessionOutcome;
  confirmed_book_id: string | null;
  identified_book_id: string | null;
  rejected_book_ids: string[];
  consent_version: string;
  answers: { question_id: string; answer: Answer }[];
}

export function outcomeOf(state: SessionState): SessionOutcome | null {
  const a = state.action;
  if (a.kind === "found") return a.via === "guess" ? "found_guess" : "found_shortlist";
  if (a.kind === "no_match") return a.reason === "user_exit" ? "no_match_exit" : "no_match_all_rejected";
  return null;
}

/**
 * Null when the game has not ended or nothing was answered.
 * `identifiedBookId`: a book from this catalog the reader named after a miss.
 */
export function sessionPayload(
  cc: CompiledCatalog,
  session: Session,
  state: SessionState,
  identifiedBookId: string | null = null,
): SessionPayload | null {
  const outcome = outcomeOf(state);
  if (!outcome || state.answers.length === 0) return null;
  const found = state.action.kind === "found" ? state.action.book.id : null;
  if (identifiedBookId !== null && (found !== null || !cc.bookIndex.has(identifiedBookId))) return null;
  return {
    catalog_version: cc.catalog.catalog_version,
    film_memory_mode: session.options.filmMemoryMode,
    outcome,
    confirmed_book_id: found,
    identified_book_id: identifiedBookId,
    rejected_book_ids: [...state.rejected].map((i) => cc.books[i].id),
    consent_version: CONSENT_VERSION,
    answers: state.answers.map((a) => ({ question_id: cc.questions[a.questionIndex].id, answer: a.answer })),
  };
}
