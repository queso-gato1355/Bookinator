// Library pages: 자료 찾기 (catalog), 책 상세, 리더보드, 프로그램, 이용 안내, 도서관 소개.
// The library itself is fictional (a "Sea Library" on Pohang's beach); the books, ranks and labels are real data.
import { useState, type FormEvent, type RefObject } from "react";
import { fetchBlurb, fetchPhoto } from "../bookInfo.ts";
import {
  asCatalogBook, factsFor, findEntry, LIBRARY_BOOKS, LIBRARY_COUNTS, LIBRARY_TAGS, queryLibrary, type CatalogQuery, type LibraryEntry,
} from "../data/library.ts";
import { catalogLinks } from "../engine/links.ts";
import { LINK_OPTIONS } from "../game.ts";
import { type Lang, type Strings } from "../i18n/index.ts";
import type { LibraryStrings } from "../i18n/library.ts";
import { LIBRARY_CONTENT, MOOD_WORD, PAGES_TEXT, TAG_LABEL } from "../i18n/pages.ts";
import { QUESTIONS_KO } from "../i18n/questionsKo.ts";
import { href, navigate, type Route } from "../router.ts";
import { Breadcrumb, Button, GeneratedCover, Icon, UnsplashImage, useLoaded } from "./ui.tsx";
import { LeaderboardSection, LibraryLoans } from "./screens.tsx";

type Heading = RefObject<HTMLHeadingElement | null>;
interface PageProps { headingRef: Heading; t: Strings; L: LibraryStrings; lang: Lang }

const titleOf = (b: LibraryEntry, lang: Lang) => (lang === "ko" && b.title_ko) || b.title;
const altTitleOf = (b: LibraryEntry, lang: Lang) => (lang === "ko" && b.title_ko && b.title_ko !== b.title ? b.title : null);

function PageIntro({ headingRef, eyebrow, title, lead, crumbs }: { headingRef: Heading; eyebrow: string; title: string; lead: string; crumbs: string[] }) {
  return (
    <>
      <Breadcrumb items={crumbs} />
      <section className="intro">
        <p className="eyebrow">{eyebrow}</p>
        <h1 ref={headingRef} tabIndex={-1}>{title}</h1>
        <p className="lead-sm">{lead}</p>
      </section>
    </>
  );
}

function StatusLine({ b, P }: { b: LibraryEntry; P: (typeof PAGES_TEXT)["ko"] }) {
  const text = b.status === "playable" ? P.statusPlayable : b.status === "series" ? P.statusSeries(b.series_title ?? "") : P.statusCandidate;
  return <span className={`status status-${b.status}`}>{text}</span>;
}

// ---------------------------------------------------------------- 자료 찾기

export function CatalogPage({ headingRef, L, lang, route }: PageProps & { route: Route }) {
  const P = PAGES_TEXT[lang];
  const p = route.params;
  const query: CatalogQuery = {
    q: p.get("q") ?? "",
    tag: LIBRARY_TAGS.includes(p.get("tag") ?? "") ? p.get("tag")! : "",
    status: (["playable", "candidate"] as const).find((s) => s === p.get("status")) ?? "all",
    sort: p.get("sort") === "title" ? "title" : "rank",
    page: Math.max(1, Number(p.get("page")) || 1),
  };
  const [text, setText] = useState(query.q);
  const res = queryLibrary(query, lang);
  const go = (patch: Partial<CatalogQuery>) => {
    const next = { ...query, page: 1, ...patch };
    navigate(href("catalog", { params: { q: next.q, tag: next.tag, status: next.status === "all" ? "" : next.status, sort: next.sort === "rank" ? "" : next.sort, page: next.page > 1 ? next.page : "" } }));
  };
  const submit = (e: FormEvent) => { e.preventDefault(); go({ q: text.trim() }); };
  const from = res.total ? (res.page - 1) * 24 + 1 : 0;
  const to = Math.min(res.total, res.page * 24);
  const pageNumbers = Array.from({ length: res.pages }, (_, i) => i + 1).filter((n) => n === 1 || n === res.pages || Math.abs(n - res.page) <= 2);

  return (
    <>
      <PageIntro headingRef={headingRef} eyebrow={P.catEyebrow} title={P.catTitle} lead={P.catLead(LIBRARY_COUNTS.books, LIBRARY_COUNTS.playable)} crumbs={[L.home, P.catTitle]} />
      <section className="catalog-tools">
        <form className="input-row" role="search" onSubmit={submit}>
          <label className="sr-only" htmlFor="cat-q">{P.catSearchLabel}</label>
          <span className="field field-pill">
            <Icon name="field" size={20} />
            <input id="cat-q" type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder={P.catSearchPlaceholder} maxLength={100} autoComplete="off" />
          </span>
          <button type="submit" className="btn btn-primary">{P.catSearch}</button>
        </form>
        <div className="catalog-filters">
          <div className="chip-row" role="group" aria-label={P.catTags}>
            <button type="button" className="chip chip-toggle" aria-pressed={!query.tag} onClick={() => go({ tag: "" })}>{P.catAllTags}</button>
            {LIBRARY_TAGS.filter((tg) => LIBRARY_BOOKS.some((b) => b.tags.includes(tg))).map((tg) => (
              <button key={tg} type="button" className="chip chip-toggle" aria-pressed={query.tag === tg} onClick={() => go({ tag: query.tag === tg ? "" : tg })}>
                {TAG_LABEL[lang][tg] ?? tg}
              </button>
            ))}
          </div>
          <div className="select-row">
            <label>
              <span>{P.catStatus}</span>
              <select value={query.status} onChange={(e) => go({ status: e.target.value as CatalogQuery["status"] })}>
                <option value="all">{P.catStatusAll}</option>
                <option value="playable">{P.catStatusPlayable}</option>
                <option value="candidate">{P.catStatusCandidate}</option>
              </select>
            </label>
            <label>
              <span>{P.catSort}</span>
              <select value={query.sort} onChange={(e) => go({ sort: e.target.value as CatalogQuery["sort"] })}>
                <option value="rank">{P.catSortRank}</option>
                <option value="title">{P.catSortTitle}</option>
              </select>
            </label>
          </div>
        </div>
        <p className="hint" aria-live="polite">{P.catResults(res.total, from, to)} · {P.catTagNote}</p>
      </section>

      {res.total === 0 ? (
        <section className="section section-tight"><p className="lead-sm">{P.catEmpty}</p></section>
      ) : (
        <ul className="cover-grid">
          {res.items.map((b) => (
            <li key={b.id}>
              <a className="cover-card" href={href("book", { id: b.id })}>
                <GeneratedCover title={titleOf(b, lang)} author={b.author} seed={b.title} />
                <span className="cover-card-text">
                  <b>{titleOf(b, lang)}</b>
                  <span>{b.author}</span>
                  <span className="cover-card-meta">
                    {b.rank !== null && <span className="rank">{P.rankBadge(b.rank + 1)}</span>}
                    <StatusLine b={b} P={P} />
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {res.pages > 1 && (
        <nav className="pagination" aria-label="pagination">
          <a className={`page-btn ${res.page === 1 ? "is-disabled" : ""}`} aria-disabled={res.page === 1} href={href("catalog", { params: { q: query.q, tag: query.tag, status: query.status === "all" ? "" : query.status, sort: query.sort === "rank" ? "" : query.sort, page: Math.max(1, res.page - 1) } })}>
            <Icon name="arrowLeft" />{P.catPrev}
          </a>
          {pageNumbers.map((n, i) => (
            <span key={n} className="page-num-wrap">
              {i > 0 && n - pageNumbers[i - 1] > 1 && <span className="page-gap">…</span>}
              <a className="page-num" aria-current={n === res.page ? "page" : undefined} aria-label={P.catPage(n)}
                href={href("catalog", { params: { q: query.q, tag: query.tag, status: query.status === "all" ? "" : query.status, sort: query.sort === "rank" ? "" : query.sort, page: n > 1 ? n : "" } })}>{n}</a>
            </span>
          ))}
          <a className={`page-btn ${res.page === res.pages ? "is-disabled" : ""}`} aria-disabled={res.page === res.pages} href={href("catalog", { params: { q: query.q, tag: query.tag, status: query.status === "all" ? "" : query.status, sort: query.sort === "rank" ? "" : query.sort, page: Math.min(res.pages, res.page + 1) } })}>
            {P.catNext}<Icon name="arrowRight" />
          </a>
        </nav>
      )}
    </>
  );
}

// ---------------------------------------------------------------- 책 상세 (its own page)

export function BookPage({ headingRef, L, lang, route, onPlay }: PageProps & { route: Route; onPlay: () => void }) {
  const P = PAGES_TEXT[lang];
  const b = route.id ? findEntry(route.id) : null;
  const book = b ? asCatalogBook(b) : null;
  const blurb = useLoaded(() => (book ? fetchBlurb(book) : Promise.resolve(null)), `blurb:${route.id}`);
  const photo = useLoaded(() => (b ? fetchPhoto(b.title) : Promise.resolve(null)), `photo:${route.id}`);
  if (!b || !book) {
    return (
      <section className="intro">
        <h1 ref={headingRef} tabIndex={-1}>{P.bookNotFound}</h1>
        <Button href={href("catalog")} arrow={false}>{P.bookBack}</Button>
      </section>
    );
  }
  const moods = b.tags.map((tg) => MOOD_WORD[lang][tg]).filter(Boolean);
  const facts = factsFor(b);
  const links = catalogLinks(book, LINK_OPTIONS);
  const alt = altTitleOf(b, lang);
  return (
    <>
      <Breadcrumb items={[L.home, P.catTitle, titleOf(b, lang)]}>
        <a className="text-btn" href={href("catalog")}><Icon name="arrowLeft" />{P.bookBack}</a>
      </Breadcrumb>
      <section className="detail">
        <div className="cover-col">
          <GeneratedCover title={titleOf(b, lang)} author={b.author} seed={b.title} large />
          {b.status !== "candidate" && <Button onClick={onPlay} block>{P.bookPlay}</Button>}
          {links[0] && <Button variant="secondary" href={links[0].url} block>{P.bookFind}</Button>}
        </div>
        <div className="info-col">
          <div className="tags-row">
            {b.tags.map((tg) => <a key={tg} className="chip" href={href("catalog", { params: { tag: tg } })}>#{TAG_LABEL[lang][tg] ?? tg}</a>)}
          </div>
          <div className="title-block">
            <h1 ref={headingRef} tabIndex={-1} className="book-title">{titleOf(b, lang)}</h1>
            <p className="muted">{[alt, b.author, b.year].filter(Boolean).join("  ·  ")}</p>
          </div>
          <dl className="info-table">
            <div><dt>{P.bookAuthor}</dt><dd>{b.author}</dd></div>
            {b.year && <div><dt>{P.bookYear}</dt><dd>{b.year}</dd></div>}
            {b.lang && <div><dt>{P.bookLang}</dt><dd>{b.lang}</dd></div>}
            {b.rank !== null && <div><dt>{P.bookRank}</dt><dd>{P.rankBadge(b.rank + 1)}</dd></div>}
            <div><dt>{P.bookStatus}</dt><dd><StatusLine b={b} P={P} /></dd></div>
          </dl>
          <div className="synopsis">
            <h2>{P.bookStory}</h2>
            {blurb ? (
              <>
                <p lang="en">{blurb.text}</p>
                <p className="footnote">— <a href={blurb.sourceUrl} target="_blank" rel="noopener noreferrer">{blurb.sourceLabel}</a></p>
              </>
            ) : (
              <p className="muted">{P.bookStoryNone}</p>
            )}
          </div>
          <div className="links">
            <h2>{P.bookFind}</h2>
            <ul>
              {links.map((l) => (
                <li key={l.url}><a href={l.url} target="_blank" rel="noopener noreferrer">{l.label} ↗</a><span className="muted">{l.description}</span></li>
              ))}
              {b.wiki && <li><a href={`https://en.wikipedia.org/?curid=${b.wiki}`} target="_blank" rel="noopener noreferrer">{P.bookWikipedia} ↗</a></li>}
            </ul>
          </div>
        </div>
      </section>

      <section className="section section-linen">
        <div className="section-head"><div><p className="eyebrow">MOOD</p><h2>{P.bookMood}</h2><p className="lead-sm">{P.bookMoodLead}</p></div></div>
        <div className="mood-grid">
          <UnsplashImage photo={photo} caption={titleOf(b, lang)} className="mood-photo" />
          <div className="mood-words">
            {moods.length ? moods.map((m) => <p key={m} className="mood-word">{m}</p>) : <p className="muted">{P.bookMoodNone}</p>}
            <p className="footnote">{P.catTagNote}</p>
          </div>
        </div>
      </section>

      <section className="found-foot">
        <div className="clues">
          <p className="eyebrow">ABOUT THE BOOK</p>
          <h2>{P.bookFacts}</h2>
          {b.status === "series" && <p className="muted">{P.bookSeriesNote(b.series_title ?? "")}</p>}
          {facts.length ? (
            <ul>
              {facts.map((f) => (
                <li key={f.text}>
                  <Icon name={f.yes ? "checkClue" : "info"} />
                  <span className="clue-q">
                    {lang === "ko" ? QUESTIONS_KO[f.text] ?? f.text : f.text}
                    <small>{f.status === "ai_recall" ? L.aiRecall : f.status === "supported" ? "Wikipedia · Wikidata" : ""}</small>
                  </span>
                  <b>{f.yes ? P.bookYes : P.bookNo}</b>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">{P.bookFactsNone}</p>
          )}
        </div>
      </section>
    </>
  );
}

// ---------------------------------------------------------------- 리더보드

export function LeaderboardPage({ headingRef, t, L, lang }: PageProps) {
  const P = PAGES_TEXT[lang];
  const top = LIBRARY_BOOKS.filter((b) => b.rank !== null).slice(0, 20);
  return (
    <>
      <PageIntro headingRef={headingRef} eyebrow="LEADERBOARD" title={P.lbPageTitle} lead={P.lbPageLead} crumbs={[L.home, P.lbPageTitle]} />
      <LeaderboardSection L={L} lang={lang} />
      <LibraryLoans t={t} />
      <section className="section">
        <div className="section-head"><div><p className="eyebrow">ALL TIME</p><h2>{P.lbPopularTitle}</h2><p className="lead-sm">{P.lbPopularLead}</p></div></div>
        <ol className="lb-list lb-list-wide">
          {top.map((b, i) => (
            <li key={b.id} className="lb-row">
              <span className="lb-rank">{i + 1}</span>
              <span className="lb-cover" aria-hidden="true" />
              <a className="lb-info" href={href("book", { id: b.id })}><b>{titleOf(b, lang)}</b><span>{b.author}</span></a>
              <span className="lb-stat"><StatusLine b={b} P={P} /></span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

// ---------------------------------------------------------------- 프로그램

export function ProgramsPage({ headingRef, L, lang }: PageProps) {
  const P = PAGES_TEXT[lang];
  const C = LIBRARY_CONTENT[lang];
  return (
    <>
      <PageIntro headingRef={headingRef} eyebrow={L.progEyebrow} title={L.progTitle} lead={P.progLead} crumbs={[L.home, L.nav[3]]} />
      <section className="section section-tight">
        <div className="card-grid">
          {C.programs.map((p) => (
            <article key={p.title} className="program">
              <p className="program-meta"><span className="program-date"><Icon name="calendar" />{p.date}</span><span className="audience">{p.audience}</span></p>
              <h3>{p.title}</h3>
              <p>{p.description}</p>
              <dl className="program-facts">
                <div><dt>{P.progPlace}</dt><dd>{p.place}</dd></div>
                <div><dt>{P.progSeats}</dt><dd>{p.seats}</dd></div>
              </dl>
              <Button variant="ghost" disabled title={P.progDemo}>{L.progApply}</Button>
            </article>
          ))}
        </div>
        <p className="footnote">{P.progDemo} {P.fictional}</p>
      </section>
    </>
  );
}

// ---------------------------------------------------------------- 이용 안내

export function GuidePage({ headingRef, L, lang }: PageProps) {
  const P = PAGES_TEXT[lang];
  const C = LIBRARY_CONTENT[lang];
  return (
    <>
      <PageIntro headingRef={headingRef} eyebrow="VISIT" title={P.guideTitle} lead={P.guideLead} crumbs={[L.home, P.guideTitle]} />
      <section className="section section-tight">
        <div className="guide-grid">
          {C.guide.map((g) => (
            <article key={g.title} className="card guide-card" id={g.title}>
              <h2>{g.title}</h2>
              <dl className="info-table single">
                {g.rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
              </dl>
            </article>
          ))}
        </div>
      </section>
      <section className="section section-linen">
        <div className="section-head"><div><p className="eyebrow">FAQ</p><h2>{lang === "ko" ? "자주 묻는 질문" : "FAQ"}</h2></div></div>
        <div className="faq">
          {C.faq.map(([q, a]) => (
            <details key={q} className="faq-item">
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
        <p className="footnote">{P.fictional}</p>
      </section>
    </>
  );
}

// ---------------------------------------------------------------- 도서관 소개

export function AboutPage({ headingRef, L, lang }: PageProps) {
  const P = PAGES_TEXT[lang];
  const C = LIBRARY_CONTENT[lang];
  const photo = useLoaded(() => fetchPhoto("library by the sea window"), "about");
  return (
    <>
      <PageIntro headingRef={headingRef} eyebrow="ABOUT" title={P.aboutTitle} lead={C.aboutLead[0]} crumbs={[L.home, P.aboutTitle]} />
      <section className="section section-tight about">
        <UnsplashImage photo={photo} caption={L.heroImage} className="about-photo" />
        <p className="lead">{C.aboutLead[1]}</p>
      </section>
      <section className="section section-linen">
        <div className="section-head"><div><p className="eyebrow">FLOORS</p><h2>{lang === "ko" ? "층별 안내" : "Floor guide"}</h2></div></div>
        <ol className="steps">
          {C.floors.map(([name, desc], i) => (
            <li key={name}><span className="step-no">{String(i + 1).padStart(2, "0")}</span><h3>{name}</h3><p>{desc}</p></li>
          ))}
        </ol>
      </section>
      <section className="section">
        <div className="section-head"><div><p className="eyebrow">CREDITS</p><h2>{lang === "ko" ? "데이터와 출처" : "Data and sources"}</h2></div></div>
        <ul className="credits-list">{C.credits.map((c) => <li key={c}>{c}</li>)}</ul>
        <p className="footnote">{P.fictional}</p>
      </section>
    </>
  );
}

// ---------------------------------------------------------------- home: the most loved books

export function FamousBooks({ books, lang }: { books: LibraryEntry[]; L?: LibraryStrings; lang: Lang }) {
  const P = PAGES_TEXT[lang];
  return (
    <section className="section">
      <div className="section-head">
        <div><p className="eyebrow">{P.famousEyebrow}</p><h2>{P.famousTitle}</h2><p className="lead-sm">{P.famousLead}</p></div>
        <Button variant="ghost" href={href("catalog")}>{P.famousMore}</Button>
      </div>
      <div className="card-grid famous-grid">
        {books.map((b) => <FamousCard key={b.id} b={b} lang={lang} />)}
      </div>
    </section>
  );
}

function FamousCard({ b, lang }: { b: LibraryEntry; lang: Lang }) {
  const P = PAGES_TEXT[lang];
  const blurb = useLoaded(() => fetchBlurb(asCatalogBook(b)), `famous:${b.id}`);
  const photo = useLoaded(() => fetchPhoto(b.title), `photo:${b.id}`);
  return (
    <article className="book-card">
      <UnsplashImage photo={photo} className="book-card-photo" />
      <div className="book-card-body">
        <p className="book-card-tags">
          {b.rank !== null && <span className="badge">{P.rankBadge(b.rank + 1)}</span>}
          {b.tags.slice(0, 2).map((tg) => <span key={tg} className="genre">#{TAG_LABEL[lang][tg]}</span>)}
        </p>
        <h3 className="book-card-title">{titleOf(b, lang)}</h3>
        <p className="book-card-author">{b.author}</p>
        {blurb && <p className="book-card-desc" lang="en">{blurb.text}</p>}
        <div className="book-card-actions">
          <a className="pick" href={href("book", { id: b.id })}><span>{P.famousOpen}</span><Icon name="arrowRightSm" size={16} /></a>
        </div>
      </div>
    </article>
  );
}
