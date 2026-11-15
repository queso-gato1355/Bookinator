// Reusable pieces of the "Sea Library" design (Figma "Components" frame): Header, Mobile Header,
// Footer, Button, Answer, Book Card, Leaderboard Row and Image / Unsplash. Icons are the SVGs
// exported from the design file (src/assets/icons), used as-is.
import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { href, type Page } from "../router.ts";
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
import type { LibraryStrings } from "../i18n/library.ts";

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

/** Loads optional data for a key; null while loading or when unavailable. */
export function useLoaded<T>(load: () => Promise<T | null>, key: string): T | null {
  const [value, setValue] = useState<T | null>(null);
  useEffect(() => {
    let live = true;
    setValue(null);
    load().then((v) => live && setValue(v));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return value;
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
    // In-app hash links open in place; anything else opens in a new tab.
    const external = !href.startsWith("#");
    return (
      <a className={cls} href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
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

export function AnswerButton({ label, selected, onSelect, shortcut }: { label: string; selected: boolean; onSelect: () => void; shortcut?: string }) {
  return (
    <button type="button" className="answer" aria-pressed={selected} aria-keyshortcuts={shortcut} onClick={onSelect}>
      {selected && <Icon name="checkWhite" />}
      <span>{label}</span>
    </button>
  );
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
export function UnsplashImage({ photo, caption, className = "" }: { photo?: Photo | null; caption?: string; className?: string }) {
  return (
    <div className={`photo ${className}`}>
      {photo && <img className="photo-img" src={photo.url} alt={photo.alt ?? ""} loading="lazy" referrerPolicy="no-referrer" />}
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
          <button type="button" className="icon-btn-plain" disabled aria-label={p.saveLabel} title={p.soonLabel}>
            <Icon name="bookmark" size={20} />
          </button>
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
  hours: string;
  onHome: () => void;
  /** The page being shown, for aria-current in the menus. */
  active: Page;
}

/** Main menu: label index in L.nav → page. */
const NAV_PAGES: Page[] = ["home", "catalog", "leaderboard", "programs", "guide", "about"];
/** Footer links, by column and row (row 0 is the column title). */
const FOOTER_PAGES: Page[][] = [["home", "catalog", "leaderboard"], ["about", "programs", "guide"], ["guide", "home", "guide"]];

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

/** A menu entry the demo does not implement: visible as in the design, not a link. */
function Soon({ label, hint }: { label: string; hint: string }) {
  return <span className="soon" title={hint}>{label}</span>;
}

function NavLinks({ L, active }: { L: LibraryStrings; active: Page }) {
  return (
    <>
      {L.nav.map((x, i) => (
        <a key={x} href={href(NAV_PAGES[i])} aria-current={NAV_PAGES[i] === active || (active === "book" && NAV_PAGES[i] === "catalog") ? "page" : undefined}>{x}</a>
      ))}
    </>
  );
}

export function Header({ L, lang, setLang, hours, onHome, active }: HeaderProps) {
  return (
    <header className="header desktop-only">
      <div className="utility">
        <p>{hours}</p>
        <div className="utility-links">
          <Soon label={L.utilLinks[0]} hint={L.comingSoon} />
          <a href={href("guide")}>{L.utilLinks[1]}</a>
          <a href={href("guide")}>{L.utilLinks[2]}</a>
          <LangSwitch L={L} lang={lang} setLang={setLang} />
        </div>
      </div>
      <div className="mainbar">
        <Logo L={L} onHome={onHome} size={24} />
        <nav className="nav" aria-label="Bookinator">
          <NavLinks L={L} active={active} />
        </nav>
        <div className="header-actions">
          <a className="icon-btn" href={href("catalog")} aria-label={L.search}>
            <Icon name="search" size={20} />
          </a>
          <Button variant="secondary" arrow={false} disabled title={L.comingSoon}>{L.login}</Button>
        </div>
      </div>
    </header>
  );
}

export function MobileHeader({ L, lang, setLang, onHome, active }: HeaderProps) {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [active]);
  return (
    <header className="mobile-header mobile-only">
      <div className="mobile-header-bar">
        <Logo L={L} onHome={onHome} size={20} />
        <div className="header-actions">
          <LangSwitch L={L} lang={lang} setLang={setLang} />
          <a className="icon-btn" href={href("catalog")} aria-label={L.search}>
            <Icon name="search" size={20} />
          </a>
          <button type="button" className="icon-btn" aria-label={L.menu} aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen((o) => !o)}>
            <Icon name="menu" size={20} />
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-menu" className="mobile-menu" aria-label="Bookinator">
          <NavLinks L={L} active={active} />
        </nav>
      )}
    </header>
  );
}

/** One footer for both sizes (the Mobile Footer frame has the same content, stacked). */
export function Footer({ L, address, children }: { L: LibraryStrings; address: string; children?: ReactNode }) {
  return (
    <footer className="footer">
      <div className="footer-top">
        <div className="footer-brand">
          <p className="footer-logo">Bookinator</p>
          <p>{L.footerTag}</p>
          <p>{address}</p>
        </div>
        <div className="footer-cols">
          {L.footerCols.map((col, c) => (
            <ul key={col[0]}>
              {col.map((x, i) => (i === 0 ? <li key={x} className="footer-col-head">{x}</li> : <li key={x}><a href={href(FOOTER_PAGES[c][i - 1])}>{x}</a></li>))}
            </ul>
          ))}
        </div>
      </div>
      <hr />
      {children && <div className="footer-notes">{children}</div>}
      <div className="footer-bottom">
        <p>{L.copyright}</p>
        <p>{L.legal}</p>
      </div>
    </footer>
  );
}

/** A plain generated "cover" (no cover images, D7): a colour from the title, the title and author set in type. */
export function GeneratedCover({ title, author, seed, large = false }: { title: string; author: string; seed: string; large?: boolean }) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return (
    <span className={`gen-cover ${large ? "gen-cover-lg" : ""}`} style={{ ["--hue" as string]: (h % 360).toString() }} aria-hidden="true">
      <span className="gen-cover-author">{author}</span>
      <span className="gen-cover-title">{title}</span>
      <span className="gen-cover-mark"><Icon name="waves" size={large ? 24 : 16} /></span>
    </span>
  );
}

export function Breadcrumb({ items, children }: { items: string[]; children?: ReactNode }) {
  return (
    <div className="breadcrumb">
      <p>{items.join("   /   ")}</p>
      {children}
    </div>
  );
}
