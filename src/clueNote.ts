import type { CompiledCatalog } from "./engine/model.ts";
import type { SessionState } from "./engine/session.ts";
import { ANSWER_TEXT, questionText, type Lang } from "./i18n/index.ts";

/** A local note for a librarian, deliberately separate from catalog submissions and their consent. */
export function clueNote(memory: string, cc: CompiledCatalog, state: SessionState, lang: Lang): string {
  return [
    "Bookinator", "", memory.trim(), "",
    ...state.answers.map((answer) => `${questionText(cc.questions[answer.questionIndex], lang)} — ${ANSWER_TEXT[lang][answer.answer]}`),
    "", `Collection: ${cc.catalog.catalog_version}`,
  ].join("\n");
}
