import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { asCatalogBook, factsFor, findEntry, LIBRARY_BOOKS, PAGE_SIZE, queryLibrary } from "../src/data/library.ts";
import { parseRoute, href } from "../src/router.ts";

const base = { q: "", tag: "", status: "all" as const, sort: "rank" as const, page: 1 };

describe("catalog pages", () => {
  it("pages through every book exactly once", () => {
    const first = queryLibrary(base, "ko");
    const seen = new Set<string>();
    for (let page = 1; page <= first.pages; page++) queryLibrary({ ...base, page }, "ko").items.forEach((b) => seen.add(b.id));
    assert.equal(seen.size, LIBRARY_BOOKS.length);
    assert.equal(first.items.length, Math.min(PAGE_SIZE, LIBRARY_BOOKS.length));
  });

  it("filters by tag and status, and searches Korean and English titles", () => {
    const sea = queryLibrary({ ...base, tag: "sea" }, "ko");
    assert.ok(sea.total > 0 && sea.items.every((b) => b.tags.includes("sea")));
    const coming = queryLibrary({ ...base, status: "candidate" }, "ko");
    assert.ok(coming.items.every((b) => b.status === "candidate"));
    assert.ok(queryLibrary({ ...base, q: "해리 포터" }, "ko").total >= 1);
    assert.ok(queryLibrary({ ...base, q: "orwell" }, "en").items.some((b) => /Nineteen Eighty-Four|1984/.test(b.title)));
  });

  it("a page past the end shows the last page", () => {
    const r = queryLibrary({ ...base, page: 9999 }, "en");
    assert.equal(r.page, r.pages);
  });

  it("every playable book has labels to describe it, and a source to fetch its story from", () => {
    for (const b of LIBRARY_BOOKS.filter((x) => x.status !== "candidate")) {
      assert.ok(factsFor(b).length > 0, `${b.title} has no labels`);
      assert.ok(asCatalogBook(b).sources.length > 0 || b.openlibrary, `${b.title} has no source`);
    }
  });
});

describe("hash router", () => {
  it("round-trips a book page and catalog parameters", () => {
    const id = "cmu:enwiki:23454753";
    assert.deepEqual(parseRoute(href("book", { id })).id, id);
    assert.ok(findEntry(id));
    const r = parseRoute(href("catalog", { params: { tag: "sea", page: 2, q: "" } }));
    assert.equal(r.page, "catalog");
    assert.equal(r.params.get("tag"), "sea");
    assert.equal(r.params.get("q"), null);
    assert.equal(parseRoute("#/nowhere").page, "home");
  });
});
