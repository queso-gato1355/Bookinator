import assert from "node:assert/strict";
import { it } from "node:test";
import fixture from "../src/data/fixture.catalog.json";
import { fetchBlurb, fetchCover, displayLanguage } from "../src/bookInfo.ts";
import type { CatalogBook } from "../src/engine/model.ts";
const book = fixture.books[5] as CatalogBook;

it("loads the stored Wikipedia work rather than displaying an untagged foreign Open Library description", async () => {
  const original = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = async (input) => {
    urls.push(String(input));
    return Response.json({ query: { pages: { "1": { extract: "An English description of the book that is long enough to be a useful summary.", langlinks: [{ lang: "ko", "*": "어린 왕자" }] } } } });
  };
  try {
    const description = await fetchBlurb({ ...book, id: "test:english" }, "en");
    assert.equal(description?.lang, "en");
    assert.ok(urls[0].includes("en.wikipedia.org"));
    assert.equal(new URL(urls[0]).searchParams.get("titles"), "The_Little_Prince");
    assert.ok(!urls.some((url) => url.includes("openlibrary.org")));
  } finally { globalThis.fetch = original; }
});

it("resolves a Korean article through language links and fails gracefully without a translation", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (input) => String(input).includes("ko.wikipedia.org")
    ? Response.json({ query: { pages: { "2": { extract: "어린 왕자의 이야기입니다. 독자가 알아볼 수 있도록 충분히 긴 소개 문장을 제공합니다. 이 내용은 한국어 문서에서 가져옵니다." } } } })
    : Response.json({ query: { pages: { "1": { langlinks: [{ lang: "ko", "*": "어린 왕자" }] } } } });
  try {
    const description = await fetchBlurb({ ...book, id: "test:korean" }, "ko");
    assert.equal(description?.lang, "ko");
    assert.ok(description?.sourceUrl.startsWith("https://ko.wikipedia.org/"));
    globalThis.fetch = async () => Response.json({ query: { pages: { "1": { extract: "English text without a translation should never be presented as Korean." } } } });
    assert.equal(await fetchBlurb({ ...book, id: "test:untranslated" }, "ko"), null);
  } finally { globalThis.fetch = original; }
});

it("uses only positive cover identifiers returned by a stored work record and has a missing-cover fallback", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ covers: [-1, 12345] });
  try {
    assert.deepEqual(await fetchCover({ ...book, id: "test:cover" }), { url: "https://covers.openlibrary.org/b/id/12345-L.jpg?default=false" });
    assert.equal(await fetchCover({ ...book, id: "test:no-work", openlibrary_work_id: null }), null);
    globalThis.fetch = async () => Response.json({ covers: [-1] });
    assert.equal(await fetchCover({ ...book, id: "test:no-cover" }), null);
  } finally { globalThis.fetch = original; }
  assert.equal(displayLanguage("fr", "en"), "French");
  assert.equal(displayLanguage("fr", "ko"), "프랑스어");
});

import { makeConfig } from "../src/engine/config.ts";
import { compileCatalog, type Catalog } from "../src/engine/model.ts";
import { applyEvent, deriveState, newSession } from "../src/engine/session.ts";
import { clueNote } from "../src/clueNote.ts";
const config = makeConfig();
const cc = compileCatalog(fixture as unknown as Catalog, config.channel, config.unknownPYes);
function answered() {
  const session = newSession(); const st = deriveState(cc, config, session);
  if (st.action.kind !== "ask") throw Error("expected ask");
  return applyEvent(cc, config, session, { type: "answer", questionId: st.action.question.id, answer: "yes" });
}

it("exports remembered scenes and translated answers without identifiers for contributors", () => {
  const session = answered();
  const state = deriveState(cc, config, session);
  const text = clueNote("  A scene in a forest  ", cc, state, "en");
  assert.ok(text.includes("A scene in a forest"));
  assert.ok(text.includes(cc.questions[state.answers[0].questionIndex].text));
  assert.ok(text.includes(" — Yes"));
  assert.ok(!text.includes("contributor"));
  assert.ok(clueNote("숲", cc, state, "ko").includes(" — 예"));
});
