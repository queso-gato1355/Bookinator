// Original Sea Library home, retained independently from the game and live challenge.
import { useState, type RefObject } from "react";
import { fetchImage, fetchLibraryPopular, fetchPhoto, fetchPopular, titleCount, type LibraryLoan, type PopularBook } from "../bookInfo.ts";
import { ACTIVE_COLLECTION, COLLECTIONS, collectionHref, type CollectionId } from "../data/index.ts";
import type { CatalogBook } from "../engine/model.ts";
import { CC } from "../game.ts";
import { bookTitles, type Lang, type Strings } from "../i18n/index.ts";
import { LIBRARY, type LibraryStrings } from "../i18n/library.ts";
import { DESIGN_MOCK, type LeaderboardEntry } from "../mock/design.ts";
import { LIBRARY_SAMPLE_PHOTOS } from "../assets/libraryPhotos.ts";
import { SEA_WINDOW_PHOTO } from "../assets/seaPhoto.ts";
import { BookCard, Button, Icon, LeaderboardRow, Trend, UnsplashImage, useLoaded, type IconName } from "./ui.tsx";

type Heading = RefObject<HTMLHeadingElement | null>;
const authorLine = (book: CatalogBook) => `${book.author}${book.first_publication_year ? ` · ${book.first_publication_year}` : ""}`;

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
  const fallback = LIBRARY_SAMPLE_PHOTOS[1 + DESIGN_MOCK.en.collection.findIndex((item) => item.imageCaption === query)];
  return (
    <BookCard title={item.title} author={item.author} description={item.description} badge={L.colBadge} genre={item.genre}
      photo={photo ?? fallback} imageCaption={item.imageCaption} actionLabel={L.colMore} saveLabel={L.saveShelf} soonLabel={L.comingSoon} />
  );
}

const TILE_ICONS: IconName[] = ["tileStart", "tileSearch", "tileRequest", "tileCard", "tileGuide"];

export function Leaderboard({ L, lang }: { L: LibraryStrings; lang: Lang }) {
  // Counted over every release (not only the one being played), so a new catalog version does not reset the
  // board to sample data; books that are not on the current shelf are left out and the ranks closed up.
  const live = useLoaded<PopularBook[]>(() => fetchPopular(null, 20), "popular-all");
  const liveBooks = (live ?? []).flatMap((r) => {
    const idx = CC.bookIndex.get(r.book_id);
    return idx === undefined || !(r.found_count > 0) ? [] : [{ book: CC.books[idx], count: r.found_count }];
  }).slice(0, 8);
  const liveEntries: LeaderboardEntry[] = liveBooks.map(({ book, count }, i) =>
    ({ rank: i + 1, title: bookTitles(book, lang).main, author: authorLine(book), count, trend: null }));
  const isLive = liveEntries.length > 0;
  const entries = isLive ? liveEntries : DESIGN_MOCK[lang].leaderboard;
  const [top, ...rest] = entries;
  const topBook = isLive ? liveBooks[0].book : null;
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
          <UnsplashImage photo={photo ?? (isLive ? null : LIBRARY_SAMPLE_PHOTOS[0])} caption={top.imageCaption} className="lb-top-photo" />
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
        <Button variant="secondary" disabled title={L.comingSoon}>{L.lbAll}</Button>
        {!isLive && <p className="footnote">{L.lbSample}</p>}
      </div>
    </section>
  );
}

/** Most-borrowed literature from Data4Library; hidden until that API answers. */
function LibraryLoans({ t }: { t: Strings }) {
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

export function LibraryHome({ headingRef, onStart, t, L, lang }: { headingRef: Heading; onStart: (film: boolean) => void; t: Strings; L: LibraryStrings; lang: Lang }) {
  const [film, setFilm] = useState(false);
  const mock = DESIGN_MOCK[lang];
  const books = [...CC.books].sort((a, b) => bookTitles(a, lang).main.localeCompare(bookTitles(b, lang).main, lang));
  const shelfName: Record<CollectionId, string> = { classic: t.classicShelf, research: t.researchShelf };
  const start = () => onStart(film);
  // Photos are searched with the English phrase in both languages (Unsplash search works best in English).
  const heroPhoto = useLoaded(() => fetchPhoto(LIBRARY.en.heroImage), "hero");
  return (
    <div className="library-home">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow eyebrow-icon"><Icon name="eyebrow" size={20} />{L.heroEyebrow}</p>
          <h1 ref={headingRef} tabIndex={-1}>{L.heroTitle[0]}<br />{L.heroTitle[1]}</h1>
          <p className="lead">{L.heroLead}</p>
          <div className="hero-actions">
            <Button className="btn-hero" onClick={start}>{L.startQuestions}</Button>
          </div>
        </div>
        <UnsplashImage photo={heroPhoto ?? SEA_WINDOW_PHOTO} caption={L.heroImage} className="hero-photo" priority />
      </section>

      <section className="tiles">
        {L.tiles.map(([title, sub], i) => {
          const body = (
            <>
              <span className="tile-icon"><Icon name={TILE_ICONS[i]} size={22} /></span>
              <span className="tile-text"><b>{title}</b><span>{sub}</span></span>
            </>
          );
          return i === 0 ? (
            <button key={title} type="button" className="tile" onClick={start}>{body}</button>
          ) : (
            <div key={title} className="tile tile-soon" title={L.comingSoon}>{body}</div>
          );
        })}
      </section>

      <Leaderboard L={L} lang={lang} />
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
          <Button variant="ghost" disabled title={L.comingSoon}>{L.colAll}</Button>
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

      <section className="section section-linen" id="programs">
        <SectionHead eyebrow={L.progEyebrow} title={L.progTitle}>
          <Button variant="ghost" disabled title={L.comingSoon}>{L.progAll}</Button>
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
    </div>
  );
}

