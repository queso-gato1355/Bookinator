// Screens of the "Sea Library" design: 01 Home, 02 Question, 03 Book Found (also used to propose a
// guess), 04 Similar Books. 05 Not Found lives in Contribute.tsx. The engine decides everything; these
// components only show its state.
import { useEffect, useState, type RefObject } from "react";
import { fetchBlurb, fetchCover, titleCount, volumeBook, displayLanguage } from "../bookInfo.ts";
import { ACTIVE_COLLECTION, COLLECTIONS, collectionHref, type CollectionId } from "../data/index.ts";
import { matchingClues, type MatchingClue } from "../engine/explain.ts";
import { catalogLinks } from "../engine/links.ts";
import { ANSWERS, type Answer, type CatalogBook } from "../engine/model.ts";
import { streakWarning, type Action, type Session, type SessionState } from "../engine/session.ts";
import { CC, CONFIG, LINK_OPTIONS } from "../game.ts";
import { ANSWER_TEXT, bookTitles, questionText, type Lang, type Strings } from "../i18n/index.ts";
<<<<<<< HEAD
import { LIBRARY, type LibraryStrings } from "../i18n/library.ts";
import { FAMOUS_BOOKS } from "../data/library.ts";
import { href, navigate } from "../router.ts";
import { FamousBooks } from "./pages.tsx";
import { DESIGN_MOCK, type LeaderboardEntry } from "../mock/design.ts";
import { Availability } from "./Availability.tsx";
=======
import { type LibraryStrings } from "../i18n/library.ts";
import { EXPERIENCE } from "../i18n/experience.ts";
import { searchLocal } from "../community/search.ts";
import { conflictingAnswers, leadingMatchCount } from "../engine/reader.ts";
import { LibraryHome } from "./LibraryHome.tsx";
import { CatalogGallery } from "./CatalogGallery.tsx";
import { LibraryNextStep } from "./LibraryNextStep.tsx";
import { HACKATHON } from "../i18n/hackathon.ts";
import { SEA_WINDOW_PHOTO } from "../assets/seaPhoto.ts";
import { DEMO_BOOK_IDS, demoHref, isDemoMode } from "../demo.ts";
>>>>>>> 8096e18c100e2f084ed0de38a7f3e47c2fbadffc
import { ShareAnswers } from "./Contribute.tsx";
import { AnswerButton, Breadcrumb, Button, Icon, UnsplashImage, useLoaded, useLoadedState } from "./ui.tsx";

type Heading = RefObject<HTMLHeadingElement | null>;
type ActionOf<K extends Action["kind"]> = Extract<Action, { kind: K }>;

export interface Common {
  headingRef: Heading;
  state: SessionState;
  session: Session;
  t: Strings;
  L: LibraryStrings;
  lang: Lang;
  onUndo: () => void;
  onRestart: () => void;
  canUndo: boolean;
  onEditAnswer: (index: number) => void;
}

const authorLine = (b: CatalogBook) => `${b.author}${b.first_publication_year ? ` · ${b.first_publication_year}` : ""}`;

function SectionHead({ eyebrow, title, lead, children }: { eyebrow: string; title: string; lead?: string; children?: React.ReactNode }) {
  return (
    <div className="section-head">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {lead && <p className="lead-sm">{lead}</p>}
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- 01 · Home

<<<<<<< HEAD
function CollectionCard({ item, query, L }: { item: (typeof DESIGN_MOCK)["ko"]["collection"][number]; query: string; L: LibraryStrings }) {
  const photo = useLoaded(() => fetchPhoto(query), query);
  return (
    <BookCard title={item.title} author={item.author} description={item.description} badge={L.colBadge} genre={item.genre}
      photo={photo} imageCaption={item.imageCaption} actionLabel={L.colMore} saveLabel={L.saveShelf} soonLabel={L.comingSoon}
      onAction={() => navigate(href("catalog", { params: { q: item.title } }))} />
  );
}

const TILE_ICONS: IconName[] = ["tileStart", "tileSearch", "tileRequest", "tileCard", "tileGuide"];

export function LeaderboardSection({ L, lang }: { L: LibraryStrings; lang: Lang }) {
  const version = CC.catalog.catalog_version;
  const live = useLoaded<PopularBook[]>(() => fetchPopular(version, 8), version);
  const liveEntries: LeaderboardEntry[] = (live ?? []).flatMap((r, i) => {
    const idx = CC.bookIndex.get(r.book_id);
    if (idx === undefined || !(r.found_count > 0)) return [];
    const book = CC.books[idx];
    return [{ rank: i + 1, title: bookTitles(book, lang).main, author: authorLine(book), count: r.found_count, trend: null }];
  });
  const isLive = liveEntries.length > 0;
  const entries = isLive ? liveEntries : DESIGN_MOCK[lang].leaderboard;
  const [top, ...rest] = entries;
  const topBook = isLive ? CC.books[CC.bookIndex.get(live![0].book_id)!] : null;
  const sampleQuery = DESIGN_MOCK.en.leaderboard[0].imageCaption ?? "";
  const photo = useLoaded(() => (topBook ? fetchImage(topBook) : fetchPhoto(sampleQuery)), topBook?.id ?? "sample");
  return (
    <section className="section section-linen" id="leaderboard">
      <SectionHead eyebrow={L.lbEyebrow} title={L.lbTitle} lead={isLive ? L.lbLeadLive : L.lbLead}>
        {!isLive && (
          <div className="tabs" aria-hidden="true">
            {L.lbTabs.map((x, i) => <span key={x} className={i === 0 ? "tab tab-on" : "tab"}>{x}</span>)}
          </div>
        )}
      </SectionHead>
      <div className="lb-body">
        <article className="lb-top">
          <UnsplashImage photo={photo} caption={top.imageCaption} className="lb-top-photo" />
          <div className="lb-top-body">
            <div className="lb-top-row">
              <span className="lb-top-rank">{top.rank}</span>
              <div>
                <span className="badge">{isLive ? L.lbTopLive : L.lbTop}</span>
                <h3>{top.title}</h3>
                <p className="muted">{top.author}</p>
              </div>
            </div>
            {top.description && <p className="lb-top-desc">{top.description}</p>}
            <dl className="stats">
              <div><dt>{L.lbFound}</dt><dd>{L.lbCount(top.count)}</dd></div>
              {top.avgQuestions !== undefined && <div><dt>{L.lbAvg}</dt><dd>{L.lbQuestions(top.avgQuestions)}</dd></div>}
              {top.trend !== null && <div><dt>{L.lbTrend}</dt><dd><Trend value={top.trend} /></dd></div>}
            </dl>
          </div>
        </article>
        <ol className="lb-list" start={2}>
          {rest.map((e) => <LeaderboardRow key={e.rank} rank={e.rank} title={e.title} author={e.author} count={L.lbCount(e.count)} trend={e.trend} />)}
        </ol>
      </div>
      <div className="section-foot">
        <Button variant="secondary" href={href("leaderboard")} >{L.lbAll}</Button>
        {!isLive && <p className="footnote">{L.lbSample}</p>}
      </div>
    </section>
  );
}

/** Most-borrowed literature from Data4Library; hidden until that API answers. */
export function LibraryLoans({ t }: { t: Strings }) {
  const rows = useLoaded<LibraryLoan[]>(() => fetchLibraryPopular(7), "library-popular");
  if (!rows || rows.length === 0) return null;
  return (
    <section className="section">
      <div className="section-head"><div><h2>{t.libraryPopularHeading}</h2></div></div>
      <ol className="lb-list lb-list-wide" lang="ko">
        {rows.map((b, i) => <LeaderboardRow key={`${i}:${b.title}`} rank={i + 1} title={b.title} author={b.author} count="" />)}
      </ol>
      <p className="footnote">{t.libraryPopularSource}</p>
    </section>
  );
}

export function HomeScreen({ headingRef, onStart, t, L, lang }: { headingRef: Heading; onStart: (film: boolean) => void; t: Strings; L: LibraryStrings; lang: Lang }) {
=======
export function HomeScreen(props: { headingRef: Heading; onStart: (film: boolean) => void; t: Strings; L: LibraryStrings; lang: Lang; libraryOnly?: boolean }) {
  return isDemoMode() && !props.libraryOnly ? <ChallengeHomeScreen {...props} /> : <LibraryHome {...props} />;
}

export function CatalogScreen(props: { headingRef: Heading; t: Strings; L: LibraryStrings; lang: Lang }) {
  return <><Breadcrumb items={[props.L.home, props.L.nav[1]]} /><section className="intro"><h1 ref={props.headingRef} tabIndex={-1}>{props.L.nav[1]}</h1></section><CatalogGallery t={props.t} L={props.L} lang={props.lang} /></>;
}

function ChallengeHomeScreen({ headingRef, onStart, t, L, lang }: { headingRef: Heading; onStart: (film: boolean) => void; t: Strings; L: LibraryStrings; lang: Lang }) {
>>>>>>> 8096e18c100e2f084ed0de38a7f3e47c2fbadffc
  const [film, setFilm] = useState(false);
  const H = HACKATHON[lang];
  const demo = isDemoMode();
  const [query, setQuery] = useState("");
  const E = EXPERIENCE[lang];
  const books = [...CC.books].sort((a, b) => bookTitles(a, lang).main.localeCompare(bookTitles(b, lang).main, lang));
  const shelfName: Record<CollectionId, string> = { classic: t.classicShelf, research: t.researchShelf };
<<<<<<< HEAD
  const start = () => onStart(film);
  // Photos are searched with the English phrase in both languages (Unsplash search works best in English).
  const heroPhoto = useLoaded(() => fetchPhoto(LIBRARY.en.heroImage), "hero");
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow eyebrow-icon"><Icon name="eyebrow" size={20} />{L.heroEyebrow}</p>
          <h1 ref={headingRef} tabIndex={-1}>{L.heroTitle[0]}<br />{L.heroTitle[1]}</h1>
          <p className="lead">{L.heroLead}</p>
          <div className="hero-actions">
            <Button className="btn-hero" onClick={start}>{L.startQuestions}</Button>
          </div>
        </div>
        <UnsplashImage photo={heroPhoto} caption={L.heroImage} className="hero-photo" />
      </section>

      <section className="tiles">
        {L.tiles.map(([title, sub], i) => {
          const body = (
            <>
              <span className="tile-icon"><Icon name={TILE_ICONS[i]} size={22} /></span>
              <span className="tile-text"><b>{title}</b><span>{sub}</span></span>
            </>
          );
          // 0 start · 1 catalog · 2 "tell us a book" (it happens after a miss, so it starts a game) · 3 card · 4 visit
          const to = [null, href("catalog"), null, href("guide"), href("guide")][i];
          return to ? (
            <a key={title} className="tile" href={to}>{body}</a>
          ) : (
            <button key={title} type="button" className="tile" onClick={start}>{body}</button>
          );
        })}
      </section>

      <LeaderboardSection L={L} lang={lang} />
      <LibraryLoans t={t} />

      <section className="section">
        <SectionHead eyebrow={L.howEyebrow} title={L.howTitle} />
        <ol className="steps">
          {L.steps.map(([title, body], i) => (
            <li key={title}>
              <span className="step-no">{String(i + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="section section-tight">
        <SectionHead eyebrow={L.colEyebrow} title={L.colTitle}>
          <Button variant="ghost" href={href("catalog", { params: { tag: "sea" } })} >{L.colAll}</Button>
        </SectionHead>
        <div className="card-grid">
          {mock.collection.map((c, i) => (
            <CollectionCard key={c.title} item={c} query={DESIGN_MOCK.en.collection[i].imageCaption} L={L} />
          ))}
        </div>
        <div className="shelf-options">
          <h3>{L.shelfTitle}</h3>
=======
  const searchable = books.map((book) => ({ ...book, aliases: [...book.aliases, ...(book.volumes?.map((v) => v.title) ?? [])] }));
  const matches = query.trim() ? new Set([
    ...searchLocal(searchable, query, "", books.length),
    ...searchLocal(searchable, "", query, books.length),
  ].map((h) => h.book.id)) : null;
  const shown = matches ? books.filter((b) => matches.has(b.id)) : books;
  return <>
    <section className="hero focused-hero">
      <div className="hero-copy">
        <p className="theme-label"><Icon name="eyebrow" size={18} />{H.theme}</p>
        <h1 ref={headingRef} tabIndex={-1}>{L.heroTitle[0]}<br />{L.heroTitle[1]}</h1>
        <p className="lead">{H.pitch}</p>
        <ul className="effort-benefits">{H.benefits.map((benefit) => <li key={benefit}><Icon name="checkClue" size={16} />{benefit}</li>)}</ul>
        <div className="shelf-setup">
          <h2>{L.shelfTitle}</h2>
>>>>>>> 8096e18c100e2f084ed0de38a7f3e47c2fbadffc
          <nav className="shelf-switch" aria-label={t.collectionsLabel}>
            {(Object.keys(COLLECTIONS) as CollectionId[]).map((id) => <a key={id} href={collectionHref(id)} className="chip" aria-current={id === ACTIVE_COLLECTION ? "page" : undefined}>{shelfName[id]} · {t.booksCount(titleCount(id === ACTIVE_COLLECTION ? CC.catalog : COLLECTIONS[id].catalog))}</a>)}
          </nav>
          <p className="hint">{E.shelfNote(titleCount(CC.catalog))} {E.scope}</p>
          <label className="check"><input type="checkbox" checked={film} onChange={(e) => setFilm(e.target.checked)} /><span>{t.filmMode}</span></label>
        </div>
<<<<<<< HEAD
        <details className="shelf-list">
          <summary>{t.seeShelf(titleCount(CC.catalog))}</summary>
          <ul>
            {books.map((b) => (
              <li key={b.id}><b>{bookTitles(b, lang).main}</b> <span>{b.author}{b.volumes ? ` · ${t.booksCount(b.volumes.length)}` : ""}</span></li>
            ))}
          </ul>
        </details>
      </section>

      <section className="section section-linen">
        <SectionHead eyebrow={L.progEyebrow} title={L.progTitle}>
          <Button variant="ghost" href={href("programs")} >{L.progAll}</Button>
        </SectionHead>
        <div className="card-grid">
          {mock.programs.map((p) => (
            <article key={p.title} className="program">
              <p className="program-meta">
                <span className="program-date"><Icon name="calendar" />{p.date}</span>
                <span className="audience">{p.audience}</span>
              </p>
              <h3>{p.title}</h3>
              <p>{p.description}</p>
              <Button variant="ghost" disabled title={L.comingSoon}>{L.progApply}</Button>
            </article>
          ))}
        </div>
      </section>

      <FamousBooks books={FAMOUS_BOOKS} L={L} lang={lang} />
    </>
  );
=======
        <div className="hero-actions"><Button className="btn-hero" onClick={() => onStart(film)}>{E.find}</Button><a className="text-btn" href="#catalog">{E.catalog}</a>{!demo && <a className="challenge-link" href={demoHref()}>{H.challengeLink} <Icon name="arrowRightSm" size={16} /></a>}</div>
      </div>
      <UnsplashImage photo={{ ...SEA_WINDOW_PHOTO, alt: lang === "ko" ? "창문 너머로 보이는 푸른 바다와 하늘" : SEA_WINDOW_PHOTO.alt }} priority className="hero-photo" />
    </section>
    {demo && <section className="section live-challenge" id="live-challenge" tabIndex={-1} aria-label={H.challengeTitle}>
      <SectionHead eyebrow={H.challengeEyebrow} title={H.challengeTitle} lead={H.challengeLead} />
      <ul className="challenge-books">{DEMO_BOOK_IDS.map((id) => CC.books.find((book) => book.id === id)).filter((book): book is CatalogBook => Boolean(book)).map((book) => <li key={book.id}><Icon name="tileStart" size={28} /><b>{bookTitles(book, lang).main}</b><span>{book.author}</span></li>)}</ul>
      <div className="challenge-actions"><Button onClick={() => onStart(false)}>{H.challengeStart}</Button><p className="hint">{H.challengeNote}</p></div>
    </section>}
    <section className="section section-linen" id="how-it-works">
      <SectionHead eyebrow={L.howEyebrow} title={L.howTitle} />
      <ol className="steps">{L.steps.map(([title, body], i) => <li key={title}><span className="step-no">{String(i + 1).padStart(2, "0")}</span><h3>{title}</h3><p>{body}</p></li>)}</ol>
    </section>
    <section className="section" id="catalog">
      <SectionHead eyebrow={L.colEyebrow} title={`${shelfName[ACTIVE_COLLECTION]} · ${t.booksCount(titleCount(CC.catalog))}`} lead={E.catalogLead} />
      <label className="field field-pill catalog-search"><Icon name="search" /><span className="sr-only">{E.catalogPlaceholder}</span><input id="catalog-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={E.catalogPlaceholder} maxLength={200} /></label>
      <p className="hint" role="status">{matches ? `${shown.length} / ${books.length}` : E.scope}</p>
      {shown.length === 0 ? <p>{E.empty}</p> : <ul className="catalog-list">{shown.map((book) => <li key={book.id}>
        <Icon name="tileStart" size={22} /><div><b>{bookTitles(book, lang).main}</b><p className="hint">{authorLine(book)}</p>
        {book.volumes && <details><summary>{L.seriesVolumes} · {book.volumes.length}</summary><ol>{book.volumes.map((v) => <li key={v.id}>{v.title}</li>)}</ol></details>}</div>
        <a href={catalogLinks(book, LINK_OPTIONS)[0].url} target="_blank" rel="noopener noreferrer" className="catalog-record"><span className="sr-only">{bookTitles(book, lang).main}: </span>{E.openRecord} ↗</a>
      </li>)}</ul>}
    </section>
  </>;
>>>>>>> 8096e18c100e2f084ed0de38a7f3e47c2fbadffc
}

// ---------------------------------------------------------------- 02 · Question

function AnswerHistory({ state, t, lang, onEditAnswer }: Pick<Common, "state" | "t" | "L" | "lang" | "onEditAnswer">) {
  if (state.answers.length === 0 && state.rejected.size === 0) return null;
  const E = EXPERIENCE[lang];
  return <details className="card history"><summary>{E.history} · {state.answers.length}</summary>
    <p className="hint history-note">{E.edited}</p>
    <ol>{state.answers.map((a, i) => <li key={i}><span>{questionText(CC.questions[a.questionIndex], lang)}</span>
      <button type="button" className="answer-chip" onClick={() => onEditAnswer(i)} aria-label={`${E.edit}: ${questionText(CC.questions[a.questionIndex], lang)} · ${ANSWER_TEXT[lang][a.answer]}`}>{ANSWER_TEXT[lang][a.answer]} · {E.edit}</button></li>)}</ol>
    {state.rejected.size > 0 && <><p className="card-label">{t.notThese}</p><ul>{[...state.rejected].map((b) => <li key={b}><span>{bookTitles(CC.books[b], lang).main}</span></li>)}</ul></>}
  </details>;
}

export function QuestionScreen(props: Common & { action: ActionOf<"ask">; onAnswer: (a: Answer) => void; onBestGuess: () => void }) {
  const { action, headingRef, onAnswer, state, t, L, lang } = props;
  const E = EXPERIENCE[lang];
  const H = HACKATHON[lang];
  const streak = streakWarning(CONFIG, state.answers);
  const [streakDismissed, setStreakDismissed] = useState(false);
  const n = action.number;
  const leading = leadingMatchCount(state);
  const total = CC.books.length;
  const narrowing = state.informativeAnswers > 0 ? E.spread(leading, total) : E.noEvidence;
  return <>
    <Breadcrumb items={[L.home, L.crumbGame]}><button type="button" className="text-btn" onClick={props.onRestart}><Icon name="restart" size={16} />{t.startOver}</button></Breadcrumb>
    <div className="question-layout">
      <aside className="sidebar">
        <div className="card progress">
          <p className="card-label">{L.progress}</p><p className="progress-count"><b>{E.answered(state.answers.length)}</b></p>
          <p className="progress-note">{narrowing}</p><p className="hint">{E.spreadHelp}</p>
          <p className="hint">{E.cap(CONFIG.maxQuestions)}</p>
        </div>
        <AnswerHistory {...props} />
      </aside>
      <div className="question-col">
        <div className="card question-card">
          <div className="question-body">
            <div className="companion"><span className="tile-icon"><Icon name="tileStart" size={24} /></span><p>{state.answers.length === 0 ? E.beginning : state.answers.at(-1)?.answer === "dont_know" ? E.unsure : E.thinking}</p></div>
            <p className="eyebrow">{L.questionN(n)}<span className="mobile-only"> · {E.answered(state.answers.length)}</span></p>
            <h1 ref={headingRef} tabIndex={-1}>{questionText(action.question, lang)}</h1>
            <p className="lead-sm">{H.tapHint}</p>
            <p className="hint mobile-search-feedback" role="status">{narrowing}</p>
            <details className="definition"><summary>{t.whatCounts}</summary><p lang="en">{action.question.definition}</p></details>
            {streak && !streakDismissed && <div className="streak-alert" role="status"><p>{L.streakDontKnow}</p><button type="button" className="text-btn" onClick={() => setStreakDismissed(true)}>{L.streakContinue}</button></div>}
            <div className="answers" role="group" aria-label={t.answersGroup}>{ANSWERS.map((a, i) => <AnswerButton key={a} label={ANSWER_TEXT[lang][a]} shortcut={String(i + 1)} onSelect={() => onAnswer(a)} />)}</div>
            <div className="question-nav"><button type="button" className="text-btn" onClick={props.onUndo} disabled={!props.canUndo} aria-keyshortcuts="U"><Icon name="arrowLeft" />{t.undo}</button><p className="hint keyboard-hint">{H.keyboard}</p></div>
          </div>
        </div>
        {state.informativeAnswers > 0 && <div className="early-guess"><Button variant="secondary" onClick={props.onBestGuess}>{E.showGuess}</Button><p className="hint">{E.guessNote}</p></div>}
      </div>
    </div>
  </>;
}

// ---------------------------------------------------------------- 03 · Result — Book Found

function ClueProvenance({ bookIndex, feature, t, L }: { bookIndex: number; feature: MatchingClue["feature"]; t: Strings; L: LibraryStrings }) {
  if (feature?.status === "supported" && feature.source_ids.length) {
    const src = CC.books[bookIndex].sources.find((x) => x.id === feature.source_ids[0]);
    if (src) {
      let host = src.url;
      try {
        host = new URL(src.url).hostname.replace(/^www\./, "");
      } catch {
        /* keep the raw text */
      }
      return (
        <small>
          {t.source}: <a href={src.url} target="_blank" rel="noopener noreferrer">{host}</a>
          {feature.reviewed ? "" : ` (${t.aiChecked})`}
        </small>
      );
    }
  }
  if (feature?.status === "community_consensus" && feature.consensus) return <small>{t.fromReaders(feature.consensus.contributors)}</small>;
  if (feature?.status === "ai_recall") return <small>{L.aiRecall}</small>;
  return <small>{t.unchecked}</small>;
}

function Clues({ bookIndex, state, t, L, lang }: { bookIndex: number; state: SessionState; t: Strings; L: LibraryStrings; lang: Lang }) {
  const clues = matchingClues(CC, bookIndex, state.answers, 3);
  return (
    <div className="clues">
      <p className="eyebrow">{L.cluesEyebrow}</p>
      <h2>{L.cluesTitle}</h2>
      {clues.length === 0 && <p className="hint">{EXPERIENCE[lang].noClues}</p>}
      <ul>
        {clues.map((c) => (
          <li key={c.questionId}>
            <Icon name="checkClue" />
            <span className="clue-q">
              {questionText(CC.questions[CC.questionIndex.get(c.questionId)!], lang)}
              <ClueProvenance bookIndex={bookIndex} feature={c.feature} t={t} L={L} />
            </span>
            <b>{ANSWER_TEXT[lang][c.userAnswer]}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RecognitionCover({ book, lang }: { book: CatalogBook; lang: Lang }) {
  const cover = useLoaded(() => fetchCover(book), book.id);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const E = EXPERIENCE[lang];
  return <figure className="recognition-cover">
    {cover && !failed && <img className="real-cover" hidden={!loaded} src={cover.url} alt={`${bookTitles(book, lang).main} — ${book.author}`} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />}
    {(!loaded || failed || !cover) && <div className="cover" aria-hidden="true"><p className="cover-author">{book.author}</p><div><p className="cover-title">{bookTitles(book, lang).main}</p></div></div>}
    <figcaption className="hint">{cover && loaded && !failed ? E.coverCredit : E.coverFallback}</figcaption>
  </figure>;
}

type BookScreenProps = Common &
  ({ action: ActionOf<"guess">; onAccept: () => void; onReject: () => void; onExit: () => void } | { action: ActionOf<"found"> });

export function BookScreen(props: BookScreenProps) {
  const { action, headingRef, state, session, t, L, lang } = props;
  // Series target: the engine finds the series; after the reader confirms it, they pick the volume.
  const [volume, setVolume] = useState<CatalogBook | null>(null);
  const series = action.book.volumes ? action.book : null;
  const book = volume ?? action.book;
  const tentative = action.kind === "guess" && action.tentative === true;
  const guess = action.kind === "guess" ? (props as Extract<BookScreenProps, { onAccept: () => void }>) : null;
  const { main, alt } = bookTitles(book, lang);
  const { value: blurb, loading: blurbLoading } = useLoadedState(() => fetchBlurb(book, lang), `${book.id}:${lang}`);
  const E = EXPERIENCE[lang];
  const H = HACKATHON[lang];
  const conflicts = conflictingAnswers(CC, action.bookIndex, state);
  useEffect(() => {
    if (volume) { headingRef.current?.focus({ preventScroll: true }); window.scrollTo({ top: 0 }); }
  }, [volume, headingRef]);
  if (series && !guess && !volume) {
    return (
      <>
        <section className="intro">
          <p className="eyebrow">{series.title_en}</p>
          <h1 ref={headingRef} tabIndex={-1}>{L.seriesFoundTitle}</h1>
          <p className="lead-sm">{L.seriesFoundLead(series.volumes!.length)}</p>
        </section>
        <section className="card-grid similar-grid">
          {series.volumes!.map((v) => {
            const vb = volumeBook(series, v);
            return <SimilarCard key={v.id} book={vb} lang={lang} L={L} onPick={() => setVolume(vb)} />;
          })}
        </section>
        <section className="still">
          <div><h2>{L.stillTitle}</h2></div>
          <div className="still-actions">
            <Button variant="secondary" arrow={false} onClick={props.onUndo}>{t.undo}</Button>
            <Button onClick={props.onRestart}>{t.anotherBook}</Button>
          </div>
        </section>
      </>
    );
  }
  return (
    <>
      <section className={`banner ${guess ? "reveal-banner" : "confirmed-banner"}`}>
        <div className="banner-msg">
          <span className="banner-check"><Icon name={guess ? "tileStart" : "checkWhiteLg"} size={24} /></span>
          <div>
            <h1 ref={headingRef} tabIndex={-1}>
              {guess ? (tentative ? L.maybeBanner : series ? L.seriesBanner : H.reveal) : L.confirmedBanner}
              <span className="sr-only"> {main}</span>
            </h1>
            <p>{guess ? (tentative ? L.maybeSub(state.answers.length) : L.foundSub(state.answers.length, titleCount(CC.catalog))) : t.foundAfter(state.answers.length, action.kind === "found" && action.via === "guess")}</p>
          </div>
        </div>
        <div className="banner-actions">
          {guess ? (
            <>
              <Button variant="on-dark-primary" arrow={false} checkMark onClick={guess.onAccept} aria-keyshortcuts="Y">{L.yes}</Button>
              <Button variant="on-dark-secondary" arrow={false} onClick={guess.onReject} aria-keyshortcuts="N">{L.keepAsking}</Button>
            </>
          ) : (
            <>
              <Button variant="on-dark-primary" arrow={false} onClick={props.onRestart}>{t.anotherBook}</Button>
              <Button variant="on-dark-secondary" arrow={false} onClick={props.onUndo}>{t.undo}</Button>
            </>
          )}
        </div>
      </section>

      {!guess && <section className="found-celebration" aria-label={L.confirmedBanner}>
        <Icon name="checkClue" size={28} /><div><p className="celebration-count">{action.kind === "found" && action.via === "shortlist" ? H.identifiedIn(state.answers.length) : H.foundIn(state.answers.length)}</p><p>{H.success}</p></div>
      </section>}
      <section className={`detail book-reveal ${guess ? "guess-reveal" : "found-reveal"}`}>
        <div className="cover-col">
          <RecognitionCover key={book.id} book={book} lang={lang} />
        </div>
        <div className="info-col">
          <div className="title-block">
            <p className="book-title">{main}</p>
            <p className="muted">{[alt, book.author, book.first_publication_year].filter(Boolean).join("  ·  ")}</p>
          </div>
          {series && !volume && (
            <div className="synopsis">
              <h2>{L.seriesVolumes}</h2>
              <ol className="volumes">
                {series.volumes!.map((v) => <li key={v.id}>{v.title}</li>)}
              </ol>
            </div>
          )}
          <div className="synopsis" hidden={Boolean(series && !volume)}>
            <h2>{L.synopsis}</h2>
            {blurb ? (
              <>
                <p lang={blurb.lang}>{blurb.text}</p>
                <p className="footnote">— <a href={blurb.sourceUrl} target="_blank" rel="noopener noreferrer">{blurb.sourceLabel}</a></p>
              </>
            ) : (
              <p className="muted" role="status">{blurbLoading ? E.loadingSummary : E.descriptionPending}</p>
            )}
          </div>
          <Clues bookIndex={action.bookIndex} state={state} t={t} L={L} lang={lang} />
          {conflicts.length > 0 && <details className="conflicts"><summary>{E.conflicts} · {conflicts.length}</summary><p className="hint">{E.conflictsHelp}</p><ul>{conflicts.map((a) => <li key={a.questionIndex}>{questionText(CC.questions[a.questionIndex], lang)} — {ANSWER_TEXT[lang][a.answer]}</li>)}</ul></details>}
          <LibraryNextStep key={book.id} book={book} lang={lang} />
          <dl className="info-table">
            <div><dt>{L.infoOriginal}</dt><dd>{book.title_en}</dd></div>
            {book.first_publication_year && <div><dt>{L.infoPublished}</dt><dd>{L.infoYear(book.first_publication_year)}</dd></div>}
            <div><dt>{L.infoAuthor}</dt><dd>{book.author}</dd></div>
            <div><dt>{L.infoLanguage}</dt><dd>{displayLanguage(book.original_language, lang)}</dd></div>
          </dl>
        </div>
      </section>

      <section className="found-foot">
        {guess ? (
          <div className="card not-this">
            <h2>{L.notThisTitle}</h2>
            <p>{L.notThisLead}</p>
            <Button variant="secondary" block onClick={guess.onReject}>{L.askMore}</Button>
            <Button variant="ghost" onClick={guess.onExit}>{t.notInCollection}</Button>
          </div>
        ) : (
          <ShareAnswers session={session} state={state} t={t} lang={lang} />
        )}
      </section>
    </>
  );
}

// ---------------------------------------------------------------- 04 · Result — Similar Books

function SimilarCard({ book, lang, L, onPick }: { book: CatalogBook; lang: Lang; L: LibraryStrings; onPick: () => void }) {
  const blurb = useLoaded(() => fetchBlurb(book, lang), `${book.id}:${lang}`);
  return <article className="book-card recognition-card">
    <RecognitionCover key={book.id} book={book} lang={lang} />
    <div className="book-card-body"><h3 className="book-card-title">{bookTitles(book, lang).main}</h3><p className="book-card-author">{authorLine(book)}</p>
      {blurb && <p className="book-card-desc" lang={blurb.lang}>{blurb.text}</p>}
      <Button onClick={onPick}>{L.thisIsIt}</Button>
    </div>
  </article>;
}

export function SimilarScreen(props: Common & { action: ActionOf<"shortlist">; onPick: (id: string) => void; onExit: () => void }) {
  const { action, headingRef, onPick, onExit, t, L, lang } = props;
  return (
    <>
      <Breadcrumb items={[L.home, L.crumbGame, L.crumbSimilar]} />
      <section className="intro">
        <p className="eyebrow">{L.simEyebrow}</p>
        <h1 ref={headingRef} tabIndex={-1}>{L.simTitle[0]}<br />{L.simTitle[1]}</h1>
        <p className="lead-sm">{L.simLead(action.books.length)} {t.shortlistReason[action.reason]}</p>
      </section>
      <section className="card-grid similar-grid">
        {action.books.map((b) => <SimilarCard key={b.id} book={b} lang={lang} L={L} onPick={() => onPick(b.id)} />)}
      </section>
      <section className="still">
        <div>
          <h2>{L.stillTitle}</h2>
          <p>{L.stillLead}</p>
        </div>
        <div className="still-actions">
          <Button variant="secondary" arrow={false} onClick={props.onUndo}>{t.undo}</Button>
          <Button onClick={onExit}>{L.tellUs}</Button>
        </div>
      </section>
    </>
  );
}
