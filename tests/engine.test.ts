import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFAULT_CHANNEL, makeConfig } from "../src/engine/config.ts";
import { matchingClues } from "../src/engine/explain.ts";
import { catalogLinks } from "../src/engine/links.ts";
import { ANSWERS, compileCatalog, likelihood, validateChannel, type Answer } from "../src/engine/model.ts";
import { computePosterior, entropy, rankBooks, softmax } from "../src/engine/posterior.ts";
import { informationGain, pickBest } from "../src/engine/selectQuestion.ts";
import {
  answerStreak,
  applyEvent,
  deriveState,
  eligibleQuestions,
  newSession,
  streakWarning,
  undo,
  type Session,
} from "../src/engine/session.ts";
import { COLLECTIONS } from "../src/data/index.ts";

// These tests exercise the 10-book fixture (Classic shelf) specifically, whatever the app opens on.
const ACTIVE_CATALOG = COLLECTIONS.classic.catalog;
import { binaryMatrix, setup, synthetic } from "./helpers.ts";

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);
const sum = (p: ArrayLike<number>) => Array.from(p).reduce((s, v) => s + v, 0);

/** Answer whatever is being asked, using `answerFor`, until the action is not "ask". */
function play(
  cc: ReturnType<typeof setup>["cc"],
  config: ReturnType<typeof setup>["config"],
  answerFor: (qIndex: number) => Answer,
  session: Session = newSession(),
  maxSteps = 100,
): Session {
  let s = session;
  for (let i = 0; i < maxSteps; i++) {
    const st = deriveState(cc, config, s);
    if (st.action.kind !== "ask") return s;
    s = applyEvent(cc, config, s, {
      type: "answer",
      questionId: st.action.question.id,
      answer: answerFor(st.action.questionIndex),
    }, st);
  }
  throw new Error("play() did not terminate");
}

describe("answer channel", () => {
  it("default channel columns sum to one and are strictly positive", () => {
    assert.doesNotThrow(() => validateChannel(DEFAULT_CHANNEL));
  });
  it("rejects a channel with a zero entry (would hard-eliminate)", () => {
    const bad = { ...DEFAULT_CHANNEL, yes: { givenYes: 0.6, givenNo: 0 }, no: { givenYes: 0.0, givenNo: 0.6 } };
    assert.throws(() => validateChannel(bad));
  });
  it("likelihood matches the brief's formula", () => {
    close(likelihood(0.9, "yes", DEFAULT_CHANNEL), 0.9 * 0.55 + 0.1 * 0.05);
    close(likelihood(0.5, "dont_know", DEFAULT_CHANNEL), 0.1);
  });
});

describe("posterior", () => {
  const { cc } = setup([[0.9, 0.1], [0.1, 0.9], [0.5, 0.5]]);

  it("starts uniform and stays normalized and finite", () => {
    const post = computePosterior(cc, [], new Set());
    assert.equal(post.kind, "ok");
    if (post.kind !== "ok") return;
    for (const v of post.p) close(v, 1 / 3);
    const after = computePosterior(cc, [{ questionIndex: 0, answer: "yes" }, { questionIndex: 1, answer: "no" }], new Set());
    assert.equal(after.kind, "ok");
    if (after.kind !== "ok") return;
    close(sum(after.p), 1);
    assert.ok(Array.from(after.p).every(Number.isFinite));
  });

  it("Don't know leaves the posterior unchanged", () => {
    const a = computePosterior(cc, [{ questionIndex: 0, answer: "yes" }], new Set());
    const b = computePosterior(cc, [{ questionIndex: 0, answer: "yes" }, { questionIndex: 1, answer: "dont_know" }], new Set());
    assert.ok(a.kind === "ok" && b.kind === "ok");
    if (a.kind !== "ok" || b.kind !== "ok") return;
    for (let i = 0; i < 3; i++) close(a.p[i], b.p[i], 1e-12);
  });

  it("Probably is weaker evidence than Yes (and Probably not weaker than No)", () => {
    const yes = computePosterior(cc, [{ questionIndex: 0, answer: "yes" }], new Set());
    const prob = computePosterior(cc, [{ questionIndex: 0, answer: "probably" }], new Set());
    const no = computePosterior(cc, [{ questionIndex: 0, answer: "no" }], new Set());
    const probNot = computePosterior(cc, [{ questionIndex: 0, answer: "probably_not" }], new Set());
    assert.ok(yes.kind === "ok" && prob.kind === "ok" && no.kind === "ok" && probNot.kind === "ok");
    if (yes.kind !== "ok" || prob.kind !== "ok" || no.kind !== "ok" || probNot.kind !== "ok") return;
    assert.ok(yes.p[0] > prob.p[0] && prob.p[0] > 1 / 3);
    assert.ok(no.p[1] > probNot.p[1] && probNot.p[1] > 1 / 3);
  });

  it("no normal answer hard-eliminates a candidate, even after many contradictions", () => {
    const history = Array.from({ length: 40 }, () => ({ questionIndex: 0, answer: "no" as Answer }));
    const post = computePosterior(cc, history, new Set());
    assert.equal(post.kind, "ok");
    if (post.kind !== "ok") return;
    assert.ok(post.p[0] > 0, "book 0 must keep non-zero probability");
    assert.ok(Number.isFinite(post.logp[0]));
  });

  it("stays numerically stable over very long histories (log space)", () => {
    const history = Array.from({ length: 2000 }, (_, i) => ({ questionIndex: i % 2, answer: (i % 2 ? "no" : "yes") as Answer }));
    const post = computePosterior(cc, history, new Set());
    assert.equal(post.kind, "ok");
    if (post.kind !== "ok") return;
    close(sum(post.p), 1);
    assert.ok(Array.from(post.p).every((v) => Number.isFinite(v) && v >= 0));
  });

  it("rejected books get zero probability; all rejected → no_match", () => {
    const post = computePosterior(cc, [], new Set([0]));
    assert.ok(post.kind === "ok" && post.p[0] === 0);
    if (post.kind === "ok") close(sum(post.p), 1);
    assert.equal(computePosterior(cc, [], new Set([0, 1, 2])).kind, "no_match");
  });

  it("softmax returns null for an empty (all −∞) distribution", () => {
    assert.equal(softmax(new Float64Array([-Infinity, -Infinity])), null);
  });

  it("entropy treats 0·log 0 as 0", () => {
    close(entropy([1, 0, 0]), 0);
    close(entropy([0.5, 0.5]), 1);
  });

  it("ranking breaks exact ties by catalog order", () => {
    assert.deepEqual(rankBooks(new Float64Array([0.25, 0.25, 0.5])), [2, 0, 1]);
    assert.deepEqual(rankBooks(new Float64Array([0.25, 0.25, 0.5]), new Set([2])), [0, 1]);
  });
});

describe("question selection", () => {
  it("an all-unknown question has zero information gain", () => {
    const { cc } = setup(binaryMatrix(2, 1));
    const p = new Float64Array(4).fill(0.25);
    close(informationGain(cc, p, 2), 0, 1e-12);
    assert.ok(informationGain(cc, p, 0) > 0.1);
  });

  it("optimized IG equals the brief's direct formula", () => {
    const { cc } = setup([[0.9, 0.3, 0.5], [0.1, 0.7, 0.9], [0.7, 0.1, 0.3], [0.5, 0.9, 0.1]]);
    const p = new Float64Array([0.4, 0.3, 0.2, 0.1]);
    for (let q = 0; q < 3; q++) {
      let expectedH = 0;
      for (const a of ANSWERS) {
        const joint = Array.from(p, (pb, b) => pb * likelihood(cc.x[q][b], a, DEFAULT_CHANNEL));
        const mass = sum(joint);
        if (mass > 0) expectedH += mass * entropy(joint.map((j) => j / mass));
      }
      close(informationGain(cc, p, q), entropy(p) - expectedH, 1e-12);
    }
  });

  it("prefers the balanced split over a lopsided one", () => {
    // q0 splits 2/2, q1 splits 1/3
    const { cc } = setup([[0.9, 0.9], [0.9, 0.1], [0.1, 0.1], [0.1, 0.1]]);
    const p = new Float64Array(4).fill(0.25);
    assert.ok(informationGain(cc, p, 0) > informationGain(cc, p, 1));
  });

  it("recallability weights the score", () => {
    // identical questions, second has higher recallability → chosen despite later index
    const { cc, config } = setup([[0.9, 0.9], [0.1, 0.1]], { recall: [0.4, 1.0] });
    const st = deriveState(cc, config, newSession());
    assert.equal(st.action.kind, "ask");
    if (st.action.kind === "ask") assert.equal(st.action.question.id, "q1");
  });

  it("ties are broken deterministically by question order", () => {
    const { cc, config } = setup([[0.9, 0.9, 0.9], [0.1, 0.1, 0.1]], { groups: ["a", "b", "c"] });
    for (let i = 0; i < 5; i++) {
      const st = deriveState(cc, config, newSession());
      assert.ok(st.action.kind === "ask" && st.action.question.id === "q0");
    }
    const best = pickBest(
      [
        { questionIndex: 3, ig: 1, score: 1 },
        { questionIndex: 1, ig: 1, score: 1 + 1e-15 },
      ],
      1e-12,
    );
    assert.equal(best?.questionIndex, 1);
  });

  it("only one question per correlation group is asked", () => {
    const { cc, config } = setup([[0.9, 0.9, 0.9], [0.1, 0.1, 0.5], [0.5, 0.1, 0.1]], { groups: ["g", "g", "h"] });
    const asked = [{ questionIndex: 0, answer: "yes" as Answer }];
    const elig = eligibleQuestions(cc, config, asked, { filmMemoryMode: false });
    assert.deepEqual(elig, [2]);
  });

  it("inactive questions are never eligible; film mode skips adaptation-sensitive ones", () => {
    const { cc, config } = setup([[0.9, 0.9, 0.9], [0.1, 0.1, 0.1]], { inactive: [true, false, false], adaptation: [false, true, false] });
    assert.deepEqual(eligibleQuestions(cc, config, [], { filmMemoryMode: false }), [1, 2]);
    assert.deepEqual(eligibleQuestions(cc, config, [], { filmMemoryMode: true }), [2]);
  });
});

describe("session flow", () => {
  // 16 books, 4 sharp binary questions + 4 duplicates in other groups → enough
  // informative answers to clear the 6-answer minimum.
  const matrix = binaryMatrix(4).map((row) => [...row, ...row]);
  const { cc, config } = setup(matrix);
  const truthful = (target: number) => (q: number): Answer => (cc.x[q][target] > 0.5 ? "yes" : "no");

  it("guesses the right book after ≥6 informative answers when answers are truthful", () => {
    for (const target of [0, 5, 15]) {
      const s = play(cc, config, truthful(target));
      const st = deriveState(cc, config, s);
      assert.equal(st.action.kind, "guess");
      if (st.action.kind === "guess") assert.equal(st.action.bookIndex, target);
      assert.ok(st.informativeAnswers >= config.minInformativeAnswers);
    }
  });

  it("does not guess before the minimum number of informative answers", () => {
    const loose = setup(matrix, {}, { minInformativeAnswers: 8 });
    const s = play(loose.cc, loose.config, truthful(3));
    const st = deriveState(loose.cc, loose.config, s);
    assert.ok(st.informativeAnswers >= 8 || st.action.kind !== "guess");
  });

  it("Don't know answers do not count toward the guess minimum", () => {
    let s = newSession();
    for (let i = 0; i < 5; i++) {
      const st = deriveState(cc, config, s);
      assert.equal(st.action.kind, "ask");
      if (st.action.kind !== "ask") return;
      s = applyEvent(cc, config, s, { type: "answer", questionId: st.action.question.id, answer: "dont_know" });
    }
    assert.equal(deriveState(cc, config, s).informativeAnswers, 0);
  });

  it("replay is deterministic: same events → identical state", () => {
    const s = play(cc, config, truthful(9));
    const a = deriveState(cc, config, s);
    const b = deriveState(cc, config, { ...s, events: [...s.events] });
    assert.deepEqual(Array.from(a.p ?? []), Array.from(b.p ?? []));
    assert.deepEqual(a.action, b.action);
  });

  it("Undo restores the exact preceding state", () => {
    let s = newSession();
    const before = deriveState(cc, config, s);
    if (before.action.kind !== "ask") throw new Error("expected ask");
    s = applyEvent(cc, config, s, { type: "answer", questionId: before.action.question.id, answer: "yes" });
    const restored = deriveState(cc, config, undo(s));
    assert.deepEqual(restored.action, before.action);
    assert.deepEqual(Array.from(restored.p ?? []), Array.from(before.p ?? []));
    assert.equal(undo(newSession()).events.length, 0);
  });

  it("rejection excludes the book, replays from the prior and keeps questioning", () => {
    // three copies of each question so unasked questions remain after the first guess
    const roomy = setup(binaryMatrix(4).map((row) => [...row, ...row, ...row]));
    const t = (q: number): Answer => (roomy.cc.x[q][7] > 0.5 ? "yes" : "no");
    let s = play(roomy.cc, roomy.config, t);
    const st = deriveState(roomy.cc, roomy.config, s);
    if (st.action.kind !== "guess") throw new Error("expected guess");
    s = applyEvent(roomy.cc, roomy.config, s, { type: "reject", bookId: st.action.book.id });
    const after = deriveState(roomy.cc, roomy.config, s);
    assert.ok(after.rejected.has(7));
    assert.equal(after.p?.[7], 0);
    assert.ok(!after.ranked.includes(7));
    // questionsAfterRejection = 1 → must ask before guessing again
    assert.equal(after.action.kind, "ask");
  });

  it("Undo after a rejection un-rejects the book", () => {
    let s = play(cc, config, truthful(2));
    const guess = deriveState(cc, config, s);
    if (guess.action.kind !== "guess") throw new Error("expected guess");
    s = applyEvent(cc, config, s, { type: "reject", bookId: guess.action.book.id });
    const back = deriveState(cc, config, undo(s));
    assert.equal(back.rejected.size, 0);
    assert.deepEqual(back.action, guess.action);
  });

  it("two rejections → shortlist; shortlist excludes rejected books", () => {
    let s = play(cc, config, truthful(4));
    for (let r = 0; r < 2; r++) {
      let st = deriveState(cc, config, s);
      while (st.action.kind === "ask") {
        s = applyEvent(cc, config, s, { type: "answer", questionId: st.action.question.id, answer: "dont_know" });
        st = deriveState(cc, config, s);
      }
      if (st.action.kind !== "guess") break;
      s = applyEvent(cc, config, s, { type: "reject", bookId: st.action.book.id });
    }
    const st = deriveState(cc, config, s);
    assert.equal(st.action.kind, "shortlist");
    if (st.action.kind !== "shortlist") return;
    assert.ok(st.action.bookIndices.length <= 3);
    for (const b of st.action.bookIndices) assert.ok(!st.rejected.has(b));
  });

  it("accepting from guess or shortlist reaches found; exit reaches no_match", () => {
    let s = play(cc, config, truthful(11));
    const st = deriveState(cc, config, s);
    if (st.action.kind !== "guess") throw new Error("expected guess");
    const found = deriveState(cc, config, applyEvent(cc, config, s, { type: "accept", bookId: st.action.book.id }));
    assert.ok(found.action.kind === "found" && found.action.via === "guess");
    const exited = deriveState(cc, config, applyEvent(cc, config, s, { type: "exit" }));
    assert.ok(exited.action.kind === "no_match" && exited.action.reason === "user_exit");
    s = applyEvent(cc, config, s, { type: "accept", bookId: st.action.book.id });
    assert.throws(() => applyEvent(cc, config, s, { type: "exit" }));
  });

  it("rejecting every candidate yields no_match instead of an empty distribution", () => {
    const tiny = setup([[0.9], [0.1]], {}, { maxRejections: 99, minInformativeAnswers: 0, guessMinProbability: 0, guessMinRatio: 1, questionsAfterRejection: 0 });
    let s = newSession();
    for (let i = 0; i < 2; i++) {
      const st = deriveState(tiny.cc, tiny.config, s);
      if (st.action.kind !== "guess") throw new Error(`expected guess, got ${st.action.kind}`);
      s = applyEvent(tiny.cc, tiny.config, s, { type: "reject", bookId: st.action.book.id });
    }
    const st = deriveState(tiny.cc, tiny.config, s);
    assert.ok(st.action.kind === "no_match" && st.action.reason === "all_rejected");
    assert.equal(st.p, null);
  });

  it("stops at the question cap (config.maxQuestions) with a shortlist", () => {
    // More weak, uninformative-ish questions than the cap → never confident
    const cap = 40; // Explicit custom caps still work; the default now uses the entire bank.
    const n = cap + 20;
    const weak = Array.from({ length: 6 }, (_, b) => Array.from({ length: n }, (_, q) => ((b + q) % 2 ? 0.7 : 0.3)));
    const w = setup(weak, {}, { maxQuestions: cap });
    const s = play(w.cc, w.config, () => "dont_know");
    const st = deriveState(w.cc, w.config, s);
    assert.equal(st.answers.length, w.config.maxQuestions);
    assert.ok(st.action.kind === "shortlist" && st.action.reason === "question_cap");
  });

  it("exhausted questions → shortlist (no_questions)", () => {
    const e = setup([[0.9], [0.1], [0.5]]);
    const s = play(e.cc, e.config, () => "dont_know");
    const st = deriveState(e.cc, e.config, s);
    assert.ok(st.action.kind === "shortlist" && st.action.reason === "no_questions");
  });

  it("low information → shortlist (identical books cannot be separated)", () => {
    const e = setup([[0.9, 0.1], [0.9, 0.1], [0.9, 0.1]]);
    const st = deriveState(e.cc, e.config, newSession());
    assert.ok(st.action.kind === "shortlist" && st.action.reason === "low_information");
    // tied candidates are listed in catalog order
    if (st.action.kind === "shortlist") assert.deepEqual(st.action.bookIndices, [0, 1, 2]);
  });

  it("one wrong answer does not prevent eventually reaching the right book", () => {
    const target = 6;
    let flipped = false;
    let s = play(cc, config, (q) => {
      const truth = cc.x[q][target] > 0.5;
      if (!flipped) {
        flipped = true;
        return truth ? "no" : "yes";
      }
      return truth ? "yes" : "no";
    });
    // reject wrong guesses (at most twice), answering truthfully in between
    for (let i = 0; i < 3; i++) {
      const st = deriveState(cc, config, s);
      if (st.action.kind === "guess" && st.action.bookIndex !== target) {
        s = applyEvent(cc, config, s, { type: "reject", bookId: st.action.book.id });
        s = play(cc, config, truthful(target), s);
      }
    }
    const st = deriveState(cc, config, s);
    const ok =
      (st.action.kind === "guess" && st.action.bookIndex === target) ||
      (st.action.kind === "shortlist" && st.action.bookIndices.includes(target));
    assert.ok(ok, `ended in ${st.action.kind}`);
  });

  it("rejects events that do not match the current action", () => {
    const s = newSession();
    assert.throws(() => applyEvent(cc, config, s, { type: "reject", bookId: "b0" }));
    assert.throws(() => applyEvent(cc, config, s, { type: "answer", questionId: "q7", answer: "yes" }));
  });
});

describe("explanations and links", () => {
  it("matching clues only cite answers that agree with strong stored labels", () => {
    const { cc } = setup([[0.9, 0.1, 0.5], [0.1, 0.9, 0.5]]);
    const clues = matchingClues(cc, 0, [
      { questionIndex: 0, answer: "yes" },
      { questionIndex: 1, answer: "no" },
      { questionIndex: 2, answer: "yes" },
    ]);
    assert.deepEqual(clues.map((c) => c.questionId), ["q0", "q1"]);
    assert.equal(matchingClues(cc, 1, [{ questionIndex: 0, answer: "yes" }]).length, 0);
  });

  it("links never invent IDs and ignore malformed templates", () => {
    const book = synthetic([[0.5]]).books[0];
    const links = catalogLinks(book);
    assert.equal(links.length, 1);
    assert.match(links[0].url, /^https:\/\/openlibrary\.org\/search\?title=/);
    assert.equal(catalogLinks(book, { localSearchTemplate: "javascript:alert(1){query}" }).length, 1);
    const withLocal = catalogLinks(book, { localSearchTemplate: "https://lib.example/search?q={query}" });
    assert.equal(withLocal[1].url, "https://lib.example/search?q=Book%200");
    const withId = catalogLinks({ ...book, openlibrary_work_id: "OL123W" });
    assert.equal(withId[0].url, "https://openlibrary.org/works/OL123W");
  });
});

describe("fixture catalog", () => {
  const config = makeConfig();
  const cc = compileCatalog(ACTIVE_CATALOG, config.channel, config.unknownPYes);

  it("loads, is marked as a development fixture, and has 64 questions with q56 inactive", () => {
    assert.equal(ACTIVE_CATALOG.data_status, "development_fixture");
    assert.equal(cc.books.length, 10);
    assert.equal(cc.questions.length, 64);
    assert.equal(cc.questions[cc.questionIndex.get("q56")!].active, false);
    assert.ok(ACTIVE_CATALOG.features.every((f) => !f.reviewed), "nothing is human-reviewed yet");
    for (const f of ACTIVE_CATALOG.features.filter((x) => x.status === "supported")) {
      const book = ACTIVE_CATALOG.books.find((b) => b.id === f.book_id)!;
      assert.ok(f.source_ids.length > 0 && f.source_ids.every((s) => book.sources.some((src) => src.id === s)));
    }
  });

  it("each fixture book is guessed when answers follow its own labels exactly", () => {
    for (let target = 0; target < cc.books.length; target++) {
      const s = play(cc, config, (q) => {
        const x = cc.x[q][target];
        return x >= 0.7 ? "yes" : x <= 0.3 ? "no" : "dont_know";
      });
      const st = deriveState(cc, config, s);
      assert.ok(
        st.action.kind === "guess" && st.action.bookIndex === target,
        `${cc.books[target].id}: ended in ${st.action.kind}`,
      );
    }
  });

  it("all answers are covered by ANSWERS order used in logL", () => {
    assert.deepEqual([...ANSWERS], ["yes", "probably", "dont_know", "probably_not", "no"]);
  });
});

describe("Akinator-style check-ins", () => {
  // Weak labels: the engine never reaches the confident-guess threshold on its own.
  const weak = Array.from({ length: 5 }, (_, b) => Array.from({ length: 40 }, (_, q) => (((q + 1) * (b + 3)) % 5 < 2 ? 0.7 : 0.3)));
  const opts = { checkpointQuestions: [8, 16], checkpointMinProbability: 0.2, checkpointMinRatio: 1.05, guessMinProbability: 0.999, questionsAfterRejection: 2 };
  const truth = (q: number) => (weak[0][q] > 0.5 ? "yes" : "no") as Answer;

  it("proposes the most likely book at a check-in, marked tentative", () => {
    const w = setup(weak, {}, opts);
    const st = deriveState(w.cc, w.config, play(w.cc, w.config, truth));
    assert.equal(st.answers.length, 8);
    assert.ok(st.action.kind === "guess" && st.action.tentative === true);
    assert.equal(st.action.kind === "guess" && st.action.book.id, st.ranked.length && w.cc.books[st.ranked[0]].id);
  });

  it("keeps asking after a 'no', then checks in again later", () => {
    const w = setup(weak, {}, opts);
    let s = play(w.cc, w.config, truth);
    let st = deriveState(w.cc, w.config, s);
    assert.equal(st.action.kind, "guess");
    s = applyEvent(w.cc, w.config, s, { type: "reject", bookId: (st.action as { book: { id: string } }).book.id }, st);
    st = deriveState(w.cc, w.config, s);
    assert.equal(st.action.kind, "ask"); // not another guess straight away
    s = play(w.cc, w.config, truth, s);
    st = deriveState(w.cc, w.config, s);
    assert.ok(st.answers.length > 8, "questions continued after the rejected check-in");
    if (st.action.kind === "guess") assert.ok(!st.rejected.has(st.action.bookIndex), "a rejected book is never proposed again");
  });

  it("no check-ins when the list is empty", () => {
    const w = setup(weak, {}, { ...opts, checkpointQuestions: [] });
    const st = deriveState(w.cc, w.config, play(w.cc, w.config, truth));
    assert.notEqual(st.action.kind, "guess");
  });
});

describe("question variety", () => {
  const cat = COLLECTIONS.classic.catalog;
  const config = makeConfig();
  const cc = compileCatalog(cat, config.channel, config.unknownPYes);
  const firstQuestions = (seed?: number) => {
    let s = newSession(seed === undefined ? {} : { seed });
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const st = deriveState(cc, config, s);
      if (st.action.kind !== "ask") break;
      ids.push(st.action.question.id);
      s = applyEvent(cc, config, s, { type: "answer", questionId: st.action.question.id, answer: "dont_know" }, st);
    }
    return ids.join(",");
  };

  it("without a seed the order is fixed (simulator gate, old saved games)", () => {
    assert.equal(firstQuestions(), firstQuestions());
  });

  it("different seeds give different orders; the same seed replays exactly", () => {
    const orders = new Set(Array.from({ length: 12 }, (_, i) => firstQuestions(1000 + i)));
    assert.ok(orders.size > 1, "questions vary between games");
    assert.equal(firstQuestions(42), firstQuestions(42));
  });

  it("Undo returns to the same question in a seeded game", () => {
    let s = newSession({ seed: 7 });
    const st0 = deriveState(cc, config, s);
    assert.equal(st0.action.kind, "ask");
    const q0 = (st0.action as { question: { id: string } }).question.id;
    s = applyEvent(cc, config, s, { type: "answer", questionId: q0, answer: "yes" }, st0);
    s = undo(s);
    const back = deriveState(cc, config, s);
    assert.equal((back.action as { question: { id: string } }).question.id, q0);
  });
});

describe("same-answer streak warning", () => {
  const config = makeConfig();
  const run = (answers: Answer[]) => answers.map((answer, i) => ({ questionIndex: i, answer }));

  it("counts Yes and Probably as one side, and warns exactly at the limit", () => {
    const n = config.answerStreakWarning.yes;
    const yes = run([...Array(n - 1).fill("yes"), "probably"] as Answer[]);
    assert.deepEqual(answerStreak(yes), { side: "yes", length: n });
    assert.deepEqual(streakWarning(config, yes), { side: "yes", length: n });
    assert.equal(streakWarning(config, yes.slice(0, n - 1)), null);
    assert.equal(streakWarning(config, run([...Array(n).fill("yes"), "yes"] as Answer[])), null, "not again on the next answer");
  });

  it("a different answer resets the run", () => {
    const answers = run(["no", "no", "no", "no", "no", "no", "yes", "no"] as Answer[]);
    assert.deepEqual(answerStreak(answers), { side: "no", length: 1 });
    assert.equal(streakWarning(config, answers), null);
  });

  it("warns sooner for a run of Don't know", () => {
    const n = config.answerStreakWarning.dont_know;
    assert.deepEqual(streakWarning(config, run(Array(n).fill("dont_know") as Answer[])), { side: "dont_know", length: n });
  });
});
