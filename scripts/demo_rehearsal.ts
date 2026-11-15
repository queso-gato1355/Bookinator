// Rehearsal traces from the real engine and its own labels. Internal consistency, not factual accuracy.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import fixture from "../src/data/fixture.catalog.json";
import { DEMO_BOOK_IDS, DEMO_SEED } from "../src/demo.ts";
import { makeConfig } from "../src/engine/config.ts";
import { ANSWER_LABELS, compileCatalog, type Answer, type Catalog } from "../src/engine/model.ts";
import { applyEvent, deriveState, newSession, type Session } from "../src/engine/session.ts";

const config = makeConfig();
const cc = compileCatalog(fixture as unknown as Catalog, config.channel, config.unknownPYes);
export type DemoStep =
  | { type: "answer"; questionId: string; question: string; answer: Answer }
  | { type: "guess"; bookId: string; title: string; accepted: boolean };

export function rehearsal(bookId: string, earlyGuessAfter?: number) {
  const target = cc.bookIndex.get(bookId);
  if (target === undefined) throw new Error(`Unsupported rehearsal target ${bookId}`);
  let session: Session = newSession({ seed: DEMO_SEED });
  let requested = false;
  const steps: DemoStep[] = [];
  for (let i = 0; i < config.maxQuestions + config.maxRejections * 2 + 5; i++) {
    const state = deriveState(cc, config, session);
    const action = state.action;
    if (action.kind === "ask") {
      if (!requested && earlyGuessAfter !== undefined && state.answers.length >= earlyGuessAfter && state.informativeAnswers > 0) {
        requested = true;
        session = applyEvent(cc, config, session, { type: "suggest" });
        continue;
      }
      const x = cc.x[action.questionIndex][target];
      const answer: Answer = x >= .85 ? "yes" : x >= .65 ? "probably" : x <= .15 ? "no" : x <= .35 ? "probably_not" : "dont_know";
      steps.push({ type: "answer", questionId: action.question.id, question: action.question.text, answer });
      session = applyEvent(cc, config, session, { type: "answer", questionId: action.question.id, answer });
    } else if (action.kind === "guess") {
      const accepted = action.bookIndex === target;
      steps.push({ type: "guess", bookId: action.book.id, title: action.book.title_en, accepted });
      session = applyEvent(cc, config, session, { type: accepted ? "accept" : "reject", bookId: action.book.id });
      if (accepted) break;
    } else break;
  }
  const state = deriveState(cc, config, session);
  return { bookId, title: cc.books[target].title_en, questions: state.answers.length, found: state.action.kind === "found", steps, session };
}

function report(): string {
  const cases = DEMO_BOOK_IDS.map((id) => rehearsal(id));
  const recovery = rehearsal("fx-murder-orient-express", 1);
  const lines = ["# Demo rehearsal traces", "", "Generated with `npm run rehearse`. These are deterministic checks against the prototype’s own labels, not measured accuracy or instructions for an audience member. Check the answers against your own reading before presenting.", "", `Live route: \`?collection=classic&demo=1\`. Question-order seed: ${DEMO_SEED}. The game still searches all 10 classic books, with unchanged matching thresholds. The audience does not select a target in the app.`, ""];
  for (const run of [...cases, recovery]) {
    lines.push(`## ${run.title}${run === recovery ? " — early wrong-guess recovery" : ""}`, "", `Outcome: ${run.found ? "confirmed" : "not confirmed"}; ${run.questions} answers.`, "", "| Step | Question or guess | Rehearsal action |", "| --- | --- | --- |");
    run.steps.forEach((step, i) => lines.push(step.type === "answer"
      ? `| ${i + 1} | ${step.question.replace(/\|/g, "\\|")} | ${ANSWER_LABELS[step.answer]} |`
      : `| ${i + 1} | Guess: ${step.title} | ${step.accepted ? "That’s it" : "No, keep asking"} |`));
    if (run === recovery) lines.push("", "After the first answer, press **Show your best guess**. The tentative wrong book is rejected through the ordinary game flow; the remaining answers lead to the target. Do not reject a correct book just to manufacture a miss.");
    lines.push("");
  }
  return lines.join("\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const content = report();
  if (process.argv.includes("--write")) writeFileSync(new URL("../docs/demo-rehearsal.md", import.meta.url), content);
  else console.log(content);
}
