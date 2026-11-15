import assert from "node:assert/strict";
import { it } from "node:test";
import covers from "../src/data/catalog-covers.json";
import fixture from "../src/data/fixture.catalog.json";
import research from "../src/data/cmu.catalog.json";
import type { CatalogBook } from "../src/engine/model.ts";

const normalize = (text: string) => text.normalize("NFKD").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

it("every catalog cover has a valid source and belongs to a stored work or an exact title and author match", () => {
  const books = new Map(([...fixture.books, ...research.books] as CatalogBook[]).map((book) => [book.id, book]));
  assert.ok(Object.keys(covers.books).length > 0);
  for (const [id, cover] of Object.entries(covers.books)) {
    const book = books.get(id);
    assert.ok(book, `orphan cover: ${id}`);
    assert.ok(!book.volumes, `a series must not borrow a volume's cover: ${id}`);
    assert.ok(Number.isSafeInteger(cover.coverId) && cover.coverId > 0, id);
    assert.match(cover.workUrl, /^https:\/\/openlibrary\.org\/works\/OL\d+W$/);
    if (book.openlibrary_work_id) {
      assert.equal(cover.workUrl, `https://openlibrary.org/works/${book.openlibrary_work_id}`);
    } else {
      assert.ok([book.title_en, ...book.aliases].map(normalize).includes(normalize(cover.title)), id);
      assert.equal(normalize(cover.author), normalize(book.author), id);
    }
  }
});
