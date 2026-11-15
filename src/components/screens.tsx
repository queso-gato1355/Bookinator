// Screens of the "Sea Library" design: 01 Home, 02 Question, 03 Book Found (also used to propose a
// guess), 04 Similar Books. 05 Not Found lives in Contribute.tsx. The engine decides everything; these
// components only show its state.
import { useState, type RefObject } from "react";
import { fetchBlurb, fetchImage, fetchLibraryPopular, fetchPhoto, fetchPopular, titleCount, volumeBook, type LibraryLoan, type PopularBook } from "../bookInfo.ts";
import { ACTIVE_COLLECTION, COLLECTIONS, collectionHref, type CollectionId } from "../data/index.ts";
import { matchingClues, type MatchingClue } from "../engine/explain.ts";
import { catalogLinks } from "../engine/links.ts";
import { ANSWERS, type Answer, type CatalogBook } from "../engine/model.ts";
import { streakWarning, type Action, type Session, type SessionState } from "../engine/session.ts";
import { CC, CONFIG, LINK_OPTIONS } from "../game.ts";
import { ANSWER_TEXT, bookTitles, questionText, type Lang, type Strings } from "../i18n/index.ts";
import { LIBRARY, type LibraryStrings } from "../i18n/library.ts";
import { FAMOUS_BOOKS } from "../data/library.ts";
import { href, navigate } from "../router.ts";
import { FamousBooks } from "./pages.tsx";
import { DESIGN_MOCK, type LeaderboardEntry } from "../mock/design.ts";
import { Availability } from "./Availability.tsx";
import { ShareAnswers } from "./Contribute.tsx";
import { AnswerButton, BookCard, Breadcrumb, Button, Icon, LeaderboardRow, Trend, UnsplashImage, useLoaded, type IconName } from "./ui.tsx";

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
  const [film, setFilm] = useState(false);
  const mock = DESIGN_MOCK[lang];
  const books = [...CC.books].sort((a, b) => bookTitles(a, lang).main.localeCompare(bookTitles(b, lang).main, lang));
  const shelfName: Record<CollectionId, string> = { classic: t.classicShelf, research: t.researchShelf };
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
          <nav className="shelf-switch" aria-label={t.collectionsLabel}>
            {(Object.keys(COLLECTIONS) as CollectionId[]).map((id) => (
              <a key={id} href={collectionHref(id)} className="chip" aria-current={id === ACTIVE_COLLECTION ? "page" : undefined}>
                {shelfName[id]} · {t.booksCount(titleCount(COLLECTIONS[id].catalog))}
              </a>
            ))}
          </nav>
          <label className="check">
            <input type="checkbox" checked={film} onChange={(e) => setFilm(e.target.checked)} />
            <span>{t.filmMode}</span>
          </label>
        </div>
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
}

// ---------------------------------------------------------------- 02 · Question

function AnswerHistory({ state, t, L, lang }: { state: SessionState; t: Strings; L: LibraryStrings; lang: Lang }) {
  if (state.answers.length === 0 && state.rejected.size === 0) return null;
  return (
    <div className="card history">
      <p className="card-label">{L.answersSoFar}</p>
      <ol>
        {state.answers.map((a, i) => (
          <li key={i}>
            <span>{questionText(CC.questions[a.questionIndex], lang)}</span>
            <b className="answer-chip">{ANSWER_TEXT[lang][a.answer]}</b>
          </li>
        ))}
      </ol>
      {state.rejected.size > 0 && (
        <>
          <p className="card-label">{t.notThese}</p>
          <ul>
            {[...state.rejected].map((b) => <li key={b}><span>{bookTitles(CC.books[b], lang).main}</span></li>)}
          </ul>
        </>
      )}
    </div>
  );
}

export function QuestionScreen(props: Common & { action: ActionOf<"ask">; onAnswer: (a: Answer) => void }) {
  const { action, headingRef, onAnswer, state, t, L, lang } = props;
  const [picked, setPicked] = useState<Answer | null>(null);
  const questionPhoto = useLoaded(() => fetchPhoto(LIBRARY.en.questionImage), "question");
  // Akinator-style "yes-man / no-man" check: shown once when the run of same-side answers reaches the limit.
  const streak = streakWarning(CONFIG, state.answers);
  const [streakDismissed, setStreakDismissed] = useState(false);
  const n = action.number;
  const max = CONFIG.maxQuestions;
  return (
    <>
      <Breadcrumb items={[L.home, L.crumbGame]}>
        <button type="button" className="text-btn" onClick={props.onRestart}><Icon name="restart" size={16} />{t.startOver}</button>
      </Breadcrumb>
      <div className="question-layout">
        <aside className="sidebar">
          <div className="card progress">
            <p className="card-label">{L.progress}</p>
            <p className="progress-count" aria-label={t.questionOf(n, max)}><b>{L.questionN(n)}</b> <span>{L.upTo(max)}</span></p>
            <div className="progress-bar" aria-hidden="true"><span style={{ width: `${Math.min(100, (n / max) * 100)}%` }} /></div>
            <p className="progress-note">{L.shelfSize(titleCount(CC.catalog))}</p>
          </div>
          <AnswerHistory state={state} t={t} L={L} lang={lang} />
        </aside>
        <div className="question-col">
          <div className="card question-card">
            <UnsplashImage photo={questionPhoto} className="question-photo" />
            <div className="question-body">
              <p className="eyebrow">{L.questionEyebrow(n)}</p>
              <h1 ref={headingRef} tabIndex={-1}>{questionText(action.question, lang)}</h1>
              <p className="lead-sm">{L.notSureHint}</p>
              <details className="definition">
                <summary>{t.whatCounts}</summary>
                <p lang="en">{action.question.definition}</p>
              </details>
              {streak && !streakDismissed && (
                <div className="streak-alert" role="alert">
                  <p className="streak-title">{L.streakTitle[streak.side]}</p>
                  <p>{L.streakBody(streak.length)}{streak.side === "dont_know" ? ` ${L.streakDontKnow}` : ""}</p>
                  <div className="streak-actions">
                    <button type="button" className="btn btn-secondary" onClick={props.onUndo}>{L.streakReview}</button>
                    <button type="button" className="text-btn" onClick={() => setStreakDismissed(true)}>{L.streakContinue}</button>
                  </div>
                </div>
              )}
              <div className="answers" role="group" aria-label={t.answersGroup}>
                {ANSWERS.map((a, i) => (
                  <AnswerButton key={a} label={ANSWER_TEXT[lang][a]} selected={picked === a} shortcut={String(i + 1)} onSelect={() => setPicked(a)} />
                ))}
              </div>
              <div className="question-nav">
                <button type="button" className="text-btn" onClick={props.onUndo} disabled={!props.canUndo} aria-keyshortcuts="U">
                  <Icon name="arrowLeft" />{L.previous}
                </button>
                <Button onClick={() => picked && onAnswer(picked)} disabled={!picked}>{L.next}</Button>
              </div>
            </div>
          </div>
          <div className="free-text">
            <h2><Icon name="pencil" size={20} />{L.freeTitle}</h2>
            <label className="sr-only" htmlFor="free-text">{L.freeTitle}</label>
            <textarea id="free-text" placeholder={L.freePlaceholder} maxLength={300} disabled aria-describedby="free-soon" />
            <p className="chips-row">
              <span className="hint">{L.freeTry}</span>
              {L.freeChips.map((c) => <span key={c} className="chip">+ {c}</span>)}
            </p>
            <div className="submit-row">
              <p className="hint" id="free-soon">{L.freeTextSoon}</p>
              <Button variant="secondary" disabled title={L.comingSoon}>{L.freeSend}</Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
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
  const clues = matchingClues(CC, bookIndex, state.answers);
  return (
    <div className="clues">
      <p className="eyebrow">{L.cluesEyebrow}</p>
      <h2>{L.cluesTitle}</h2>
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
  const blurb = useLoaded(() => fetchBlurb(book), book.id);
  const photo = useLoaded(() => fetchImage(book), book.id);
  const links = catalogLinks(book, LINK_OPTIONS);
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
      <section className="banner">
        <div className="banner-msg">
          <span className="banner-check"><Icon name="checkWhiteLg" size={24} /></span>
          <div>
            <h1 ref={headingRef} tabIndex={-1}>
              {guess ? (tentative ? L.maybeBanner : series ? L.seriesBanner : state.rejected.size > 0 ? L.foundBannerAgain : L.foundBanner) : L.confirmedBanner}
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

      <section className="detail">
        <div className="cover-col">
          <div className="cover" aria-hidden="true">
            <p className="cover-author">{book.author}</p>
            <div>
              <p className="cover-title">{book.title_en}</p>
              {book.title_ko && <p className="cover-alt">{book.title_ko}</p>}
            </div>
          </div>
          {links[0] && <Button href={links[0].url} block>{L.findOnShelf}</Button>}
          <Button variant="secondary" arrow={false} block disabled title={L.comingSoon}>{L.saveShelf}</Button>
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
                <p lang="en">{blurb.text}</p>
                <p className="footnote">— <a href={blurb.sourceUrl} target="_blank" rel="noopener noreferrer">{blurb.sourceLabel}</a></p>
              </>
            ) : (
              <p className="muted">{L.synopsisNone}</p>
            )}
          </div>
          <dl className="info-table">
            <div><dt>{L.infoOriginal}</dt><dd>{book.title_en}</dd></div>
            {book.first_publication_year && <div><dt>{L.infoPublished}</dt><dd>{L.infoYear(book.first_publication_year)}</dd></div>}
            <div><dt>{L.infoAuthor}</dt><dd>{book.author}</dd></div>
            <div><dt>{L.infoLanguage}</dt><dd>{book.original_language}</dd></div>
          </dl>
          <div className="links">
            <h2>{t.findInCatalog}</h2>
            <ul>
              {links.map((l) => (
                <li key={l.url}>
                  <a href={l.url} target="_blank" rel="noopener noreferrer">{l.label} ↗</a>
                  <span className="muted">{l.description}</span>
                </li>
              ))}
            </ul>
            <Availability book={book} />
            <p className="footnote">{t.librarianTip}</p>
          </div>
        </div>
      </section>

      {photo && (
        <section className="section section-linen">
          <SectionHead eyebrow={L.moodEyebrow} title={L.moodTitle} lead={L.moodLead} />
          <figure className="mood">
            <UnsplashImage photo={photo} className="mood-photo" />
            <figcaption>{t.photoNote}</figcaption>
          </figure>
        </section>
      )}

      <section className="found-foot">
        <Clues bookIndex={action.bookIndex} state={state} t={t} L={L} lang={lang} />
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
  const blurb = useLoaded(() => fetchBlurb(book), book.id);
  const photo = useLoaded(() => fetchImage(book), book.id);
  return (
    <BookCard title={bookTitles(book, lang).main} author={authorLine(book)} description={blurb?.text} descriptionLang="en" photo={photo}
      actionLabel={L.thisIsIt} onAction={onPick} saveLabel={L.saveShelf} soonLabel={L.comingSoon} />
  );
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
