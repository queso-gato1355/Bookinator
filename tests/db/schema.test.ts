// Runs the Supabase community migration in PGlite (Postgres compiled to WASM) and checks the
// contribution rules: RLS, submit functions, duplicate search, review log, exclusions and the
// consensus input view. `npm run test:db`. Uses tests/db/supabase_stub.sql in place of the
// Supabase auth/storage schemas, so it checks our SQL, not Supabase itself.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";

import { computeConsensus, type RawAnswer } from "../../src/community/consensus.ts";
import type { Answer } from "../../src/engine/model.ts";
import { applyDemoContributions, type DemoContribution } from "../../src/community/demo.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");
const FIXTURE = JSON.parse(read("src/data/fixture.catalog.json"));
const CMU = JSON.parse(read("src/data/cmu.catalog.json"));
const V = FIXTURE.catalog_version as string;
// Expected mirror sizes come from the shipped files, so catalog updates don't break the tests.
const BOOKS = new Set([...FIXTURE.books, ...CMU.books].map((b: { id: string }) => b.id)).size;
const FEATURES = FIXTURE.features.length + CMU.features.length;

let db: PGlite;
const ADMIN = randomUUID();
const ALICE = randomUUID();
const BOB = randomUUID();

/** Runs `fn` as a Supabase role with the given auth.uid(), then returns to the superuser. */
async function as<T>(uid: string | null, role: "anon" | "authenticated" | "service_role", fn: () => Promise<T>): Promise<T> {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid ?? ""]);
  await db.exec(`set role ${role}`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}
const rpc = async <T = unknown>(fn: string, payload: unknown): Promise<T> => {
  const r = await db.query<{ r: T }>(`select public.${fn}($1::jsonb) as r`, [JSON.stringify(payload)]);
  return r.rows[0].r;
};
const user = <T>(uid: string, fn: () => Promise<T>) => as(uid, "authenticated", fn);
const session = (answers: [string, Answer][], extra: Record<string, unknown> = {}) => ({
  catalog_version: V,
  outcome: "found_guess",
  confirmed_book_id: "fx-the-hobbit",
  consent_version: "2026-11-draft",
  answers: answers.map(([question_id, answer]) => ({ question_id, answer })),
  ...extra,
});

before(async () => {
  db = await PGlite.create({ extensions: { pg_trgm } });
  await db.exec(read("tests/db/supabase_stub.sql"));
  await db.exec(read("supabase/migrations/20261114000000_community_contributions.sql"));
  await db.exec(read("supabase/migrations/20261115000000_input_hygiene_and_popular.sql"));
  await db.exec(read("supabase/migrations/20261115010000_feature_status_ai_recall.sql"));
  await db.exec(read("supabase/migrations/20261115020000_optional_author.sql"));
  await db.exec(read("supabase/migrations/20261115030000_question_cap_40.sql"));
  await db.exec(read("supabase/migrations/20261115040000_demo_direct_contributions.sql"));
  await db.query("insert into auth.users (id) values ($1), ($2), ($3)", [ADMIN, ALICE, BOB]);
  await db.query("insert into public.app_admins (user_id) values ($1)", [ADMIN]);
  await as(null, "service_role", async () => {
    await db.query("select public.tb_sync_release($1::jsonb)", [JSON.stringify(FIXTURE)]);
    await db.query("select public.tb_sync_release($1::jsonb)", [JSON.stringify(CMU)]);
  });
});

describe("direct demo contributions", () => {
  const reader = randomUUID();
  before(async () => { await db.query("insert into auth.users(id) values ($1)", [reader]); });
  const entry = (change: Partial<DemoContribution> = {}): DemoContribution => ({ id: randomUUID(), catalog_version: V,
    title: "A reader's demo novel", author: "", notes: "", answers: [], questions: [{ text: "Is the protagonist a lighthouse keeper?", answer: "yes" }], ...change });

  it("immediately exposes a new book and its answers to another visitor without an admin review", async () => {
    const payload = entry({ answers: FIXTURE.questions.filter((q: { active?: boolean }) => q.active !== false).map((q: { id: string }) => ({ question_id: q.id, answer: "dont_know" as const })) });
    assert.equal(await user(reader, () => rpc("submit_demo_contribution", payload)), payload.id);
    const result = await as(null, "anon", () => db.query<{ entries: DemoContribution[] }>("select get_demo_contributions($1) entries", [V]));
    assert.ok(result.rows[0].entries.some((e) => e.id === payload.id));
    const catalog = applyDemoContributions(FIXTURE, result.rows[0].entries);
    assert.ok(catalog.books.some((b) => b.title_en === payload.title));
    assert.ok(catalog.questions.some((q) => q.text === payload.questions[0].text));
    assert.equal((await db.query<{ n: number }>("select count(*)::int n from submission_reviews")).rows[0].n, 0);
    assert.equal(await user(reader, () => rpc("submit_demo_contribution", payload)), payload.id, "a retry is idempotent");
  });

  it("accepts a title with no game answers and keeps empty author metadata unknown", async () => {
    const payload = entry({ title: "Title-only demo addition", questions: [] });
    assert.equal(await user(reader, () => rpc("submit_demo_contribution", payload)), payload.id);
  });

  it("validates inputs and denies unauthenticated writes and direct table access", async () => {
    await assert.rejects(as(null, "anon", () => rpc("submit_demo_contribution", entry())), /permission denied/);
    await assert.rejects(user(reader, () => db.query("select * from demo_contributions")), /permission denied/);
    for (const payload of [entry({ title: "" }), entry({ catalog_version: "missing" }), entry({ book_id: "nonexistent" }), entry({ questions: [{ text: "", answer: "yes" }] }), entry({ answers: [{ question_id: "q-not-here", answer: "yes" }] })]) {
      await assert.rejects(user(reader, () => rpc("submit_demo_contribution", payload)));
    }
  });

  it("accepts full-bank game sessions longer than 40 questions", async () => {
    const answers = FIXTURE.questions.filter((q: { active?: boolean }) => q.active !== false).map((q: { id: string }) => [q.id, "dont_know"] as [string, Answer]);
    const id = await user(reader, () => rpc<string>("submit_game_session", session(answers)));
    const rows = await db.query<{ n: number }>("select count(*)::int n from session_answers where session_id = $1", [id]);
    assert.equal(rows.rows[0].n, 63);
  });
});

describe("catalog mirror", () => {
  it("loads both shipped catalogs and keeps question definitions per release", async () => {
    const counts = await db.query<{ books: number; features: number; revs: number }>(
      `select (select count(*)::int from books) books, (select count(*)::int from book_features) features,
              (select count(*)::int from question_revisions where question_id = 'q01') revs`,
    );
    assert.deepEqual(counts.rows[0], { books: BOOKS, features: FEATURES, revs: 2 });
  });

  it("gives back each shipped catalog exactly as saved (books, questions, features, order, metadata)", async () => {
    for (const cat of [FIXTURE, CMU]) {
      const r = await as(null, "anon", () => db.query<{ c: unknown }>("select public.get_release_catalog($1) as c", [cat.catalog_version]));
      assert.deepEqual(r.rows[0].c, cat);
    }
    const missing = await db.query<{ c: unknown }>("select public.get_release_catalog('no-such-release') as c");
    assert.equal(missing.rows[0].c, null);
  });

  it("refuses to load the same release twice", async () => {
    await assert.rejects(as(null, "service_role", () => db.query("select public.tb_sync_release($1::jsonb)", [JSON.stringify(FIXTURE)])), /immutable/);
  });

  it("is readable by anyone and writable by no client", async () => {
    const r = await as(null, "anon", () => db.query("select count(*)::int n from books"));
    assert.equal((r.rows[0] as { n: number }).n, BOOKS);
    // No update policy: RLS silently matches zero rows.
    const upd = await user(ALICE, () => db.query("update books set title_en = 'x' where id = 'fx-the-hobbit'"));
    assert.equal(upd.affectedRows, 0);
    await assert.rejects(user(ALICE, () => db.query("insert into books (id, title_en, author, original_language) values ('x', 'x', 'x', 'en')")), /row-level security/);
    await assert.rejects(as(null, "anon", () => rpc("tb_sync_release", FIXTURE)), /permission denied/);
  });
});

describe("game sessions", () => {
  it("needs a signed-in (possibly anonymous) user and the submit function", async () => {
    await assert.rejects(as(null, "anon", () => rpc("submit_game_session", session([["q01", "yes"]]))), /permission denied/);
    await assert.rejects(user(ALICE, () => db.query("insert into game_sessions (contributor_id, catalog_version, outcome, consent_version) values ($1, $2, 'no_match_exit', 'x')", [ALICE, V])), /row-level security/);
  });

  it("stores answers in order with the release's question revision and keeps Don't know", async () => {
    const id = await user(ALICE, () => rpc<string>("submit_game_session", session([["q01", "yes"], ["q09", "dont_know"]])));
    const rows = await db.query<{ seq: number; question_id: string; answer: string; question_revision: number }>(
      "select seq, question_id, answer::text, question_revision from session_answers where session_id = $1 order by seq", [id]);
    assert.deepEqual(rows.rows.map((r) => [r.seq, r.question_id, r.answer, r.question_revision]), [[1, "q01", "yes", 1], [2, "q09", "dont_know", 1]]);
  });

  it("rejects unknown questions, books outside the release and missing consent", async () => {
    await assert.rejects(user(ALICE, () => rpc("submit_game_session", session([["q99", "yes"]]))), /not in release/);
    await assert.rejects(user(ALICE, () => rpc("submit_game_session", session([["q01", "yes"]], { confirmed_book_id: "cmu:enwiki:20128213" }))), /not in release/);
    await assert.rejects(user(ALICE, () => rpc("submit_game_session", session([["q01", "yes"]], { consent_version: "" }))), /consent_version/);
  });

  it("each user sees only their own sessions", async () => {
    const mine = await user(BOB, () => db.query("select count(*)::int n from game_sessions"));
    assert.equal((mine.rows[0] as { n: number }).n, 0);
  });
});

describe("book submissions and duplicate search", () => {
  it("finds existing works by English title, Korean title, alias and ISBN", async () => {
    const top = async (q: string) =>
      (await as(null, "anon", () => db.query<{ id: string }>("select id from search_books($1, 3)", [q]))).rows.map((r) => r.id);
    assert.ok((await top("the hobit tolkien")).includes("fx-the-hobbit"));
    assert.ok((await top("호빗")).includes("fx-the-hobbit"));
    assert.ok((await top("상실의 시대")).includes("fx-norwegian-wood"));
    assert.deepEqual(await top("978-0-395-52021-5"), ["fx-the-hobbit"]);
  });

  it("blocks exact duplicates, asks before near-duplicates, then records the flag", async () => {
    const dupIsbn = await user(ALICE, () => rpc<{ status: string; book_id: string }>("submit_book", { kind: "new_book", title: "Hobbit", author: "Tolkien", isbn13: "9780395520215" }));
    assert.deepEqual(dupIsbn, { status: "duplicate_book", book_id: "fx-the-hobbit" });

    const near = await user(ALICE, () => rpc<{ status: string; candidates: { id: string }[] }>("submit_book", { kind: "new_book", title: "The Hobbit, or There and Back Again", author: "J.R.R. Tolkien" }));
    assert.equal(near.status, "possible_duplicates");
    assert.ok(near.candidates.some((c) => c.id === "fx-the-hobbit"));

    const forced = await user(ALICE, () => rpc<{ status: string; flagged_possible_duplicates: boolean }>("submit_book", { kind: "new_book", title: "The Hobbit, or There and Back Again", author: "J.R.R. Tolkien", confirm_not_duplicate: true }));
    assert.equal(forced.status, "created");
    assert.equal(forced.flagged_possible_duplicates, true);
  });

  it("accepts a new book without an author, but never without a title", async () => {
    const res = await user(ALICE, () => rpc<{ status: string; submission_id: string }>("submit_book", { kind: "new_book", title: "  Untitled memory of a lighthouse  ", author: "  " }));
    assert.equal(res.status, "created");
    const row = await db.query<{ title: string; author: string | null }>("select title, author from book_submissions where id = $1", [res.submission_id]);
    assert.deepEqual(row.rows[0], { title: "Untitled memory of a lighthouse", author: null });
    await assert.rejects(user(ALICE, () => rpc("submit_book", { kind: "new_book", title: " ", author: "Someone" })), /title/);
  });

  it("links a missed game's answers to the new submission as seed evidence", async () => {
    const sid = await user(BOB, () => rpc<string>("submit_game_session", session([["q01", "no"], ["q12", "yes"]], { outcome: "no_match_exit", confirmed_book_id: null })));
    const res = await user(BOB, () => rpc<{ status: string; submission_id: string }>("submit_book", { kind: "new_book", title: "Pachinko", author: "Min Jin Lee", title_ko: "파친코", origin_session_id: sid }));
    assert.equal(res.status, "created");
    const ev = await as(ADMIN, "authenticated", () => db.query<{ target_id: string; origin: string }>("select target_id, origin::text from feature_evidence where answer_ref like $1", [`session:${sid}:%`]));
    assert.equal(ev.rows.length, 2);
    assert.ok(ev.rows.every((r) => r.target_id === `submission:${res.submission_id}` && r.origin === "game_session"));
    // Someone else's session cannot be attached.
    await assert.rejects(user(ALICE, () => rpc("submit_book", { kind: "new_book", title: "Another", author: "Someone", origin_session_id: sid })), /not your session/);
  });

  it("corrections only touch whitelisted fields", async () => {
    await assert.rejects(user(ALICE, () => rpc("submit_book", { kind: "correction", target_book_id: "fx-the-hobbit", proposed_changes: { id: "x" } })), /may only contain/);
    const ok = await user(ALICE, () => rpc<{ status: string }>("submit_book", { kind: "correction", target_book_id: "fx-the-hobbit", proposed_changes: { title_ko: "호빗: 뜻밖의 여정" }, reason: "edition title" }));
    assert.equal(ok.status, "created");
  });

  it("other users cannot read someone's submissions", async () => {
    const r = await user(BOB, () => db.query<{ submitted_by: string }>("select submitted_by from book_submissions"));
    assert.ok(r.rows.length > 0 && r.rows.every((x) => x.submitted_by === BOB));
  });
});

describe("rate limits and blocking", () => {
  it("enforces the per-hour limit from community_settings", async () => {
    await db.exec("update community_settings set value = '1' where key = 'rate_question_submissions_per_hour'");
    const carol = randomUUID();
    await user(carol, () => rpc("submit_question", { keyword: "lighthouse", text: "Is a lighthouse important to the story?" }));
    await assert.rejects(user(carol, () => rpc("submit_question", { keyword: "boat", text: "Is a boat important to the story?" })), /rate limit/);
    await db.exec("update community_settings set value = '10' where key = 'rate_question_submissions_per_hour'");
  });
});

describe("admin review", () => {
  const newSubmission = (title: string) =>
    user(ALICE, () => rpc<{ submission_id: string }>("submit_book", { kind: "new_book", title, author: "Test Author", confirm_not_duplicate: true })).then((r) => r.submission_id);

  it("is refused for non-admins", async () => {
    const id = await newSubmission("Zebra Lighthouse");
    await assert.rejects(user(ALICE, () => rpc("admin_review", { subject_type: "book_submission", subject_id: id, action: "set_status", to_status: "review" })), /admin only/);
  });

  it("walks the lifecycle, records every step and never publishes directly", async () => {
    const id = await newSubmission("Quiet Orchard Stories");
    const review = (p: Record<string, unknown>) => user(ADMIN, () => rpc<number>("admin_review", { subject_type: "book_submission", subject_id: id, ...p }));
    await review({ action: "set_status", to_status: "collecting" });
    await assert.rejects(review({ action: "approve" }), /only items in review/);
    await review({ action: "set_status", to_status: "review" });
    await assert.rejects(review({ action: "set_status", to_status: "published" }), /not allowed/);
    await review({ action: "approve", reason: "sources checked" });
    const s = await db.query<{ status: string; approved_review_id: number | null }>("select status::text, approved_review_id from book_submissions where id = $1", [id]);
    assert.equal(s.rows[0].status, "review");
    assert.ok(s.rows[0].approved_review_id);
    const log = await db.query<{ n: number }>("select count(*)::int n from submission_reviews where subject_id = $1", [id]);
    assert.equal(log.rows[0].n, 3);
    await assert.rejects(review({ action: "reject" }), /reason is required/);
  });

  it("merges duplicates and keeps the review log append-only", async () => {
    const id = await newSubmission("Orchard of Quiet Stories");
    await user(ADMIN, () => rpc("admin_review", { subject_type: "book_submission", subject_id: id, action: "merge", reason: "same work", details: { into_book_id: "fx-the-hobbit" } }));
    const s = await db.query<{ status: string; merged_into_book_id: string }>("select status::text, merged_into_book_id from book_submissions where id = $1", [id]);
    assert.deepEqual(s.rows[0], { status: "archived", merged_into_book_id: "fx-the-hobbit" });
    await assert.rejects(db.query("delete from submission_reviews"), /append-only/);
  });

  it("excludes and restores an answer without touching the raw row", async () => {
    const sid = await user(BOB, () => rpc<string>("submit_game_session", session([["q20", "yes"]])));
    const ref = `session:${sid}:1`;
    const excluded = async () => (await db.query<{ excluded: boolean }>("select excluded from feature_evidence where answer_ref = $1", [ref])).rows[0].excluded;
    await user(ADMIN, () => rpc("admin_review", { subject_type: "answer", subject_id: ref, action: "exclude_answer", reason: "test" }));
    assert.equal(await excluded(), true);
    await user(ADMIN, () => rpc("admin_review", { subject_type: "answer", subject_id: ref, action: "restore_answer" }));
    assert.equal(await excluded(), false);
    assert.equal((await db.query("select 1 from session_answers where session_id = $1", [sid])).rows.length, 1);
  });

  it("a blocked contributor can no longer submit and their answers stop counting", async () => {
    const mallory = randomUUID();
    await user(mallory, () => rpc("submit_feature_answers", { catalog_version: V, book_id: "fx-frankenstein", answers: [{ question_id: "q30", answer: "yes" }] }));
    await user(ADMIN, () => rpc("admin_review", { subject_type: "contributor", subject_id: mallory, action: "block_contributor", reason: "spam" }));
    await assert.rejects(user(mallory, () => rpc("submit_feature_answers", { catalog_version: V, book_id: "fx-frankenstein", answers: [{ question_id: "q30", answer: "yes" }] })), /blocked/);
    const ev = await db.query<{ excluded: boolean }>("select excluded from feature_evidence where contributor_id = $1", [mallory]);
    assert.ok(ev.rows.length === 1 && ev.rows[0].excluded);
  });
});

describe("consensus input", () => {
  it("feature_evidence feeds computeConsensus: five readers agreeing propose a strong label", async () => {
    const readers = Array.from({ length: 5 }, () => randomUUID());
    for (const r of readers) {
      await user(r, () => rpc("submit_feature_answers", { catalog_version: V, book_id: "fx-little-prince", answers: [{ question_id: "q40", answer: "yes" }] }));
    }
    // The same reader repeating themselves must not add weight.
    for (let i = 0; i < 5; i++) {
      await user(readers[0], () => rpc("submit_feature_answers", { catalog_version: V, book_id: "fx-little-prince", answers: [{ question_id: "q41", answer: "yes" }] }));
    }
    const rows = await db.query<{ contributor_id: string; target_id: string; question_id: string; answer: Answer; origin: RawAnswer["origin"]; created_at: Date; excluded: boolean }>(
      "select contributor_id, target_id, question_id, answer::text as answer, origin::text as origin, created_at, excluded from feature_evidence where target_id = 'fx-little-prince'");
    const raw: RawAnswer[] = rows.rows.map((r) => ({
      contributorId: r.contributor_id, targetId: r.target_id, questionId: r.question_id, answer: r.answer,
      origin: r.origin, createdAt: new Date(r.created_at).toISOString(), excluded: r.excluded,
    }));
    const out = computeConsensus(raw);
    const q40 = out.find((c) => c.questionId === "q40")!;
    const q41 = out.find((c) => c.questionId === "q41")!;
    assert.equal(q40.proposedPYes, 0.9);
    assert.equal(q41.contributors, 1);
    assert.equal(q41.rawAnswers, 5);
    assert.equal(q41.proposedPYes, 0.5);
  });
});
