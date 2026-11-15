import { useEffect, useRef, useState } from "react";
import type { CatalogBook } from "../engine/model.ts";
import { catalogLinks } from "../engine/links.ts";
import { LINK_OPTIONS } from "../game.ts";
import { bookTitles, type Lang } from "../i18n/index.ts";
import { HACKATHON } from "../i18n/hackathon.ts";
import { Availability } from "./Availability.tsx";
import { Button, Icon } from "./ui.tsx";

export function LibraryNextStep({ book, lang }: { book: CatalogBook; lang: Lang }) {
  const H = HACKATHON[lang];
  const links = catalogLinks(book, LINK_OPTIONS);
  const local = links.find((link) => link.kind === "local");
  const primary = local ?? links[0];
  const [copyState, setCopyState] = useState<"idle" | "copied" | "manual">("idle");
  const manualRef = useRef<HTMLInputElement>(null);
  const titles = bookTitles(book, lang);
  const details = `${titles.main}${titles.alt ? ` (${titles.alt})` : ""} — ${book.author}${book.first_publication_year ? ` · ${book.first_publication_year}` : ""}`;
  useEffect(() => {
    if (copyState === "manual") { manualRef.current?.focus(); manualRef.current?.select(); }
  }, [copyState]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(details);
      setCopyState("copied");
    } catch {
      setCopyState("manual");
      manualRef.current?.focus(); manualRef.current?.select();
    }
  };
  return <section className="card library-next" aria-labelledby="library-next-title">
    <p className="eyebrow"><Icon name="tileSearch" size={18} />{H.nextChapter}</p>
    <h2 id="library-next-title">{local ? H.localCatalog : H.openLibrary}</h2>
    <p className="hint">{local ? H.localNote : H.openLibraryNote}</p>
    <div className="library-next-actions">
      <Button href={primary.url}>{local ? local.label : H.openLibrary}</Button>
      <Button variant="secondary" arrow={false} onClick={copy}>{H.copyDetails}</Button>
    </div>
    {copyState !== "idle" && <p className="hint" role="status">{copyState === "copied" ? H.copied : H.copyFallback}</p>}
    {copyState === "manual" && <label className="form-field"><span className="sr-only">{H.detailsLabel}</span><input ref={manualRef} readOnly value={details} onFocus={(event) => event.currentTarget.select()} /></label>}
    <Availability book={book} lang={lang} />
  </section>;
}
