// The single place that decides which catalog the app plays.
//
//   research (default) the machine-labelled CMU/research catalog built by `npm run catalog:research`
//                      (only the targets that pass the engine gate; see data/cmu/coverage_report.json)
//   classic            the 10-book DEVELOPMENT FIXTURE (labels from general knowledge, partly source-checked)
//
// Which one: see ./collection.ts. The start screen links between the two. The UI shows a warning banner
// for anything not "production". With VITE_CATALOG_SOURCE=supabase, main.tsx may replace the active
// catalog with the same release loaded from Supabase (get_release_catalog); otherwise the bundle is used.
import type { Catalog } from "../engine/model.ts";
import { activeCollectionId, REMOTE_OVERRIDE_KEY, type CollectionId, type RemoteCatalogOverride } from "./collection.ts";
import cmu from "./cmu.catalog.json";
import fixture from "./fixture.catalog.json";

export type { CollectionId } from "./collection.ts";

export const COLLECTIONS: Record<CollectionId, { catalog: Catalog; label: string; blurb: string }> = {
  research: {
    catalog: cmu as unknown as Catalog,
    label: "Research shelf",
    blurb: `${(cmu as unknown as Catalog).coverage?.titles_reachable ?? (cmu as unknown as Catalog).books.length} books · machine-labelled, unreviewed`,
  },
  classic: {
    catalog: fixture as unknown as Catalog,
    label: "Classic shelf",
    blurb: "10 well-labelled books · most reliable play",
  },
};

export const ACTIVE_COLLECTION: CollectionId = activeCollectionId();

const remote = (globalThis as Record<string, unknown>)[REMOTE_OVERRIDE_KEY] as RemoteCatalogOverride | undefined;

/** "remote" when this page plays a release loaded from Supabase, "bundled" otherwise. */
export const CATALOG_SOURCE: "remote" | "bundled" = remote?.collection === ACTIVE_COLLECTION ? "remote" : "bundled";
export const ACTIVE_CATALOG: Catalog =
  CATALOG_SOURCE === "remote" ? (remote!.catalog as Catalog) : COLLECTIONS[ACTIVE_COLLECTION].catalog;

/** Link that reloads the app on the given collection (keeps the rest of the URL). */
export function collectionHref(id: CollectionId): string {
  const url = new URL((globalThis as { location?: { href: string } }).location?.href ?? "http://localhost/");
  url.searchParams.set("collection", id);
  if (id !== "classic") url.searchParams.delete("demo");
  return url.pathname + url.search;
}
