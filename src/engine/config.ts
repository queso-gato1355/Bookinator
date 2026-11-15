import type { Channel } from "./model.ts";

/**
 * All numerical thresholds live here. They are the brief's unvalidated starting
 * settings: tune them with playtests and simulations, not by intuition on stage.
 */
export interface EngineConfig {
  channel: Channel;
  /** p_yes used for cells with no stored label. */
  unknownPYes: number;
  /** Guess only after this many answers that are not "Don't know". */
  minInformativeAnswers: number;
  /** Top candidate probability needed before guessing. */
  guessMinProbability: number;
  /** Top / second probability ratio needed before guessing. */
  guessMinRatio: number;
  /** Hard cap on questions asked (including "Don't know"). */
  maxQuestions: number;
  /** Below this best weighted information-gain score (bits), stop and shortlist. */
  minScore: number;
  /** After this many rejected guesses, show the shortlist and out-of-catalog exit. */
  maxRejections: number;
  /**
   * Akinator-style check-ins: after exactly this many answers, propose the most likely book even when the
   * engine is not yet confident (shown as a tentative "could it be…?"). A "no" rejects it and the questions
   * continue. Empty list = only confident guesses.
   */
  checkpointQuestions: number[];
  /** A check-in needs the top book at least this probable … */
  checkpointMinProbability: number;
  /** … and at least this many times as probable as the runner-up. */
  checkpointMinRatio: number;
  /**
   * Answered questions required after a rejection before the next guess.
   * Not in the brief's pseudocode; added so a rejection is followed by "continue
   * questioning" rather than an instant second guess. Set to 0 to disable.
   */
  questionsAfterRejection: number;
  shortlistSize: number;
  /**
   * Question variety for games that carry a seed (the UI's games): pick at random among the `questionTopK`
   * strongest questions scoring at least (1 - questionSpread) × the best. 0 / 1 = always the single best.
   */
  questionSpread: number;
  questionTopK: number;
  /**
   * Akinator's "yes-man / no-man" check: warn (UI only, the engine is unaffected) when this many answers in a
   * row are on the same side. yes = Yes/Probably, no = No/Probably not, dont_know = Don't know.
   */
  answerStreakWarning: { yes: number; no: number; dont_know: number };
  /** Max questions asked per correlation group (brief: initially one). */
  maxPerGroup: number;
  /** Scores within this distance are treated as ties; ties go to the lower index. */
  tieEpsilon: number;
}

export const DEFAULT_CHANNEL: Channel = {
  yes: { givenYes: 0.55, givenNo: 0.05 },
  probably: { givenYes: 0.2, givenNo: 0.1 },
  dont_know: { givenYes: 0.1, givenNo: 0.1 },
  probably_not: { givenYes: 0.1, givenNo: 0.2 },
  no: { givenYes: 0.05, givenNo: 0.55 },
};

export const DEFAULT_CONFIG: EngineConfig = {
  channel: DEFAULT_CHANNEL,
  unknownPYes: 0.5,
  minInformativeAnswers: 6,
  guessMinProbability: 0.8,
  guessMinRatio: 4,
  // No fixed 40-question ceiling: the active bank bounds the game. Explicit overrides still work.
  maxQuestions: Number.MAX_SAFE_INTEGER,
  minScore: 0.01,
  maxRejections: 4,
  checkpointQuestions: [15, 25, 35],
  checkpointMinProbability: 0.3,
  checkpointMinRatio: 1.5,
  questionsAfterRejection: 3,
  shortlistSize: 3,
  answerStreakWarning: { yes: 7, no: 7, dont_know: 5 },
  questionSpread: 0.25,
  questionTopK: 4,
  maxPerGroup: 1,
  tieEpsilon: 1e-12,
};

export function makeConfig(overrides: Partial<EngineConfig> = {}): EngineConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}

export function questionBankSize(catalog: { questions: { active?: boolean }[] }): number {
  return catalog.questions.filter((question) => question.active !== false).length;
}
