import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fixture from "../src/data/fixture.catalog.json";
import { makeConfig } from "../src/engine/config.ts";
import { compileCatalog, type Catalog } from "../src/engine/model.ts";
import { applyEvent, deriveState, newSession } from "../src/engine/session.ts";
import { leadingMatchCount, rewindToAnswer } from "../src/engine/reader.ts";

const config = makeConfig();
const cc = compileCatalog(fixture as unknown as Catalog, config.channel, config.unknownPYes);
function answered(answer: "yes" | "dont_know" = "yes") {
  const session = newSession({ seed: 12 });
  const state = deriveState(cc, config, session);
  assert.equal(state.action.kind, "ask");
  if (state.action.kind !== "ask") throw Error("expected question");
  return applyEvent(cc, config, session, { type: "answer", questionId: state.action.question.id, answer });
}

describe("reader-controlled guesses", () => {
  it("offers a tentative guess without changing posterior or engine thresholds, and resumes after rejection", () => {
    const session = answered();
    const state = deriveState(cc, config, session);
    assert.equal(state.action.kind, "ask");
    const requested = applyEvent(cc, config, session, { type: "suggest" }, state);
    const guess = deriveState(cc, config, requested);
    assert.equal(guess.action.kind, "guess");
    if (guess.action.kind !== "guess") throw Error("expected guess");
    assert.equal(guess.action.tentative, true);
    assert.equal(guess.action.bookIndex, state.ranked[0]);
    assert.deepEqual(guess.p, state.p);
    const rejected = applyEvent(cc, config, requested, { type: "reject", bookId: guess.action.book.id });
    const next = deriveState(cc, config, rejected);
    assert.equal(next.action.kind, "ask");
    assert.ok(next.rejected.has(guess.action.bookIndex));
  });

  it("requires at least one informative answer", () => {
    for (const session of [newSession(), answered("dont_know")]) {
      assert.throws(() => applyEvent(cc, config, session, { type: "suggest" }));
    }
  });

  it("can be confirmed and undone using the ordinary session flow", () => {
    const session = applyEvent(cc, config, answered(), { type: "suggest" });
    const state = deriveState(cc, config, session);
    if (state.action.kind !== "guess") throw Error("expected guess");
    const found = deriveState(cc, config, applyEvent(cc, config, session, { type: "accept", bookId: state.action.book.id }));
    assert.equal(found.action.kind, "found");
  });
});

describe("search feedback and editing", () => {
  it("summarises search weight without eliminating any candidate or changing the distribution", () => {
    const p = new Float64Array([0.8, 0.15, 0.05]);
    assert.equal(leadingMatchCount({ p, ranked: [0, 1, 2] }), 2);
    assert.deepEqual([...p], [0.8, 0.15, 0.05]);
    assert.equal(leadingMatchCount({ p: null, ranked: [] }), 0);
  });

  it("keeps uncertainty neutral", () => {
    const before = deriveState(cc, config, newSession());
    const after = deriveState(cc, config, answered("dont_know"));
    assert.deepEqual(after.p, before.p);
    assert.equal(leadingMatchCount(after), leadingMatchCount(before));
  });

  it("rewinds dependent guesses, rejections and later answers and restores the original question", () => {
    const first = answered();
    const suggested = applyEvent(cc, config, first, { type: "suggest" });
    const guess = deriveState(cc, config, suggested);
    if (guess.action.kind !== "guess") throw Error("expected guess");
    const rejected = applyEvent(cc, config, suggested, { type: "reject", bookId: guess.action.book.id });
    const next = deriveState(cc, config, rejected);
    if (next.action.kind !== "ask") throw Error("expected question");
    const two = applyEvent(cc, config, rejected, { type: "answer", questionId: next.action.question.id, answer: "no" });
    const rewound = rewindToAnswer(two, 0);
    assert.equal(rewound.events.length, 0);
    assert.deepEqual(rewound.options, first.options);
    assert.deepEqual(deriveState(cc, config, rewound), deriveState(cc, config, { ...first, events: [] }));
    assert.equal(rewindToAnswer(two, -1), two);
    assert.equal(rewindToAnswer(two, 999), two);
    assert.deepEqual(rewindToAnswer(two, 1).events, rejected.events);
  });
});
