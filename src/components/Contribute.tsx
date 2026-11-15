// Contribution UI (docs/community/DESIGN.md §2): the "05 · Result — Not Found" screen after a miss, and the opt-in
// "send my answers" card after a hit. D1 anonymous sign-in (+ Turnstile when configured),
// D2 nothing leaves the browser unless the reader asks on this screen.
import { useEffect, useMemo, useRef, useState, type FormEvent, type RefObject } from "react";
import {
  contributionsEnabled,
  ensureSignedIn,
  errorKind,
  isSignedIn,
  searchBooksRemote,
  submitBook,
  submitFeatureAnswers,
  submitGameSession,
  SUPABASE_CONFIG,
  type RemoteBookHit,
} from "../community/client.ts";
import { sessionPayload } from "../community/payload.ts";
import { cleanText, searchLocal } from "../community/search.ts";
import type { CatalogBook } from "../engine/model.ts";
import type { Session, SessionState } from "../engine/session.ts";
import { CC } from "../game.ts";
import { bookTitles, type Lang, type Strings } from "../i18n/index.ts";
import type { LibraryStrings } from "../i18n/library.ts";
import { EXPERIENCE } from "../i18n/experience.ts";
import { clueNote } from "../clueNote.ts";
import { Button, Icon } from "./ui.tsx";

// ---------------------------------------------------------------- sign-in + CAPTCHA

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let turnstileScript: Promise<void> | null = null;
function loadTurnstile(): Promise<void> {
  turnstileScript ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("captcha script failed to load"));
    document.head.appendChild(s);
  });
  return turnstileScript;
}

function Captcha({ onToken, lang }: { onToken: (t: string | null) => void; lang: Lang }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let id: string | null = null;
    let cancelled = false;
    loadTurnstile()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        id = window.turnstile.render(ref.current, {
          sitekey: SUPABASE_CONFIG.turnstileSiteKey,
          language: lang,
          callback: (token: string) => onToken(token),
          "expired-callback": () => onToken(null),
          "error-callback": () => onToken(null),
        });
      })
      .catch(() => onToken(null));
    return () => {
      cancelled = true;
      if (id && window.turnstile) window.turnstile.remove(id);
    };
  }, [onToken, lang]);
  return <div ref={ref} className="captcha" />;
}

/** Whether a CAPTCHA token is still needed before the first anonymous sign-in. */
function useContributor() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    if (!contributionsEnabled) return;
    isSignedIn().then(setSignedIn, () => setSignedIn(false));
  }, []);
  const needsCaptcha = Boolean(SUPABASE_CONFIG.turnstileSiteKey) && signedIn === false;
  return {
    needsCaptcha,
    ready: contributionsEnabled && signedIn !== null && (!needsCaptcha || token !== null),
    setToken,
    signIn: async () => {
      await ensureSignedIn(token ?? undefined);
      setSignedIn(true);
    },
  };
}

// ---------------------------------------------------------------- after a hit: opt-in answers

export function ShareAnswers({ session, state, t, lang }: { session: Session; state: SessionState; t: Strings; lang: Lang }) {
  const [status, setStatus] = useState<"ask" | "sending" | "sent" | "declined" | "error">("ask");
  const who = useContributor();
  const payload = useMemo(() => sessionPayload(CC, session, state), [session, state]);
  if (!contributionsEnabled || !payload) return null;
  if (status === "declined") return null;

  const send = async () => {
    setStatus("sending");
    try {
      await who.signIn();
      await submitGameSession(payload);
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  };
  return (
    <div className="card share-card" aria-live="polite">
      {status === "sent" ? (
        <p className="share-done">{t.shared}</p>
      ) : (
        <>
          <p className="share-q">{t.shareAnswersQ}</p>
          <p className="share-help">{t.sendAnswersHelp}</p>
          {who.needsCaptcha && <Captcha onToken={who.setToken} lang={lang} />}
          {status === "error" && <p className="form-error">{t.sendFailed}</p>}
          <div className="share-actions">
            <button type="button" className="btn btn-primary" onClick={send} disabled={!who.ready || status === "sending"}>
              {status === "sending" ? t.sending : t.shareAnswersYes}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setStatus("declined")}>
              {t.shareAnswersNo}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- after a miss: which book was it?

type Pick = { kind: "local"; book: CatalogBook } | { kind: "remote"; hit: RemoteBookHit };

function hangul(s: string) {
  return /[ㄱ-ㆎ가-힣]/.test(s);
}

export function AddBookScreen({
  headingRef,
  session,
  state,
  t,
  L,
  lang,
  onPlayAgain,
  onUndo,
}: {
  headingRef: RefObject<HTMLHeadingElement | null>;
  session: Session;
  state: SessionState;
  t: Strings;
  L: LibraryStrings;
  lang: Lang;
  onPlayAgain: () => void;
  onUndo: () => void;
}) {
  const E = EXPERIENCE[lang];
  const [unknownTitle, setUnknownTitle] = useState(false);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [memory, setMemory] = useState("");
  const [kinds, setKinds] = useState<number[]>([]);
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState<string | null>(null);
  const [searchedRemote, setSearchedRemote] = useState<RemoteBookHit[]>([]);
  const [consent, setConsent] = useState(false);
  const [remote, setRemote] = useState<RemoteBookHit[]>([]);
  const [confirmDup, setConfirmDup] = useState(false);
  const [status, setStatus] = useState<{ kind: "idle" | "sending" | "done" | "error"; msg?: string }>({ kind: "idle" });
  const sessionId = useRef<string | null>(null);
  const who = useContributor();

  const local = useMemo(() => searchLocal(CC.books, title, author), [title, author]);

  // Server-side duplicate search (published books from every release + open submissions).
  useEffect(() => {
    setConfirmDup(false);
    if (unknownTitle || !contributionsEnabled || title.trim().length < 2) {
      setRemote([]);
      return;
    }
    const q = `${title} ${author}`.trim();
    const timer = setTimeout(() => {
      searchBooksRemote(q, 5).then(
        (hits) => setRemote(hits.filter((h) => !(h.kind === "book" && CC.bookIndex.has(h.id)))),
        () => setRemote([]),
      );
    }, 350);
    return () => clearTimeout(timer);
  }, [title, author, unknownTitle]);

  const reason = state.action.kind === "no_match" ? state.action.reason : "user_exit";
  const busy = status.kind === "sending";
  const done = status.kind === "done";

  /** Sends this game's answers once (only with consent), optionally naming a book from this catalog. */
  const sendSession = async (identified: string | null = null): Promise<string | null> => {
    if (!consent) return null;
    if (sessionId.current) return sessionId.current;
    const payload = sessionPayload(CC, session, state, identified);
    if (!payload) return null;
    sessionId.current = await submitGameSession(payload);
    return sessionId.current;
  };
  const answers = () => state.answers.map((a) => ({ question_id: CC.questions[a.questionIndex].id, answer: a.answer }));

  const pick = async (p: Pick) => {
    if (!contributionsEnabled || !consent) {
      setStatus({ kind: "done", msg: t.thanksNoSend });
      return;
    }
    setStatus({ kind: "sending" });
    try {
      await who.signIn();
      if (p.kind === "local") {
        await sendSession(p.book.id);
      } else {
        await sendSession();
        await submitFeatureAnswers({
          catalog_version: CC.catalog.catalog_version,
          ...(p.hit.kind === "book" ? { book_id: p.hit.id } : { submission_id: p.hit.id }),
          answers: answers(),
        });
      }
      setStatus({ kind: "done", msg: t.thanksExisting });
    } catch (err) {
      const k = errorKind(err);
      setStatus({ kind: "error", msg: k === "rate_limit" ? t.rateLimited : k === "invalid" ? t.invalidInput : t.sendFailed });
    }
  };

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (unknownTitle) {
      if (!memory.trim()) { setStatus({ kind: "error", msg: E.memoryRequired }); return; }
      const url = URL.createObjectURL(new Blob([clueNote(memory, CC, state, lang)], { type: "text/plain;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url; link.download = "bookinator-clues.txt";
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus({ kind: "idle", msg: E.clueSaved });
      return;
    }
    const cleanTitle = cleanText(title);
    const cleanAuthor = cleanText(author);
    if (!cleanTitle) {
      setStatus({ kind: "error", msg: t.needTitleAuthor });
      return;
    }
    // The reader's own words, plus the kinds they ticked, go into the submission's free-text note.
    const kindText = kinds.map((i) => L.kinds[i]).join(", ");
    const reasonText = [memory.trim(), kindText && `[${L.kind}: ${kindText}]`].filter(Boolean).join("\n").slice(0, 2000);
    setStatus({ kind: "sending" });
    try {
      await who.signIn();
      const sid = await sendSession();
      const res = await submitBook({
        title: cleanTitle,
        ...(cleanAuthor ? { author: cleanAuthor } : {}),
        ...(hangul(cleanTitle) ? { title_ko: cleanTitle } : {}),
        ...(sid ? { origin_session_id: sid } : {}),
        confirm_not_duplicate: confirmDup,
        ...(reasonText ? { reason: reasonText } : {}),
      });
      if (res.status === "created") {
        setStatus({ kind: "done", msg: t.thanksNew });
      } else if (res.status === "possible_duplicates") {
        setRemote(res.candidates.filter((h) => !(h.kind === "book" && CC.bookIndex.has(h.id))));
        setConfirmDup(true);
        setStatus({ kind: "idle", msg: t.confirmNotDuplicate });
      } else {
        if (consent) {
          await submitFeatureAnswers({
            catalog_version: CC.catalog.catalog_version,
            ...(res.status === "duplicate_book" ? { book_id: res.book_id } : { submission_id: res.submission_id }),
            answers: answers(),
          });
        }
        setStatus({ kind: "done", msg: res.status === "duplicate_book" ? t.duplicateBook : t.duplicateSubmission });
      }
    } catch (err) {
      const k = errorKind(err);
      setStatus({ kind: "error", msg: k === "rate_limit" ? t.rateLimited : k === "invalid" ? t.invalidInput : t.sendFailed });
    }
  };

  const hasSimilar = local.length > 0 || remote.length > 0;
  // Option A: look the title or author up in the books this shelf already has.
  const found = useMemo(() => {
    if (searched === null) return [];
    const byTitle = searchLocal(CC.books, searched, "", 5);
    const byAuthor = searchLocal(CC.books, "", searched, 5).filter((h) => !byTitle.some((x) => x.book.id === h.book.id));
    return [...byTitle, ...byAuthor].slice(0, 5);
  }, [searched]);
  const runSearch = () => {
    const q = cleanText(query);
    setSearched(q);
    setSearchedRemote([]);
    if (contributionsEnabled && q.length >= 2) {
      searchBooksRemote(q, 5).then(
        (hits) => setSearchedRemote(hits.filter((h) => !(h.kind === "book" && CC.bookIndex.has(h.id)))),
        () => setSearchedRemote([]),
      );
    }
  };
  const toggleKind = (i: number) => setKinds((k) => (k.includes(i) ? k.filter((x) => x !== i) : [...k, i]));

  return (
    <>
      <section className="nf-hero">
        <p className="eyebrow">{L.nfEyebrow}</p>
        <h1 ref={headingRef} tabIndex={-1}>{L.nfTitle}</h1>
        <p className="lead-sm">{reason === "all_rejected" ? t.allRejectedLine : L.nfLead}</p>
      </section>

      <section className="nf-options">
        <div className="card nf-search">
          <span className="tile-icon"><Icon name="tileSearch" size={22} /></span>
          <h2>{L.searchTitle}</h2>
          <p className="muted">{L.searchLead}</p>
          <form className="input-row" role="search" onSubmit={(e) => { e.preventDefault(); runSearch(); }}>
            <label className="sr-only" htmlFor="nf-query">{L.searchPlaceholder}</label>
            <span className="field field-pill">
              <Icon name="field" />
              <input id="nf-query" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={L.searchPlaceholder} maxLength={200} autoComplete="off" />
            </span>
            <button type="submit" className="btn btn-primary">{L.search}</button>
          </form>
          {searched !== null && (
            <div className="nf-results" aria-live="polite">
              {found.length === 0 && searchedRemote.length === 0 ? (
                <p className="hint">{L.searchNone}</p>
              ) : (
                <>
                  {found.map(({ book }) => (
                    <div key={book.id} className="dup-match">
                      <span className="lb-cover" aria-hidden="true" />
                      <span className="lb-info"><b>{bookTitles(book, lang).main}</b><span>{book.author}</span></span>
                      <Button variant="secondary" arrow={false} onClick={() => pick({ kind: "local", book })} disabled={busy || done}>{L.thisIsIt}</Button>
                    </div>
                  ))}
                  {searchedRemote.length > 0 && <p className="card-label">{L.searchOtherShelves}</p>}
                  {searchedRemote.map((h) => (
                    <div key={`${h.kind}:${h.id}`} className="dup-match">
                      <span className="lb-cover" aria-hidden="true" />
                      <span className="lb-info"><b>{(lang === "ko" && h.title_ko) || h.title}</b><span>{h.author}{h.kind === "submission" ? ` · ${t.submitted}` : ""}</span></span>
                      <Button variant="secondary" arrow={false} onClick={() => pick({ kind: "remote", hit: h })} disabled={busy || done}>{L.thisIsIt}</Button>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
          <hr />
          <p className="card-label">{L.otherWays}</p>
          <button type="button" className="link-row" onClick={onPlayAgain}><span>{L.restartQuestions}</span><Icon name="arrowRight" /></button>
          <button type="button" className="link-row" onClick={onUndo}><span>{L.backOneStep}</span><Icon name="arrowRight" /></button>
        </div>

        <form className="card nf-form" onSubmit={add} noValidate>
          <span className="tile-icon"><Icon name="tileRequest" size={22} /></span>
          <h2>{L.tellTitle}</h2>
          <p className="muted">{L.tellLead}</p>
          <label className="check"><input type="checkbox" checked={unknownTitle} onChange={(e) => { setUnknownTitle(e.target.checked); setStatus({ kind: "idle" }); }} disabled={done} /><span>{E.unknownTitle}</span></label>
          <p className="hint">{unknownTitle ? E.clueLead : E.titleHelp}</p>
          <div className="field-row" hidden={unknownTitle}>
            <div className="form-field">
              <label htmlFor="bk-title">{t.title} <span aria-hidden="true">*</span></label>
              <input id="bk-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} disabled={done} autoComplete="off" maxLength={300} required={!unknownTitle} />
            </div>
            <div className="form-field">
              <label htmlFor="bk-author">{t.author}</label>
              <input id="bk-author" type="text" value={author} onChange={(e) => setAuthor(e.target.value)} disabled={done} autoComplete="off" maxLength={200} placeholder={L.authorPlaceholder} />
            </div>
          </div>

          {hasSimilar && !done && !unknownTitle && (
            <div className="dup" aria-live="polite">
              <p className="dup-head"><Icon name="info" />{L.dupHead}</p>
              {local.map(({ book }) => (
                <div key={book.id} className="dup-match">
                  <span className="lb-cover" aria-hidden="true" />
                  <span className="lb-info"><b>{bookTitles(book, lang).main}</b><span>{book.author} · {t.inThisShelf}</span></span>
                  <Button variant="secondary" arrow={false} onClick={() => pick({ kind: "local", book })} disabled={busy}>{L.thisIsIt}</Button>
                </div>
              ))}
              {remote.map((h) => (
                <div key={`${h.kind}:${h.id}`} className="dup-match">
                  <span className="lb-cover" aria-hidden="true" />
                  <span className="lb-info"><b>{(lang === "ko" && h.title_ko) || h.title}</b><span>{h.author}{h.kind === "submission" ? ` · ${t.submitted}` : ""}</span></span>
                  <Button variant="secondary" arrow={false} onClick={() => pick({ kind: "remote", hit: h })} disabled={busy}>{L.thisIsIt}</Button>
                </div>
              ))}
            </div>
          )}

          <div className="form-field">
            <label htmlFor="bk-memory">{L.memory}{unknownTitle ? " *" : ""}</label>
            <textarea id="bk-memory" value={memory} onChange={(e) => setMemory(e.target.value)} disabled={done} required={unknownTitle} maxLength={1500} placeholder={L.memoryPlaceholder} />
          </div>

          <fieldset className="form-field kinds" disabled={done} hidden={unknownTitle}>
            <legend>{L.kind}</legend>
            {L.kinds.map((k, i) => (
              <button key={k} type="button" className="chip chip-toggle" aria-pressed={kinds.includes(i)} onClick={() => toggleKind(i)}>{k}</button>
            ))}
          </fieldset>

          {contributionsEnabled && !done && !unknownTitle && (
            <label className="check consent">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span><b>{t.sendAnswersToo}</b><small>{t.sendAnswersHelp}</small></span>
            </label>
          )}
          {!contributionsEnabled && !unknownTitle && <p className="hint">{t.contributionsOff}</p>}
          {who.needsCaptcha && !done && !unknownTitle && <Captcha onToken={who.setToken} lang={lang} />}
          {status.msg && <p className={status.kind === "error" ? "form-error" : "form-note"} role="status">{status.msg}</p>}

          <div className="submit-row">
            <p className="hint">{L.required}</p>
            {done ? (
              <Button onClick={onPlayAgain}>{t.playAgain}</Button>
            ) : (
              <button type="submit" className="btn btn-primary" disabled={!unknownTitle && (!contributionsEnabled || !who.ready || busy)}>
                <span>{unknownTitle ? E.saveClues : busy ? t.sending : confirmDup ? L.submitAnyway : L.submitRequest}</span>
                <Icon name="arrowRightWhite" />
              </button>
            )}
          </div>
        </form>
      </section>
    </>
  );
}
