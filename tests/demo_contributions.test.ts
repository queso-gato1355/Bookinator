import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { it } from "node:test";
import fixture from "../src/data/fixture.catalog.json";
import { applyDemoContributions, demoQuestionId, validDemoContribution, type DemoContribution } from "../src/community/demo.ts";
import { compileCatalog, type Catalog } from "../src/engine/model.ts";
import { makeConfig, questionBankSize } from "../src/engine/config.ts";
import { applyEvent, deriveState, newSession } from "../src/engine/session.ts";

const base = fixture as unknown as Catalog;
const entry = (change: Partial<DemoContribution> = {}): DemoContribution => ({ id: randomUUID(), catalog_version: base.catalog_version,
  title: "Demo story", author: "", notes: "", answers: [], questions: [], ...change });

it("new books and reader-written questions enter a playable catalog without review or invented facts", () => {
  const added = entry({ questions: [{ text: "Does the story happen on a spaceship?", answer: "yes" }] });
  const catalog = applyDemoContributions(base, [added]);
  const book = catalog.books.at(-1)!;
  assert.equal(book.title_en, added.title);
  assert.equal(book.author, "");
  assert.equal(book.first_publication_year, null);
  assert.equal(book.openlibrary_work_id, null);
  assert.deepEqual(book.sources, []);
  const cc = compileCatalog(catalog, makeConfig().channel);
  const qi = cc.questionIndex.get(demoQuestionId(added.questions[0].text))!;
  assert.equal(cc.x[qi][cc.books.length - 1], .9);
  assert.equal(cc.x[qi][0], .5, "no labels are invented for other books");
  assert.equal(cc.feature[qi].at(-1)?.status, "demo_contribution");
  assert.equal(cc.feature[qi].at(-1)?.reviewed, false);
  assert.equal(base.books.length, 10, "the original release is immutable");
});

it("existing titles are updated, repeated questions are reused, and other shelves stay isolated", () => {
  const book = base.books[0], text = "Does the story happen on a spaceship?";
  const first = entry({ title: book.title_en, author: book.author, answers: [{ question_id: "q01", answer: "no" }], questions: [{ text, answer: "yes" }] });
  const second = entry({ title: book.title_en, questions: [{ text: `  ${text.toUpperCase()}  `, answer: "no" }] });
  const catalog = applyDemoContributions(base, [first, second, entry({ catalog_version: "another-shelf" })]);
  assert.equal(catalog.books.length, 10);
  assert.equal(catalog.questions.length, base.questions.length + 1);
  const cc = compileCatalog(catalog, makeConfig().channel);
  assert.equal(cc.x[cc.questionIndex.get("q01")!][0], .1);
  assert.equal(cc.x[cc.questionIndex.get(demoQuestionId(text))!][0], .1);
});

it("ignores corrupt saved entries and rejects incomplete questions", () => {
  assert.equal(validDemoContribution(entry({ questions: [{ text: "", answer: "yes" }] })), false);
  assert.equal(validDemoContribution({ ...entry(), answers: [{ question_id: "q01", answer: "maybe" }] }), false);
  assert.equal(validDemoContribution({ ...entry(), id: "bad" }), false);
  assert.equal(applyDemoContributions(base, [null, { title: "broken" }]), base);
});

it("a new book can be guessed from its directly submitted answers", () => {
  const questions = Array.from({ length: 10 }, (_, i) => ({ text: `Does demo clue number ${i} appear?`, answer: "yes" as const }));
  const catalog = applyDemoContributions(base, [entry({ questions })]);
  const config = makeConfig(), cc = compileCatalog(catalog, config.channel);
  const session = { ...newSession(), events: questions.map((q) => ({ type: "answer" as const, questionId: demoQuestionId(q.text), answer: q.answer })) };
  const state = deriveState(cc, config, session);
  assert.equal(state.action.kind, "guess");
  if (state.action.kind === "guess") assert.equal(state.action.book.title_en, "Demo story");
});

it("continues beyond 40 questions up to the active bank, without repeating or asking inactive questions", () => {
  const questions = Array.from({ length: 96 }, (_, i) => ({ ...base.questions[0], id: `bank-${i}`, group: `bank-${i}`, active: i !== 95 }));
  const catalog: Catalog = { ...base, questions, features: [] };
  const config = makeConfig({ minInformativeAnswers: 1000, checkpointQuestions: [], minScore: 0 });
  const cc = compileCatalog(catalog, config.channel);
  let session = newSession();
  for (let i = 0; i < questionBankSize(catalog); i++) {
    const state = deriveState(cc, config, session);
    assert.equal(state.action.kind, "ask", `stopped at ${i}`);
    if (state.action.kind !== "ask") throw new Error("question expected");
    session = applyEvent(cc, config, session, { type: "answer", questionId: state.action.question.id, answer: "dont_know" });
  }
  assert.equal(session.events.length, 95);
  assert.equal(new Set(session.events.map((event) => event.type === "answer" ? event.questionId : "")).size, 95);
  assert.equal(deriveState(cc, config, session).action.kind, "shortlist");
  assert.equal(questionBankSize(base), 63);
});
