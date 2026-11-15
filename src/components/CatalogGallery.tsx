import { useMemo, useState } from "react";
import covers from "../data/catalog-covers.json";
import { ACTIVE_COLLECTION } from "../data/index.ts";
import { searchLocal } from "../community/search.ts";
import { titleCount } from "../bookInfo.ts";
import { catalogLinks } from "../engine/links.ts";
import type { CatalogBook } from "../engine/model.ts";
import { CC, LINK_OPTIONS } from "../game.ts";
import { bookTitles, type Lang, type Strings } from "../i18n/index.ts";
import type { LibraryStrings } from "../i18n/library.ts";
import { EXPERIENCE } from "../i18n/experience.ts";
import { CONTRIBUTION } from "../i18n/contribution.ts";
import { HACKATHON } from "../i18n/hackathon.ts";
import { demoHref } from "../demo.ts";
import { Button, Icon } from "./ui.tsx";

const PAGE_SIZE = 20;
type Cover = { coverId: number; workUrl: string; title: string; author: string };
const coverRecords: Record<string, Cover> = covers.books;

const COPY = {
  en: {
    showing: (n: number, total: number) => `Showing ${n} of ${total} books & series`,
    more: "Show more books", clear: "Clear search", series: "Series", book: "Book",
    credit: "Covers via Open Library. Editions may differ; title cards appear when a cover is unavailable.",
    empty: "No books found", retry: "Try a different title or author, or clear your search to browse the shelf.",
  },
  ko: {
    showing: (n: number, total: number) => `책·시리즈 ${total}개 중 ${n}개 표시`,
    more: "책 더 보기", clear: "검색 지우기", series: "시리즈", book: "도서",
    credit: "표지 제공: Open Library. 판본은 다를 수 있으며, 표지가 없으면 제목 카드가 표시돼요.",
    empty: "일치하는 책이 없어요", retry: "다른 제목·작가로 검색하거나 검색을 지우고 책장을 둘러보세요.",
  },
};

function CatalogBookCard({ book, lang, L }: { book: CatalogBook; lang: Lang; L: LibraryStrings }) {
  const title = bookTitles(book, lang).main;
  const cover = coverRecords[book.id];
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const record = catalogLinks(book, LINK_OPTIONS)[0];
  const tone = [...book.id].reduce((n, char) => n + char.charCodeAt(0), 0) % 4;
  return <li className="catalog-book">
    <a className={`catalog-book-art catalog-tone-${tone}`} href={record.url} target="_blank" rel="noopener noreferrer" aria-label={`${title} — ${EXPERIENCE[lang].openRecord}`}>
      <span className="catalog-book-kind">{book.volumes ? COPY[lang].series : COPY[lang].book}</span>
      <div className="catalog-jacket">
        <div className="catalog-title-cover" aria-hidden="true">
          <span className="catalog-cover-imprint">SEA LIBRARY</span>
          <span className="catalog-cover-title">{title}</span>
          <span className="catalog-cover-rule" />
          <span className="catalog-cover-author">{book.author}</span>
          <Icon name="tileStart" size={25} />
        </div>
        {cover && !failed && <img src={`https://covers.openlibrary.org/b/id/${cover.coverId}-M.jpg?default=false`} alt="" loading="lazy" decoding="async" className={loaded ? "catalog-cover-image is-loaded" : "catalog-cover-image"} onLoad={(event) => {
          // The cover service can return a 1px placeholder even for a missing jacket.
          if (event.currentTarget.naturalWidth > 1) setLoaded(true); else setFailed(true);
        }} onError={() => setFailed(true)} />}
      </div>
      <span className="catalog-book-open" aria-hidden="true"><Icon name="arrowRightSm" size={18} /></span>
    </a>
    <div className="catalog-book-info">
      <h3><a href={record.url} target="_blank" rel="noopener noreferrer">{title}</a></h3>
      <p>{book.author}</p>
      {book.first_publication_year != null && <p className="catalog-book-year">{book.first_publication_year}</p>}
      {book.volumes && <details className="catalog-volumes"><summary>{L.seriesVolumes} · {book.volumes.length}</summary><ol>{book.volumes.map((volume) => <li key={volume.id}>{volume.title}</li>)}</ol></details>}
    </div>
  </li>;
}

export function CatalogGallery({ t, L, lang, onAddBook }: { t: Strings; L: LibraryStrings; lang: Lang; onAddBook: () => void }) {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const E = EXPERIENCE[lang];
  const C = COPY[lang];
  const books = useMemo(() => [...CC.books].sort((a, b) => bookTitles(a, lang).main.localeCompare(bookTitles(b, lang).main, lang)), [lang]);
  const shown = useMemo(() => {
    if (!query.trim()) return books;
    const searchable = books.map((book) => ({ ...book, aliases: [...book.aliases, ...(book.volumes?.map((volume) => volume.title) ?? [])] }));
    const ids = new Set([...searchLocal(searchable, query, "", books.length), ...searchLocal(searchable, "", query, books.length)].map((hit) => hit.book.id));
    return books.filter((book) => ids.has(book.id));
  }, [books, query]);
  const visible = shown.slice(0, limit);
  const changeQuery = (value: string) => { setQuery(value); setLimit(PAGE_SIZE); };
  return <section className="section catalog-gallery-section" id="catalog">
    <div className="section-head catalog-gallery-heading"><div>
      <p className="eyebrow">{L.colEyebrow}</p>
      <h2>{ACTIVE_COLLECTION === "classic" ? t.classicShelf : t.researchShelf}</h2>
      <p className="lead-sm">{E.catalogLead}</p>
    </div><div className="catalog-heading-actions"><span className="catalog-count">{t.booksCount(titleCount(CC.catalog))}</span><Button variant="secondary" arrow={false} onClick={onAddBook}>{CONTRIBUTION[lang].heading}</Button></div></div>
    <div className="catalog-toolbar">
      <div className="field field-pill catalog-search">
        <Icon name="search" /><label className="sr-only" htmlFor="catalog-search">{E.catalogPlaceholder}</label>
        <input id="catalog-search" type="search" value={query} onChange={(event) => changeQuery(event.target.value)} placeholder={E.catalogPlaceholder} maxLength={200} />
        {query && <button className="catalog-clear" type="button" onClick={() => changeQuery("")}>{C.clear}</button>}
      </div>
      <p className="hint" role="status" aria-live="polite">{C.showing(visible.length, shown.length)}</p>
    </div>
    {shown.length === 0 ? <div className="catalog-empty"><Icon name="search" size={32} /><h3>{C.empty}</h3><p>{C.retry}</p><Button variant="secondary" onClick={() => changeQuery("")}>{C.clear}</Button></div>
      : <ul className="catalog-gallery">{visible.map((book) => <CatalogBookCard key={book.id} book={book} lang={lang} L={L} />)}</ul>}
    {visible.length < shown.length && <div className="catalog-more"><Button variant="secondary" arrow={false} onClick={() => setLimit((n) => n + PAGE_SIZE)}>{C.more}<Icon name="chevronDown" size={16} /></Button></div>}
    <div className="catalog-gallery-foot"><p className="hint">{C.credit}</p><a className="challenge-link" href={demoHref()}>{HACKATHON[lang].challengeLink} <Icon name="arrowRightSm" size={16} /></a></div>
  </section>;
}
