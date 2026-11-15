// Demo-only reader additions. Stored apart from immutable curated releases; no review queue.
import { ANSWERS, type Answer, type Catalog, type CatalogFeature } from "../engine/model.ts";

export interface DemoContribution {
  id: string;
  catalog_version: string;
  book_id?: string;
  title: string;
  author: string;
  title_ko?: string;
  notes: string;
  answers: { question_id: string; answer: Answer }[];
  questions: { text: string; answer: Answer }[];
}
export const DEMO_STORAGE_KEY = "bookinator-demo-contributions-v1";
export const DEMO_REMOTE_KEY = "__BOOKINATOR_DEMO_CONTRIBUTIONS__";
export const normalizeDemoText = (text: string) => text.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim();
const probability: Record<Answer, number> = { yes: .9, probably: .7, dont_know: .5, probably_not: .3, no: .1 };

/** Stable identity for the same reader-written question, including across browsers. */
export function demoQuestionId(text: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const char of normalizeDemoText(text)) hash = BigInt.asUintN(64, (hash ^ BigInt(char.codePointAt(0)!)) * 0x100000001b3n);
  return `demo-q:${hash.toString(16)}`;
}

export function validDemoContribution(raw: unknown): raw is DemoContribution {
  if (!raw || typeof raw !== "object") return false;
  const v = raw as DemoContribution;
  return typeof v.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.id)
    && typeof v.catalog_version === "string" && v.catalog_version.length <= 150
    && (v.book_id === undefined || (typeof v.book_id === "string" && v.book_id.length <= 200))
    && typeof v.title === "string" && v.title.trim().length > 0 && v.title.length <= 300
    && typeof v.author === "string" && v.author.length <= 200
    && (v.title_ko === undefined || (typeof v.title_ko === "string" && v.title_ko.length <= 300))
    && typeof v.notes === "string" && v.notes.length <= 2000
    && Array.isArray(v.answers) && v.answers.length <= 2000 && v.answers.every((a) => a && typeof a.question_id === "string" && a.question_id.length <= 200 && ANSWERS.includes(a.answer))
    && Array.isArray(v.questions) && v.questions.length <= 20 && v.questions.every((q) => q && typeof q.text === "string" && q.text.trim().length >= 5 && q.text.length <= 500 && ANSWERS.includes(q.answer));
}

export function readDemoContributions(): DemoContribution[] {
  try {
    const raw: unknown = JSON.parse(globalThis.localStorage?.getItem(DEMO_STORAGE_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter(validDemoContribution) : [];
  } catch { return []; }
}

export function storeDemoContribution(entry: DemoContribution): void {
  if (!validDemoContribution(entry)) throw new Error("Invalid demo contribution");
  const entries = readDemoContributions().filter((item) => item.id !== entry.id);
  // Never claim success when storage is blocked or full.
  globalThis.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify([...entries, entry]));
}

/** Unknown cells stay unknown; these reader-supplied labels are never marked source-checked. */
export function applyDemoContributions(base: Catalog, raw: unknown[]): Catalog {
  const entries = raw.filter(validDemoContribution).filter((entry) => entry.catalog_version === base.catalog_version);
  if (!entries.length) return base;
  const books = [...base.books], questions = [...base.questions];
  const features = new Map(base.features.map((feature) => [`${feature.book_id}\n${feature.question_id}`, feature]));
  const questionTexts = new Map(questions.map((q) => [normalizeDemoText(q.text), q.id]));
  for (const entry of entries) {
    const exact = books.filter((book) => [book.title_en, book.title_ko, ...book.aliases].some((title) => title && normalizeDemoText(title) === normalizeDemoText(entry.title))
      && (!entry.author || normalizeDemoText(book.author) === normalizeDemoText(entry.author)));
    let book = books.find((b) => b.id === entry.book_id) ?? (exact.length === 1 ? exact[0] : undefined);
    if (!book) {
      book = { id: `demo-book:${entry.id}`, title_en: entry.title.trim(), title_ko: entry.title_ko ?? null, author: entry.author.trim(), aliases: [], original_language: "und", first_publication_year: null,
        series_id: null, series_number: null, openlibrary_work_id: null, editions: [], sources: [] };
      books.push(book);
    }
    const setAnswer = (questionId: string, answer: Answer) => {
      if (!questions.some((q) => q.id === questionId && q.active !== false)) return;
      const feature: CatalogFeature = { book_id: book.id, question_id: questionId, p_yes: probability[answer], status: "demo_contribution", reviewed: false, source_ids: [], note: "Reader-supplied demo answer; applied without review." };
      features.set(`${book.id}\n${questionId}`, feature);
    };
    for (const answer of entry.answers) setAnswer(answer.question_id, answer.answer);
    for (const item of entry.questions) {
      const text = item.text.trim(), normalized = normalizeDemoText(text);
      let id = questionTexts.get(normalized);
      if (!id) {
        id = demoQuestionId(text);
        questions.push({ id, text, definition: "Reader-written demo question; not independently verified.", group: id, recallability: 1, adaptation_sensitive: false, active: true, category: "demo" });
        questionTexts.set(normalized, id);
      }
      setAnswer(id, item.answer);
    }
  }
  const extraBooks = books.length - base.books.length;
  return { ...base, books, questions, features: [...features.values()],
    ...(base.coverage ? { coverage: { ...base.coverage, playable_game_targets: books.length, titles_reachable: (base.coverage.titles_reachable ?? base.books.length) + extraBooks } } : {}) };
}
