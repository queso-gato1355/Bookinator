// Reusable pieces of the "Sea Library" design (Figma "Components" frame): Header, Mobile Header,
// Footer, Button, Answer, Book Card, Leaderboard Row and Image / Unsplash. Icons are the SVGs
// exported from the design file (src/assets/icons), used as-is.
import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import arrowLeft from "../assets/icons/arrow-left.svg";
import arrowRight from "../assets/icons/arrow-right.svg";
import arrowRightSm from "../assets/icons/arrow-right-sm.svg";
import arrowRightWhite from "../assets/icons/arrow-right-white.svg";
import bookmark from "../assets/icons/bookmark.svg";
import calendar from "../assets/icons/calendar.svg";
import check from "../assets/icons/check.svg";
import checkClue from "../assets/icons/check-clue.svg";
import checkWhite from "../assets/icons/check-white.svg";
import checkWhiteLg from "../assets/icons/check-white-lg.svg";
import chevronDown from "../assets/icons/chevron-down.svg";
import eyebrow from "../assets/icons/eyebrow.svg";
import field from "../assets/icons/field.svg";
import image from "../assets/icons/image.svg";
import info from "../assets/icons/info.svg";
import menu from "../assets/icons/menu.svg";
import pencil from "../assets/icons/pencil.svg";
import restart from "../assets/icons/restart.svg";
import search from "../assets/icons/search.svg";
import tileCard from "../assets/icons/tile-card.svg";
import tileGuide from "../assets/icons/tile-guide.svg";
import tileRequest from "../assets/icons/tile-request.svg";
import tileSearch from "../assets/icons/tile-search.svg";
import tileStart from "../assets/icons/tile-start.svg";
import waves from "../assets/icons/waves.svg";
import type { Lang } from "../i18n/index.ts";
import { EXPERIENCE } from "../i18n/experience.ts";
import type { LibraryStrings } from "../i18n/library.ts";
import { Creators } from "./Creators.tsx";

const ICONS = {
  arrowLeft, arrowRight, arrowRightSm, arrowRightWhite, bookmark, calendar, check, checkClue, checkWhite, checkWhiteLg,
  chevronDown, eyebrow, field, image, info, menu, pencil, restart, search, tileCard, tileGuide, tileRequest, tileSearch,
  tileStart, waves,
};
export type IconName = keyof typeof ICONS;

/** Decorative icon in a fixed square box (the design's 14–24px icon frames). */
export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <span className="icon" style={{ width: size, height: size }} aria-hidden="true">
      <img src={ICONS[name]} alt="" />
    </span>
  );
}

/** Optional content never blocks the game, and failures have an explicit settled state. */
export function useLoadedState<T>(load: () => Promise<T | null>, key: string): { value: T | null; loading: boolean } {
  const [result, setResult] = useState<{ value: T | null; loading: boolean }>({ value: null, loading: true });
  useEffect(() => {
    let live = true;
    setResult({ value: null, loading: true });
    load().then(
      (value) => { if (live) setResult({ value, loading: false }); },
      () => { if (live) setResult({ value: null, loading: false }); },
    );
    return () => { live = false; };
    // The key identifies the request; callers use stable data for a given key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return result;
}
export function useLoaded<T>(load: () => Promise<T | null>, key: string): T | null {
  return useLoadedState(load, key).value;
}

// ---------------------------------------------------------------- Button

type ButtonVariant = "primary" | "secondary" | "ghost" | "on-dark-primary" | "on-dark-secondary";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Trailing arrow (design default for primary / secondary / ghost). */
  arrow?: boolean;
  /** Leading check mark (the "That's it" button). */
  checkMark?: boolean;
  /** Opens a link instead of running an action. */
  href?: string;
  block?: boolean;
  children: ReactNode;
}

export function Button({ variant = "primary", arrow = true, checkMark = false, href, block = false, className = "", children, ...rest }: ButtonProps) {
  const cls = `btn btn-${variant} ${block ? "btn-block" : ""} ${className}`;
  const body = (
    <>
      {checkMark && <Icon name="check" />}
      <span>{children}</span>
      {arrow && <Icon name={variant === "primary" ? "arrowRightWhite" : "arrowRight"} />}
    </>
  );
  if (href) {
    return (
      <a className={cls} href={href} target="_blank" rel="noopener noreferrer">
        {body}
      </a>
    );
  }
  return (
    <button type="button" className={cls} {...rest}>
      {body}
    </button>
  );
}

// ---------------------------------------------------------------- Answer

export function AnswerButton({ label, onSelect, shortcut }: { label: string; onSelect: () => void; shortcut?: string }) {
  return <button type="button" className="answer" aria-keyshortcuts={shortcut} onClick={(event) => {
    // Ignore the second mouse/touch click of a double-click on a freshly rendered answer.
    if (event.detail <= 1) onSelect();
  }}>
    <span>{label}</span>{shortcut && <kbd className="answer-shortcut" aria-hidden="true">{shortcut}</kbd>}
  </button>;
}

// ---------------------------------------------------------------- Image / Unsplash

export interface Photo {
  url: string;
  alt: string | null;
  photographer?: string;
  photographer_url?: string;
  photo_url?: string;
}

/** An image slot. Without a photo it shows the design's sea gradient; the caption pill is optional. */
export function UnsplashImage({ photo, caption, className = "", priority = false }: { photo?: Photo | null; caption?: string; className?: string; priority?: boolean }) {
  return (
    <div className={`photo ${className}`}>
      {photo && <img className="photo-img" src={photo.url} alt={photo.alt ?? ""} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} referrerPolicy="no-referrer" />}
      {photo?.photographer ? (
        <p className="photo-caption">
          <Icon name="image" size={14} />
          <span>
            <a href={photo.photo_url} target="_blank" rel="noopener noreferrer">Unsplash</a>
            {" · "}
            <a href={photo.photographer_url} target="_blank" rel="noopener noreferrer">{photo.photographer}</a>
          </span>
        </p>
      ) : caption ? (
        <p className="photo-caption">
          <Icon name="image" size={14} />
          <span>Unsplash · {caption}</span>
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- Book Card

export interface BookCardProps {
  title: string;
  author: string;
  description?: string | null;
  /** Language of the description when it differs from the page (source text is English). */
  descriptionLang?: string;
  badge?: string;
  genre?: string;
  photo?: Photo | null;
  imageCaption?: string;
  actionLabel: string;
  onAction?: () => void;
  saveLabel: string;
  soonLabel: string;
}

export function BookCard(p: BookCardProps) {
  return (
    <article className="book-card">
      <UnsplashImage photo={p.photo} caption={p.imageCaption} className="book-card-photo" />
      <div className="book-card-body">
        {(p.badge || p.genre) && (
          <p className="book-card-tags">
            {p.badge && <span className="badge">{p.badge}</span>}
            {p.genre && <span className="genre">{p.genre}</span>}
          </p>
        )}
        <h3 className="book-card-title">{p.title}</h3>
        <p className="book-card-author">{p.author}</p>
        {p.description && <p className="book-card-desc" lang={p.descriptionLang}>{p.description}</p>}
        <div className="book-card-actions">
          <button type="button" className="pick" onClick={p.onAction} disabled={!p.onAction} title={p.onAction ? undefined : p.soonLabel}>
            <span>{p.actionLabel}</span>
            <Icon name="arrowRightSm" size={16} />
          </button>
          <button type="button" className="icon-btn-plain" disabled aria-label={p.saveLabel} title={p.soonLabel}><Icon name="bookmark" size={20} /></button>
        </div>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------- Leaderboard Row

export function Trend({ value }: { value: number | "new" | null | undefined }) {
  if (value === null || value === undefined) return null;
  if (value === "new") return <span className="trend trend-up">NEW</span>;
  if (value === 0) return <span className="trend">–</span>;
  return <span className={`trend ${value > 0 ? "trend-up" : "trend-down"}`}>{value > 0 ? "▲" : "▼"} {Math.abs(value)}</span>;
}

export function LeaderboardRow({ rank, title, author, count, trend }: { rank: number; title: string; author: string; count: string; trend?: number | "new" | null }) {
  return (
    <li className="lb-row">
      <span className="lb-rank">{rank}</span>
      <span className="lb-cover" aria-hidden="true" />
      <span className="lb-info">
        <b>{title}</b>
        <span>{author}</span>
      </span>
      <span className="lb-stat">
        <b>{count}</b>
        <Trend value={trend} />
      </span>
    </li>
  );
}

// ---------------------------------------------------------------- Header / Mobile Header / Footer

interface HeaderProps {
  L: LibraryStrings;
  lang: Lang;
  setLang: (l: Lang) => void;
  onHome: () => void;
  onStart: () => void;
  onCatalog: () => void;
  onSection: (id: string) => void;
  hours: string;
}

function Logo({ L, onHome, size }: { L: LibraryStrings; onHome: () => void; size: number }) {
  return (
    <button type="button" className="logo" onClick={onHome} aria-label="Bookinator">
      <span className="logo-mark">
        <Icon name="waves" size={size} />
      </span>
      <span className="logo-word">
        <span className="logo-name">Bookinator</span>
        <span className="logo-tag">{L.logoTag}</span>
      </span>
    </button>
  );
}

function LangSwitch({ L, lang, setLang }: { L: LibraryStrings; lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <button type="button" className="lang-switch" onClick={() => setLang(lang === "ko" ? "en" : "ko")} lang={lang === "ko" ? "en" : "ko"}>
      {L.langSwitch}
    </button>
  );
}

function navigationActions(onStart: () => void, onCatalog: () => void, onSection: (id: string) => void) {
  return [onStart, onCatalog, () => onSection("leaderboard"), () => onSection("programs"), () => onSection("visit"), () => onSection("about")];
}

export function Header({ L, lang, setLang, hours, onHome, onStart, onCatalog, onSection }: HeaderProps) {
  const actions = navigationActions(onStart, onCatalog, onSection);
  return <header className="header desktop-only">
    <div className="utility"><p>{hours}</p><div className="utility-links">{L.utilLinks.map((label) => <span key={label} className="soon" title={L.comingSoon}>{label}</span>)}<LangSwitch L={L} lang={lang} setLang={setLang} /></div></div>
    <div className="mainbar"><Logo L={L} onHome={onHome} size={24} />
      <nav className="nav" aria-label="Bookinator">{L.nav.map((label, i) => <button key={label} type="button" onClick={actions[i]}>{label}</button>)}</nav>
      <div className="header-actions"><button type="button" className="icon-btn" aria-label={L.search} onClick={onCatalog}><Icon name="search" size={20} /></button><Button variant="secondary" arrow={false} disabled title={L.comingSoon}>{L.login}</Button></div>
    </div>
  </header>;
}

export function MobileHeader({ L, lang, setLang, onHome, onStart, onCatalog, onSection }: HeaderProps) {
  const [open, setOpen] = useState(false);
  const E = EXPERIENCE[lang];
  const actions = navigationActions(onStart, onCatalog, onSection);
  const go = (action: () => void) => { setOpen(false); action(); };
  return <header className="mobile-header mobile-only">
    <Logo L={L} onHome={() => go(onHome)} size={20} />
    <div className="header-actions"><LangSwitch L={L} lang={lang} setLang={setLang} />
      <button type="button" className="icon-btn mobile-search" aria-label={L.search} onClick={() => go(onCatalog)}><Icon name="search" size={20} /></button>
      <button type="button" className="icon-btn" aria-label={open ? E.close : L.menu} aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen(!open)}><Icon name="menu" size={20} /></button>
    </div>
    {open && <nav id="mobile-nav" className="mobile-nav" aria-label="Bookinator" onKeyDown={(event) => { if (event.key === "Escape") { setOpen(false); event.currentTarget.parentElement?.querySelector<HTMLButtonElement>("[aria-controls]")?.focus(); } }}>{L.nav.map((label, i) => <button key={label} type="button" onClick={() => go(actions[i])}>{label}</button>)}</nav>}
  </header>;
}

export function Footer({ L, address, children, lang }: { L: LibraryStrings; address: string; children?: ReactNode; lang: Lang }) {
  return <footer className="footer" id="about" tabIndex={-1}>
    <div className="footer-top"><div className="footer-brand" id="visit"><p className="footer-logo">Bookinator</p><p>{L.footerTag}</p><p>{address}</p></div>
      <div className="footer-cols">{L.footerCols.map((col) => <ul key={col[0]}>{col.map((label, i) => <li key={label} className={i === 0 ? "footer-col-head" : undefined}>{label}</li>)}</ul>)}</div>
    </div><Creators lang={lang} /><hr />{children && <div className="footer-notes">{children}</div>}<div className="footer-bottom"><p>{L.copyright}</p><p>{L.legal}</p></div>
  </footer>;
}

export function Breadcrumb({ items, children }: { items: string[]; children?: ReactNode }) {
  return (
    <div className="breadcrumb">
      <p>{items.join("   /   ")}</p>
      {children}
    </div>
  );
}
