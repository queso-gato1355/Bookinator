import { useMemo, useRef, useState, type FormEvent, type RefObject } from "react";
import { saveDemoContribution, errorKind } from "../community/client.ts";
import { normalizeDemoText, type DemoContribution } from "../community/demo.ts";
import { cleanText, searchLocal } from "../community/search.ts";
import type { Answer, CatalogBook } from "../engine/model.ts";
import type { Session, SessionState } from "../engine/session.ts";
import { CC, refreshGameCatalog } from "../game.ts";
import { ANSWER_TEXT, bookTitles, type Lang, type Strings } from "../i18n/index.ts";
import type { LibraryStrings } from "../i18n/library.ts";
import { EXPERIENCE } from "../i18n/experience.ts";
import { CONTRIBUTION } from "../i18n/contribution.ts";
import { clueNote } from "../clueNote.ts";
import { ANSWERS } from "../engine/model.ts";
import { Captcha, useContributor } from "./ContributorAuth.tsx";
import { Button, Icon } from "./ui.tsx";

type QuestionRow = { id: number; text: string; answer: Answer | "" };
export function AddBookScreen({ headingRef, state, t, L, lang, onPlayAgain, onUndo, direct = false, onCatalogUpdated }: {
  headingRef: RefObject<HTMLHeadingElement | null>; session: Session; state: SessionState; t: Strings; L: LibraryStrings; lang: Lang;
  onPlayAgain: () => void; onUndo: () => void; direct?: boolean; onCatalogUpdated: () => void;
}) {
  const E = EXPERIENCE[lang], C = CONTRIBUTION[lang];
  const [title, setTitle] = useState(""), [author, setAuthor] = useState(""), [memory, setMemory] = useState("");
  const [unknownTitle, setUnknownTitle] = useState(false), [includeAnswers, setIncludeAnswers] = useState(true);
  const [query, setQuery] = useState(""), [searched, setSearched] = useState<string | null>(null);
  const [rows, setRows] = useState<QuestionRow[]>([{ id: 0, text: "", answer: "" }]);
  const nextRow = useRef(1), sending = useRef(false);
  const [status, setStatus] = useState<{ kind: "idle" | "sending" | "done" | "error"; msg?: string }>({ kind: "idle" });
  const who = useContributor();
  const busy = status.kind === "sending", done = status.kind === "done";
  const local = useMemo(() => searchLocal(CC.books, title, author), [title, author]);
  const found = useMemo(() => searched === null ? [] : [...searchLocal(CC.books, searched, "", 5), ...searchLocal(CC.books, "", searched, 5)].filter((hit, i, hits) => hits.findIndex((other) => other.book.id === hit.book.id) === i).slice(0, 5), [searched]);
  const updateRow = (id: number, change: Partial<QuestionRow>) => setRows((list) => list.map((row) => row.id === id ? { ...row, ...change } : row));

  const save = async (picked?: CatalogBook) => {
    if (sending.current || done) return;
    const cleanTitle = picked?.title_en ?? cleanText(title), cleanAuthor = picked?.author ?? cleanText(author);
    if (!cleanTitle) { setStatus({ kind: "error", msg: t.needTitleAuthor }); return; }
    const filled = rows.filter((row) => row.text.trim() || row.answer);
    if (filled.some((row) => row.text.trim().length < 5 || row.text.trim().length > 500 || !row.answer)) {
      setStatus({ kind: "error", msg: C.invalidQuestion }); return;
    }
    sending.current = true;
    setStatus({ kind: "sending" });
    try {
      const exact = CC.books.filter((book) => [book.title_en, book.title_ko, ...book.aliases].some((name) => name && normalizeDemoText(name) === normalizeDemoText(cleanTitle))
        && (!cleanAuthor || normalizeDemoText(book.author) === normalizeDemoText(cleanAuthor)));
      const known = picked ?? (exact.length === 1 ? exact[0] : undefined);
      const entry: DemoContribution = {
        id: crypto.randomUUID(), catalog_version: CC.catalog.catalog_version,
        ...(known ? { book_id: known.id } : {}), title: cleanTitle, author: cleanAuthor,
        ...(/[가-힣]/.test(cleanTitle) ? { title_ko: cleanTitle } : {}), notes: memory.trim(),
        answers: includeAnswers ? state.answers.map((answer) => ({ question_id: CC.questions[answer.questionIndex].id, answer: answer.answer })) : [],
        questions: filled.map((row) => ({ text: row.text.trim(), answer: row.answer as Answer })),
      };
      const scope = await saveDemoContribution(entry, who.captchaToken ?? undefined);
      refreshGameCatalog();
      onCatalogUpdated();
      setStatus({ kind: "done", msg: scope === "shared" ? C.shared : C.local });
    } catch (error) {
      const kind = errorKind(error);
      setStatus({ kind: "error", msg: kind === "rate_limit" ? t.rateLimited : kind === "invalid" ? t.invalidInput : kind === "blocked" ? t.sendFailed : C.noStorage });
    } finally { sending.current = false; }
  };
  const add = (event: FormEvent) => {
    event.preventDefault();
    if (!unknownTitle) { void save(); return; }
    if (!memory.trim()) { setStatus({ kind: "error", msg: E.memoryRequired }); return; }
    const url = URL.createObjectURL(new Blob([clueNote(memory, CC, state, lang)], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "bookinator-clues.txt";
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus({ kind: "idle", msg: E.clueSaved });
  };
  const matches = (books: { book: CatalogBook }[]) => books.map(({ book }) => <div key={book.id} className="dup-match">
    <span className="lb-cover" aria-hidden="true" /><span className="lb-info"><b>{bookTitles(book, lang).main}</b><span>{book.author || C.unknownAuthor}</span></span>
    <Button variant="secondary" arrow={false} onClick={() => void save(book)} disabled={busy || done}>{L.thisIsIt}</Button>
  </div>);

  return <>
    <section className="nf-hero"><p className="eyebrow">{direct ? "BOOKINATOR" : L.nfEyebrow}</p><h1 ref={headingRef} tabIndex={-1}>{direct ? C.heading : L.nfTitle}</h1><p className="lead-sm">{direct ? C.lead : state.action.kind === "no_match" && state.action.reason === "all_rejected" ? t.allRejectedLine : L.nfLead}</p></section>
    <section className="nf-options">
      <div className="card nf-search"><span className="tile-icon"><Icon name="tileSearch" size={22} /></span><h2>{L.searchTitle}</h2><p className="muted">{C.searchLead}</p>
        <form className="input-row" role="search" onSubmit={(event) => { event.preventDefault(); setSearched(cleanText(query)); }}>
          <label className="sr-only" htmlFor="nf-query">{L.searchPlaceholder}</label><span className="field field-pill"><Icon name="field" /><input id="nf-query" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={L.searchPlaceholder} maxLength={200} /></span><button type="submit" className="btn btn-primary">{L.search}</button>
        </form>
        {searched !== null && <div className="nf-results" aria-live="polite">{found.length ? matches(found) : <p className="hint">{L.searchNone}</p>}</div>}
        <hr /><p className="card-label">{L.otherWays}</p><button type="button" className="link-row" onClick={onPlayAgain}><span>{L.restartQuestions}</span><Icon name="arrowRight" /></button>
        {!direct && <button type="button" className="link-row" onClick={onUndo}><span>{L.backOneStep}</span><Icon name="arrowRight" /></button>}
      </div>
      <form className="card nf-form" onSubmit={add} noValidate>
        <span className="tile-icon"><Icon name="tileRequest" size={22} /></span><h2>{C.heading}</h2><p className="muted">{C.help}</p>
        <label className="check"><input type="checkbox" checked={unknownTitle} onChange={(event) => { setUnknownTitle(event.target.checked); setStatus({ kind: "idle" }); }} disabled={busy || done} /><span>{E.unknownTitle}</span></label>
        {unknownTitle && <p className="hint">{E.clueLead}</p>}
        <div className="field-row" hidden={unknownTitle}>
          <div className="form-field"><label htmlFor="bk-title">{t.title} *</label><input id="bk-title" value={title} onChange={(event) => setTitle(event.target.value)} disabled={busy || done} maxLength={300} required={!unknownTitle} /></div>
          <div className="form-field"><label htmlFor="bk-author">{t.author}</label><input id="bk-author" value={author} onChange={(event) => setAuthor(event.target.value)} disabled={busy || done} maxLength={200} placeholder={L.authorPlaceholder} /></div>
        </div>
        {!!local.length && !done && !unknownTitle && <div className="dup"><p className="dup-head">{L.dupHead}</p>{matches(local)}</div>}
        <div className="form-field"><label htmlFor="bk-memory">{L.memory}{unknownTitle ? " *" : ""}</label><textarea id="bk-memory" value={memory} onChange={(event) => setMemory(event.target.value)} disabled={busy || done} required={unknownTitle} maxLength={1500} placeholder={L.memoryPlaceholder} /></div>
        {!unknownTitle && <fieldset className="demo-question-editor" disabled={busy || done}><legend>{C.questions}</legend><p className="hint">{C.questionHelp}</p>
          {rows.map((row, i) => <div className="demo-question-row" key={row.id}>
            <div className="form-field"><label htmlFor={`demo-question-${row.id}`}>{C.question} {i + 1}</label><input id={`demo-question-${row.id}`} value={row.text} onChange={(event) => updateRow(row.id, { text: event.target.value })} placeholder={C.placeholder} maxLength={500} /></div>
            <div className="form-field"><label htmlFor={`demo-answer-${row.id}`}>{C.answer}</label><select id={`demo-answer-${row.id}`} value={row.answer} onChange={(event) => updateRow(row.id, { answer: event.target.value as Answer | "" })}><option value="">—</option>{ANSWERS.map((answer) => <option key={answer} value={answer}>{ANSWER_TEXT[lang][answer]}</option>)}</select></div>
            <button type="button" className="text-btn demo-remove-question" onClick={() => setRows((list) => list.filter((item) => item.id !== row.id))} aria-label={`${C.removeQuestion} ${i + 1}`}>{C.removeQuestion}</button>
          </div>)}
          {rows.length < 20 && <Button variant="secondary" arrow={false} onClick={() => setRows((list) => [...list, { id: nextRow.current++, text: "", answer: "" }])}>{C.addQuestion}</Button>}
        </fieldset>}
        {!!state.answers.length && !unknownTitle && <label className="check consent"><input type="checkbox" checked={includeAnswers} onChange={(event) => setIncludeAnswers(event.target.checked)} disabled={busy || done} /><span>{C.include(state.answers.length)}</span></label>}
        {!unknownTitle && <p className="hint">{C.savedDetails}</p>}
        {who.needsCaptcha && !done && !unknownTitle && <Captcha onToken={who.setToken} lang={lang} />}
        {status.msg && <p className={status.kind === "error" ? "form-error" : "form-note"} role="status">{status.msg}</p>}
        <div className="submit-row"><p className="hint">{L.required}</p>{done ? <Button onClick={onPlayAgain}>{t.playAgain}</Button> : <button type="submit" className="btn btn-primary" disabled={busy}><span>{unknownTitle ? E.saveClues : busy ? C.saving : C.save}</span><Icon name="arrowRightWhite" /></button>}</div>
      </form>
    </section>
  </>;
}
