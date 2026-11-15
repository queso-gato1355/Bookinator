import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ACTIVE_CATALOG, CATALOG_SOURCE } from "./data/index.ts";
import { ANSWERS, type Answer } from "./engine/model.ts";
import { applyEvent, deriveState, newSession, undo, type Session, type SessionEvent } from "./engine/session.ts";
import { CC, CONFIG, loadSession, saveSession } from "./game.ts";
import { STRINGS, useLang } from "./i18n/index.ts";
import { LIBRARY } from "./i18n/library.ts";
import { rewindToAnswer } from "./engine/reader.ts";
import { AddBookScreen } from "./components/Contribute.tsx";
import { BookScreen, HomeScreen, QuestionScreen, SimilarScreen } from "./components/screens.tsx";
import { Footer, Header, MobileHeader } from "./components/ui.tsx";

function safeDerive(session: Session) {
  try {
    return deriveState(CC, CONFIG, session);
  } catch {
    return null; // e.g. a saved session from an older catalog
  }
}

export default function App() {
  const [lang, setLang] = useLang();
  const t = STRINGS[lang];
  const L = LIBRARY[lang];
  const [catalogRequested, setCatalogRequested] = useState(0);
  const [session, setSession] = useState<Session | null>(() => {
    const saved = loadSession();
    return saved && safeDerive(saved) ? saved : null;
  });
  const state = useMemo(() => (session ? safeDerive(session) : null), [session]);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => saveSession(session), [session]);

  const dispatch = useCallback(
    (event: SessionEvent) => {
      if (!session || !state) return;
      try {
        setSession(applyEvent(CC, CONFIG, session, event, state));
      } catch {
        /* stale double-click: ignore */
      }
    },
    [session, state],
  );
  const onUndo = useCallback(() => setSession((s) => (s ? undo(s) : s)), []);
  const onRestart = useCallback(() => setSession(null), []);
  const onCatalog = useCallback(() => { setSession(null); setCatalogRequested((n) => n + 1); }, []);
  const onEditAnswer = useCallback((index: number) => setSession((s) => s ? rewindToAnswer(s, index) : s), []);
  useEffect(() => {
    if (!catalogRequested) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById("catalog")?.scrollIntoView({ block: "start" });
      document.getElementById("catalog-search")?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [catalogRequested]);
  // Each game gets its own seed, so questions come in a different order from game to game.
  const onStart = useCallback(
    (filmMemoryMode: boolean) => setSession(newSession({ filmMemoryMode, seed: Math.floor(Math.random() * 2 ** 31) })),
    [],
  );

  // Move focus to the new heading whenever the screen or question changes (screen readers + keyboard).
  const kind = state ? state.action.kind : "start";
  const screenKey = `${kind}:${session?.events.length ?? 0}`;
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [screenKey]);

  // Global keyboard shortcuts: 1–5 answers, U undo, Y/N on a guess.
  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      const a = state.action;
      if (a.kind === "ask" && /^[1-5]$/.test(e.key)) {
        const answer: Answer = ANSWERS[Number(e.key) - 1];
        dispatch({ type: "answer", questionId: a.question.id, answer });
        e.preventDefault();
      } else if (a.kind === "guess" && (e.key === "y" || e.key === "Y")) {
        dispatch({ type: "accept", bookId: a.book.id });
      } else if (a.kind === "guess" && (e.key === "n" || e.key === "N")) {
        dispatch({ type: "reject", bookId: a.book.id });
      } else if ((e.key === "u" || e.key === "U") && session && session.events.length > 0) {
        onUndo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, session, dispatch, onUndo]);

  let screen;
  if (!session || !state) {
    screen = <HomeScreen headingRef={headingRef} onStart={onStart} t={t} L={L} lang={lang} />;
  } else {
    const a = state.action;
    const common = { headingRef, state, session, t, L, lang, onUndo, onRestart, canUndo: session.events.length > 0, onEditAnswer };
    switch (a.kind) {
      case "ask":
        // Keyed by the question so the picked answer never carries over.
        screen = <QuestionScreen key={a.question.id} {...common} action={a} onBestGuess={() => dispatch({ type: "suggest" })} onAnswer={(answer) => dispatch({ type: "answer", questionId: a.question.id, answer })} />;
        break;
      case "guess":
        screen = (
          <BookScreen
            key={a.book.id}
            {...common}
            action={a}
            onAccept={() => dispatch({ type: "accept", bookId: a.book.id })}
            onReject={() => dispatch({ type: "reject", bookId: a.book.id })}
            onExit={() => dispatch({ type: "exit" })}
          />
        );
        break;
      case "shortlist":
        screen = <SimilarScreen {...common} action={a} onPick={(bookId) => dispatch({ type: "accept", bookId })} onExit={() => dispatch({ type: "exit" })} />;
        break;
      case "found":
        screen = <BookScreen key={a.book.id} {...common} action={a} />;
        break;
      case "no_match":
        // Keyed by the event count so the form starts empty after Undo + a new miss.
        screen = <AddBookScreen key={session.events.length} {...common} onPlayAgain={onRestart} />;
        break;
    }
  }

  const notice =
    ACTIVE_CATALOG.data_status === "production" ? null : ACTIVE_CATALOG.data_status === "machine_labelled_unreviewed" ? t.unreviewedData : t.devData;
  const header = { L, lang, setLang, onHome: onRestart, onStart: () => onStart(false), onCatalog };

  return (
    <div className={`app screen-${kind}`}>
      <a className="skip-link" href="#main-content">{lang === "ko" ? "본문으로 이동" : "Skip to content"}</a>
      <Header {...header} />
      <MobileHeader {...header} />
      <main id="main-content">{screen}</main>
      <Footer L={L} onHome={onRestart} onCatalog={onCatalog}>
        {notice && (
          <p>
            <b>{notice}.</b> <span lang="en">{ACTIVE_CATALOG.notice}</span>
          </p>
        )}
        <p>
          {t.footer(
            ACTIVE_CATALOG.coverage?.titles_reachable ?? ACTIVE_CATALOG.books.length,
            ACTIVE_CATALOG.coverage?.imported_source_records ?? null,
            ACTIVE_CATALOG.catalog_version,
            CATALOG_SOURCE === "remote" ? t.sourceRemote : t.sourceBundled,
          )}
        </p>
        {ACTIVE_CATALOG.credits && <p lang="en">{ACTIVE_CATALOG.credits}</p>}
      </Footer>
    </div>
  );
}
