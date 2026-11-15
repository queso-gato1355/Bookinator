// Session state machine: guess, rejection, undo, limits, shortlist and no-match.
//
// A session is just an append-only list of events. Every derived value (posterior,
// next action) is recomputed by replaying all events from the original uniform
// prior, so Undo is "drop the last event" and replay is exact and deterministic.

import type { EngineConfig } from "./config.ts";
import type { Answer, CatalogBook, CatalogQuestion, CompiledCatalog } from "./model.ts";
import { computePosterior, rankBooks, type AnsweredQuestion } from "./posterior.ts";
import { pickBest, pickVaried, scoreQuestions } from "./selectQuestion.ts";

export type SessionEvent =
  | { type: "answer"; questionId: string; answer: Answer }
  | { type: "reject"; bookId: string }
  | { type: "accept"; bookId: string }
  | { type: "suggest" } // reader explicitly asks for a tentative best guess
  | { type: "exit" }; // "My book isn't in this collection"

export interface SessionOptions {
  /** User mainly remembers the film/series: skip adaptation-sensitive questions. */
  filmMemoryMode: boolean;
  /** Per-game seed for question variety (src/engine/selectQuestion.ts pickVaried). Absent = fixed order. */
  seed?: number;
}

export interface Session {
  events: SessionEvent[];
  options: SessionOptions;
}

export type ShortlistReason = "rejections" | "question_cap" | "no_questions" | "low_information";

export type Action =
  | {
      kind: "ask";
      question: CatalogQuestion;
      questionIndex: number;
      ig: number;
      score: number;
      /** 1-based number of the question about to be asked. */
      number: number;
    }
  /** tentative: an Akinator-style check-in (most likely so far, not yet confident). */
  | { kind: "guess"; book: CatalogBook; bookIndex: number; tentative?: boolean }
  | { kind: "shortlist"; books: CatalogBook[]; bookIndices: number[]; reason: ShortlistReason }
  | { kind: "no_match"; reason: "all_rejected" | "user_exit" }
  | { kind: "found"; book: CatalogBook; bookIndex: number; via: "guess" | "shortlist" };

export interface SessionState {
  answers: AnsweredQuestion[];
  rejected: Set<number>;
  rejectionCount: number;
  informativeAnswers: number;
  /** Answers recorded since the most recent rejection (or since the start). */
  answersSinceRejection: number;
  /** Posterior over books; null when no candidate remains. */
  p: Float64Array | null;
  ranked: number[];
  action: Action;
}

export function newSession(options: Partial<SessionOptions> = {}): Session {
  return { events: [], options: { filmMemoryMode: false, ...options } };
}

export function eligibleQuestions(
  cc: CompiledCatalog,
  config: EngineConfig,
  asked: readonly AnsweredQuestion[],
  options: SessionOptions,
): number[] {
  const askedSet = new Set(asked.map((a) => a.questionIndex));
  const groupCount = new Map<string, number>();
  for (const a of asked) {
    const g = cc.questions[a.questionIndex].group;
    groupCount.set(g, (groupCount.get(g) ?? 0) + 1);
  }
  const out: number[] = [];
  cc.questions.forEach((q, i) => {
    if (q.active === false) return;
    if (askedSet.has(i)) return;
    if (options.filmMemoryMode && q.adaptation_sensitive) return;
    if ((groupCount.get(q.group) ?? 0) >= config.maxPerGroup) return;
    out.push(i);
  });
  return out;
}

export type AnswerSide = "yes" | "no" | "dont_know";
export const answerSide = (a: Answer): AnswerSide => (a === "yes" || a === "probably" ? "yes" : a === "no" || a === "probably_not" ? "no" : "dont_know");

/** The run of same-side answers at the end of the game so far (Yes/Probably count as one side, No/Probably not as the other). */
export function answerStreak(answers: readonly AnsweredQuestion[]): { side: AnswerSide; length: number } | null {
  if (answers.length === 0) return null;
  const side = answerSide(answers[answers.length - 1].answer);
  let length = 0;
  for (let i = answers.length - 1; i >= 0 && answerSide(answers[i].answer) === side; i--) length++;
  return { side, length };
}

/** True right when the streak reaches the warning length (and again at every further multiple of it). */
export function streakWarning(config: EngineConfig, answers: readonly AnsweredQuestion[]): { side: AnswerSide; length: number } | null {
  const s = answerStreak(answers);
  if (!s) return null;
  const limit = config.answerStreakWarning[s.side];
  return limit > 0 && s.length >= limit && s.length % limit === 0 ? s : null;
}

/** Replays all events and decides the next action. Pure and deterministic. */
export function deriveState(cc: CompiledCatalog, config: EngineConfig, session: Session): SessionState {
  const answers: AnsweredQuestion[] = [];
  const rejected = new Set<number>();
  let rejectionCount = 0;
  let answersSinceRejection = 0;
  let terminal: SessionEvent | null = null;
  let requestedGuess = false;

  for (const ev of session.events) {
    if (terminal) throw new Error("Events after a terminal event are not allowed");
    if (ev.type === "answer") {
      requestedGuess = false;
      const qi = cc.questionIndex.get(ev.questionId);
      if (qi === undefined) throw new Error(`Unknown question ${ev.questionId}`);
      answers.push({ questionIndex: qi, answer: ev.answer });
      answersSinceRejection++;
    } else if (ev.type === "reject") {
      requestedGuess = false;
      const bi = cc.bookIndex.get(ev.bookId);
      if (bi === undefined) throw new Error(`Unknown book ${ev.bookId}`);
      rejected.add(bi);
      rejectionCount++;
      answersSinceRejection = 0;
    } else if (ev.type === "suggest") {
      requestedGuess = true;
    } else {
      terminal = ev;
    }
  }

  const informativeAnswers = answers.filter((a) => a.answer !== "dont_know").length;
  const post = computePosterior(cc, answers, rejected);
  const base = { answers, rejected, rejectionCount, informativeAnswers, answersSinceRejection };

  if (post.kind === "no_match") {
    return { ...base, p: null, ranked: [], action: { kind: "no_match", reason: "all_rejected" } };
  }
  const p = post.p;
  const ranked = rankBooks(p, rejected);
  const state = (action: Action): SessionState => ({ ...base, p, ranked, action });

  if (terminal?.type === "exit") return state({ kind: "no_match", reason: "user_exit" });
  if (terminal?.type === "accept") {
    const bi = cc.bookIndex.get(terminal.bookId);
    if (bi === undefined) throw new Error(`Unknown book ${terminal.bookId}`);
    const prev = deriveState(cc, config, { ...session, events: session.events.slice(0, -1) });
    const via = prev.action.kind === "shortlist" ? "shortlist" : "guess";
    return state({ kind: "found", book: cc.books[bi], bookIndex: bi, via });
  }

  if (requestedGuess && informativeAnswers > 0) {
    const bookIndex = ranked[0];
    return state({ kind: "guess", book: cc.books[bookIndex], bookIndex, tentative: true });
  }

  const shortlist = (reason: ShortlistReason): SessionState => {
    const bookIndices = ranked.slice(0, config.shortlistSize);
    return state({ kind: "shortlist", reason, bookIndices, books: bookIndices.map((i) => cc.books[i]) });
  };

  if (rejectionCount >= config.maxRejections) return shortlist("rejections");

  const top = ranked[0];
  const second = ranked.length > 1 ? p[ranked[1]] : 0;
  const ratioOk = second === 0 ? true : p[top] / second >= config.guessMinRatio;
  const afterRejectionOk =
    rejectionCount === 0 || answersSinceRejection >= config.questionsAfterRejection;
  if (
    informativeAnswers >= config.minInformativeAnswers &&
    afterRejectionOk &&
    p[top] >= config.guessMinProbability &&
    ratioOk
  ) {
    return state({ kind: "guess", book: cc.books[top], bookIndex: top });
  }
  // Akinator-style check-in: at fixed question counts, show the most likely book and ask.
  if (
    config.checkpointQuestions.includes(answers.length) &&
    informativeAnswers >= config.minInformativeAnswers &&
    afterRejectionOk &&
    p[top] >= config.checkpointMinProbability &&
    (second === 0 || p[top] / second >= config.checkpointMinRatio)
  ) {
    return state({ kind: "guess", book: cc.books[top], bookIndex: top, tentative: true });
  }

  const available = eligibleQuestions(cc, config, answers, session.options);
  if (answers.length >= config.maxQuestions) return shortlist("question_cap");
  if (available.length === 0) return shortlist("no_questions");

  const scores = scoreQuestions(cc, p, available);
  const strongest = pickBest(scores, config.tieEpsilon);
  if (!strongest || strongest.score < config.minScore) return shortlist("low_information");
  const best = pickVaried(scores, config.tieEpsilon, session.options.seed, answers.length, config.questionSpread, config.questionTopK)!;

  return state({
    kind: "ask",
    question: cc.questions[best.questionIndex],
    questionIndex: best.questionIndex,
    ig: best.ig,
    score: best.score,
    number: answers.length + 1,
  });
}

/**
 * Appends an event after checking it is valid for the current action.
 * Returns a new session; never mutates the input.
 */
export function applyEvent(
  cc: CompiledCatalog,
  config: EngineConfig,
  session: Session,
  event: SessionEvent,
  current: SessionState = deriveState(cc, config, session),
): Session {
  const a = current.action;
  const ok =
    (event.type === "suggest" && a.kind === "ask" && current.informativeAnswers > 0) ||
    (event.type === "answer" && a.kind === "ask" && a.question.id === event.questionId) ||
    (event.type === "reject" && a.kind === "guess" && a.book.id === event.bookId) ||
    (event.type === "accept" &&
      ((a.kind === "guess" && a.book.id === event.bookId) ||
        (a.kind === "shortlist" && a.books.some((b) => b.id === event.bookId)))) ||
    (event.type === "exit" && (a.kind === "shortlist" || a.kind === "guess"));
  if (!ok) throw new Error(`Event ${event.type} is not valid while the action is ${a.kind}`);
  return { ...session, events: [...session.events, event] };
}

/** Undo restores the preceding state exactly — including un-rejecting a book. */
export function undo(session: Session): Session {
  if (session.events.length === 0) return session;
  return { ...session, events: session.events.slice(0, -1) };
}
