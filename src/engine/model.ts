// Types, the five-answer response channel and the likelihood function.
// Pure TypeScript: used identically by the React UI, the tests and the Node simulator.

export const ANSWERS = ["yes", "probably", "dont_know", "probably_not", "no"] as const;
export type Answer = (typeof ANSWERS)[number];

export const ANSWER_LABELS: Record<Answer, string> = {
  yes: "Yes",
  probably: "Probably",
  dont_know: "Don't know",
  probably_not: "Probably not",
  no: "No",
};

/** P(answer | fact is Yes) and P(answer | fact is No). Each column must sum to 1. */
export interface ChannelRow {
  givenYes: number;
  givenNo: number;
}
export type Channel = Record<Answer, ChannelRow>;

// ---------------------------------------------------------------------------
// Catalog schema (the JSON contract from the build brief, section 6)
// ---------------------------------------------------------------------------

/** machine_labelled_unreviewed: labels made by an AI assistant from quoted source text; no human review. */
export type DataStatus = "development_fixture" | "machine_labelled_unreviewed" | "production";
export type FeatureStatus =
  | "supported"
  | "ambiguous"
  | "insufficient_evidence"
  | "unreviewed_fixture"
  /** Accepted by a reviewer from aggregated reader answers (src/community/consensus.ts). */
  | "community_consensus"
  /** An AI assistant's general knowledge of the book; no source. Never shown as source-checked. */
  | "ai_recall"
  /** Reader-supplied hackathon demo data, applied immediately without review. */
  | "demo_contribution";

export const ALLOWED_P_YES = [0.1, 0.3, 0.5, 0.7, 0.9] as const;

export interface CatalogSource {
  id: string;
  url: string;
  license: string;
  attribution?: string;
}

export interface CatalogEdition {
  /** ISBN-13 without hyphens (checksum-validated by scripts/validate_catalog.py). */
  isbn?: string | null;
  language?: string | null;
  title?: string | null;
  /** Which of the book's sources the ISBN was taken from. */
  source_id?: string | null;
}

export interface CatalogBook {
  id: string;
  title_en: string;
  title_ko: string | null;
  aliases: string[];
  author: string;
  original_language: string;
  first_publication_year: number | null;
  series_id: string | null;
  series_number: number | null;
  openlibrary_work_id: string | null;
  editions: CatalogEdition[];
  sources: CatalogSource[];
  /** Set on a SERIES target: the reader confirms the series, then picks the volume from this list. */
  volumes?: { id: string; title: string; number: number | null }[];
}

export interface CatalogQuestion {
  id: string;
  text: string;
  definition: string;
  group: string;
  recallability: number;
  adaptation_sensitive: boolean;
  category?: string;
  /** Inactive questions stay in the bank but are never asked (e.g. q56 until "short novel" is defined). */
  active?: boolean;
  inactive_reason?: string;
}

export interface CatalogFeature {
  book_id: string;
  question_id: string;
  p_yes: number;
  status: FeatureStatus;
  source_ids: string[];
  reviewed: boolean;
  note?: string;
  /** Provenance for status "community_consensus": which aggregation produced the value. */
  consensus?: CatalogConsensusRef;
}

export interface CatalogConsensusRef {
  algorithm_version: string;
  /** feature_consensus.id in the contribution database. */
  consensus_id: number;
  /** Distinct readers whose answers were counted. */
  contributors: number;
}

export interface Catalog {
  catalog_version: string;
  data_status: DataStatus;
  notice?: string;
  /** Attribution line for the data sources, shown in the footer. */
  credits?: string;
  /** Source records imported vs. books the game can actually identify. Never show the first as the second. */
  coverage?: {
    imported_source_records: number;
    labelled_with_validated_matrix: number;
    records_with_human_reviewed_cells: number;
    playable_game_targets: number;
    /** Titles the reader can reach: one per single-book target plus every volume of a series target. */
    titles_reachable?: number;
  };
  books: CatalogBook[];
  questions: CatalogQuestion[];
  features: CatalogFeature[];
}

// ---------------------------------------------------------------------------
// Compiled form used by the engine
// ---------------------------------------------------------------------------

export interface CompiledCatalog {
  catalog: Catalog;
  books: CatalogBook[];
  questions: CatalogQuestion[];
  bookIndex: Map<string, number>;
  questionIndex: Map<string, number>;
  /** x[q][b] = probability that question q is factually Yes for book b (0.5 when unknown). */
  x: Float64Array[];
  /** feature[q][b] — the stored feature row, if any (for explanations). */
  feature: (CatalogFeature | undefined)[][];
  /** logL[q][answerIdx][b] = log L[b,q,a]. Precomputed once per catalog + channel. */
  logL: Float64Array[][];
  /** L[q][answerIdx][b] = L[b,q,a] (linear), for the information-gain inner loop. */
  L: Float64Array[][];
}

export function answerIndex(a: Answer): number {
  const i = ANSWERS.indexOf(a);
  if (i < 0) throw new Error(`Unknown answer: ${String(a)}`);
  return i;
}

/** L[b,q,a] = x × channel[a].givenYes + (1 − x) × channel[a].givenNo */
export function likelihood(x: number, a: Answer, channel: Channel): number {
  const row = channel[a];
  return x * row.givenYes + (1 - x) * row.givenNo;
}

export function validateChannel(channel: Channel): void {
  let sumYes = 0;
  let sumNo = 0;
  for (const a of ANSWERS) {
    const row = channel[a];
    if (!row) throw new Error(`Channel is missing answer "${a}"`);
    if (!(row.givenYes > 0) || !(row.givenNo > 0)) {
      // A zero entry would let a normal answer hard-eliminate a candidate.
      throw new Error(`Channel entries must be strictly positive (answer "${a}")`);
    }
    sumYes += row.givenYes;
    sumNo += row.givenNo;
  }
  if (Math.abs(sumYes - 1) > 1e-9 || Math.abs(sumNo - 1) > 1e-9) {
    throw new Error(`Channel columns must each sum to 1 (got ${sumYes}, ${sumNo})`);
  }
}

/**
 * Builds the dense matrix and precomputed log-likelihoods. Throws on structural
 * problems (duplicates, dangling references, out-of-range probabilities) so a broken
 * catalog fails loudly at load time rather than producing silent nonsense in a demo.
 * Full content validation lives in scripts/validate_catalog.py.
 */
export function compileCatalog(
  catalog: Catalog,
  channel: Channel,
  unknownPYes = 0.5,
): CompiledCatalog {
  validateChannel(channel);
  const books = catalog.books;
  const questions = catalog.questions;
  if (books.length === 0) throw new Error("Catalog has no books");
  if (questions.length === 0) throw new Error("Catalog has no questions");

  const bookIndex = new Map<string, number>();
  books.forEach((b, i) => {
    if (bookIndex.has(b.id)) throw new Error(`Duplicate book id ${b.id}`);
    bookIndex.set(b.id, i);
  });
  const questionIndex = new Map<string, number>();
  questions.forEach((q, i) => {
    if (questionIndex.has(q.id)) throw new Error(`Duplicate question id ${q.id}`);
    if (!(q.recallability > 0 && q.recallability <= 1)) {
      throw new Error(`Question ${q.id} recallability must be in (0, 1]`);
    }
    questionIndex.set(q.id, i);
  });

  const N = books.length;
  const x = questions.map(() => new Float64Array(N).fill(unknownPYes));
  const feature: (CatalogFeature | undefined)[][] = questions.map(() =>
    new Array<CatalogFeature | undefined>(N).fill(undefined),
  );
  for (const f of catalog.features) {
    const b = bookIndex.get(f.book_id);
    const q = questionIndex.get(f.question_id);
    if (b === undefined) throw new Error(`Feature references unknown book ${f.book_id}`);
    if (q === undefined) throw new Error(`Feature references unknown question ${f.question_id}`);
    if (feature[q][b]) throw new Error(`Duplicate feature ${f.book_id}/${f.question_id}`);
    if (!(f.p_yes >= 0 && f.p_yes <= 1)) {
      throw new Error(`Feature ${f.book_id}/${f.question_id} p_yes out of range`);
    }
    x[q][b] = f.p_yes;
    feature[q][b] = f;
  }

  const L = questions.map((_, q) =>
    ANSWERS.map((a) => {
      const row = new Float64Array(N);
      for (let b = 0; b < N; b++) row[b] = likelihood(x[q][b], a, channel);
      return row;
    }),
  );
  const logL = L.map((rows) => rows.map((row) => row.map(Math.log)));

  return { catalog, books, questions, bookIndex, questionIndex, x, feature, logL, L };
}
