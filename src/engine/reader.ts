// Reader-facing summaries of the existing engine. No probability is presented as accuracy.
import type { CompiledCatalog } from "./model.ts";
import type { Session, SessionState } from "./session.ts";

/** Smallest leading set carrying 90% of current search weight; never eliminates a book. */
export function leadingMatchCount(state: Pick<SessionState, "p" | "ranked">): number {
  if (!state.p) return 0;
  let mass = 0;
  for (let i = 0; i < state.ranked.length; i++) {
    mass += state.p[state.ranked[i]];
    if (mass >= 0.9 - 1e-12) return i + 1;
  }
  return state.ranked.length;
}

/** Rewind to just before a particular answer, dropping subsequent dependent events. */
export function rewindToAnswer(session: Session, answerIndex: number): Session {
  if (!Number.isInteger(answerIndex) || answerIndex < 0) return session;
  let seen = 0;
  const at = session.events.findIndex((event) => event.type === "answer" && seen++ === answerIndex);
  return at < 0 ? session : { ...session, events: session.events.slice(0, at) };
}

/** Strong catalog labels disagreeing with remembered details; uncertainty remains neutral. */
export function conflictingAnswers(cc: CompiledCatalog, bookIndex: number, state: SessionState) {
  return state.answers.filter(({ questionIndex, answer }) => {
    const x = cc.x[questionIndex][bookIndex];
    return ((answer === "yes" || answer === "probably") && x <= 0.3) ||
      ((answer === "no" || answer === "probably_not") && x >= 0.7);
  }).slice(0, 3);
}
