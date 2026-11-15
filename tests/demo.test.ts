import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEMO_BOOK_IDS, DEMO_SEED, demoHref, isDemoMode } from "../src/demo.ts";
import { rehearsal } from "../scripts/demo_rehearsal.ts";
import { makeConfig } from "../src/engine/config.ts";
import { catalogLinks } from "../src/engine/links.ts";
import fixture from "../src/data/fixture.catalog.json";
import type { CatalogBook } from "../src/engine/model.ts";

describe("honest live challenge", () => {
  it("keeps the challenge on the classic collection and preserves hosted subpaths", () => {
    assert.equal(isDemoMode("?collection=classic&demo=1"), true);
    assert.equal(isDemoMode("?collection=research&demo=1"), false);
    assert.equal(isDemoMode("?demo=1"), false);
    assert.equal(isDemoMode("?collection=classic"), false);
    assert.equal(demoHref("https://example.com/Bookinator/?collection=research#catalog"), "/Bookinator/?collection=classic&demo=1#live-challenge");
  });

  for (const id of DEMO_BOOK_IDS) it(`identifies ${id} with the ordinary engine and unchanged thresholds`, () => {
    const run = rehearsal(id);
    assert.equal(run.found, true);
    assert.equal(run.questions, 6);
    assert.deepEqual(run.session.options, { filmMemoryMode: false, seed: DEMO_SEED });
    assert.equal(run.steps.filter((step) => step.type === "guess").length, 1);
    assert.equal(run.session.events.at(-1)?.type, "accept");
    assert.ok(run.session.events.every((event) => ["answer", "reject", "accept", "suggest"].includes(event.type)));
    assert.equal(makeConfig().guessMinProbability, .8);
  });

  it("recovers from an actual early wrong guess without giving the runtime the target", () => {
    const run = rehearsal("fx-murder-orient-express", 1);
    const guesses = run.steps.filter((step) => step.type === "guess");
    assert.equal(run.found, true);
    assert.equal(run.questions, 7);
    assert.equal(guesses.length, 2);
    assert.equal(guesses[0].accepted, false);
    assert.notEqual(guesses[0].bookId, run.bookId);
    assert.equal(guesses[1].accepted, true);
    assert.deepEqual(Object.keys(run.session.options).sort(), ["filmMemoryMode", "seed"]);
    assert.deepEqual(run.steps, rehearsal("fx-murder-orient-express", 1).steps);
  });
});

it("distinguishes a verified local catalog template from an Open Library work record", () => {
  const book = fixture.books[0] as CatalogBook;
  assert.equal(catalogLinks(book)[0].kind, "open_library");
  const links = catalogLinks(book, { localSearchTemplate: "https://library.example/search?q={query}", localSearchLabel: "University catalog" });
  const local = links.find((link) => link.kind === "local")!;
  assert.equal(local.label, "University catalog");
  assert.equal(new URL(local.url).searchParams.get("q"), book.title_ko);
  assert.equal(catalogLinks(book, { localSearchTemplate: "javascript:alert(1)" }).some((link) => link.kind === "local"), false);
});
