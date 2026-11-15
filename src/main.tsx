import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { fetchDemoContributions, fetchReleaseCatalog, SUPABASE_CONFIG } from "./community/client.ts";
import { DEMO_REMOTE_KEY } from "./community/demo.ts";
import { activeCollectionId, REMOTE_OVERRIDE_KEY, type RemoteCatalogOverride } from "./data/collection.ts";
import { DEFAULT_CONFIG } from "./engine/config.ts";
import { compileCatalog, type Catalog } from "./engine/model.ts";
import "./styles.css";

/**
 * With VITE_CATALOG_SOURCE=supabase, ask the database for the same release the bundle ships and play
 * that copy. Any problem (offline, timeout, missing release, a catalog the engine refuses) falls back
 * to the bundle, so the game never depends on the server.
 */
async function loadRemoteCatalog(): Promise<void> {
  if (SUPABASE_CONFIG.catalogSource !== "supabase") return;
  const collection = activeCollectionId();
  const bundled = (
    collection === "research" ? await import("./data/cmu.catalog.json") : await import("./data/fixture.catalog.json")
  ).default as unknown as Catalog;
  const remote = await fetchReleaseCatalog(bundled.catalog_version);
  if (!remote) return;
  try {
    compileCatalog(remote, DEFAULT_CONFIG.channel, DEFAULT_CONFIG.unknownPYes);
  } catch {
    return;
  }
  const override: RemoteCatalogOverride = { collection, catalog: remote };
  (globalThis as Record<string, unknown>)[REMOTE_OVERRIDE_KEY] = override;
}

async function boot() {
  const root = document.getElementById("root");
  if (!root) throw new Error("Missing #root element");
  await loadRemoteCatalog();
  const bundled = (activeCollectionId() === "research" ? await import("./data/cmu.catalog.json") : await import("./data/fixture.catalog.json")).default;
  (globalThis as Record<string, unknown>)[DEMO_REMOTE_KEY] = await fetchDemoContributions(bundled.catalog_version);
  // Imported only now, so the catalog modules see the override.
  const { default: App } = await import("./App.tsx");
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void boot();
