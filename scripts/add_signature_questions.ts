// Adds the demo's book-specific "signature" questions (data/signature/signature_questions.json) to the
// research catalog and applies its corrections. Idempotent: earlier signature questions and their cells are
// removed first. Re-run after every rebuild or apply_ai_recall.ts, then scripts/gate_catalog.ts.
//
//   npx tsx scripts/add_signature_questions.ts [--catalog src/data/cmu.catalog.json]

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Catalog, CatalogFeature, CatalogQuestion } from "../src/engine/model.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const at = process.argv.indexOf("--catalog");
const catalogPath = resolve(ROOT, at > 0 ? process.argv[at + 1] : "src/data/cmu.catalog.json");

interface Signature { id: string; target: string; also?: string[]; text: string; ko: string; definition: string; unknown_for: string[] }
const spec = JSON.parse(readFileSync(resolve(ROOT, "data/signature/signature_questions.json"), "utf8")) as {
  questions: Signature[];
  corrections: Record<string, string[] | string>;
};

const catalog = JSON.parse(readFileSync(catalogPath, "utf8")) as Catalog;
const bookIds = new Set(catalog.books.map((b) => b.id));
for (const q of spec.questions) {
  for (const id of [q.target, ...(q.also ?? []), ...q.unknown_for]) if (!bookIds.has(id)) throw new Error(`${q.id}: unknown book ${id}`);
  if (!/^s\d{2}$/.test(q.id)) throw new Error(`${q.id}: signature ids are s01, s02, …`);
}

// 1. drop earlier signature questions/cells (idempotent)
catalog.questions = catalog.questions.filter((q) => !/^s\d{2}$/.test(q.id));
catalog.features = catalog.features.filter((f) => !/^s\d{2}$/.test(f.question_id));

// 2. corrections: contradicted cells become unknown (removed), never flipped
let corrected = 0;
for (const [bookId, qids] of Object.entries(spec.corrections)) {
  if (!Array.isArray(qids)) continue; // the "notice" entry
  if (!bookIds.has(bookId)) throw new Error(`corrections: unknown book ${bookId}`);
  const drop = new Set(qids);
  const before = catalog.features.length;
  catalog.features = catalog.features.filter((f) => !(f.book_id === bookId && drop.has(f.question_id)));
  corrected += before - catalog.features.length;
}

// 3. questions + cells
const cell = (book_id: string, question_id: string, p_yes: number): CatalogFeature =>
  ({ book_id, question_id, p_yes, status: "ai_recall", source_ids: [], reviewed: false });
for (const s of spec.questions) {
  catalog.questions.push({ id: s.id, category: "signature", group: `signature_${s.id}`, recallability: 1,
    adaptation_sensitive: false, text: s.text, definition: s.definition } as CatalogQuestion);
  const yes = new Set([s.target, ...(s.also ?? [])]);
  const unknown = new Set(s.unknown_for);
  for (const b of catalog.books) {
    if (unknown.has(b.id)) continue;
    catalog.features.push(cell(b.id, s.id, yes.has(b.id) ? 0.9 : 0.1));
  }
}
(catalog as Catalog & { signature_questions?: unknown }).signature_questions = {
  questions: spec.questions.length, corrected_cells_set_to_unknown: corrected,
  note: "Demo signature questions from data/signature/signature_questions.json: AI general knowledge, no source, not reviewed.",
};
writeFileSync(catalogPath, JSON.stringify(catalog) + "\n");

// keep the research question bank (checked by `npm run validate:cmu`) in step with the catalog
const bankPath = resolve(ROOT, "data/cmu/question_bank_core.json");
const bank = JSON.parse(readFileSync(bankPath, "utf8")) as { questions: CatalogQuestion[] };
bank.questions = [...bank.questions.filter((q) => !/^s\d{2}$/.test(q.id)), ...catalog.questions.filter((q) => /^s\d{2}$/.test(q.id))];
writeFileSync(bankPath, JSON.stringify(bank, null, 1) + "\n");
console.log(`${spec.questions.length} signature questions, ${corrected} corrected cells → ${catalogPath}`);
