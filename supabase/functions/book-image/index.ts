// Bookinator — looks up one Unsplash photo for a book title, keeping the Unsplash key server-side.
// GET /functions/v1/book-image?q=<title>   ->   { image: {...} | null }
// Public on purpose (the site's publishable key is not a JWT): limited to known origins, short
// queries and one result, and answers are cacheable for a day. Any failure returns image: null.
// Deployed with verify_jwt = false; secret UNSPLASH_API_ACCESS_KEY is set in the Supabase dashboard.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ALLOWED = [
  /^https:\/\/wiseshrestha\.github\.io$/,
  /^https:\/\/queso-gato1355\.github\.io$/,
  // Vercel deployments of the fork (production and preview URLs)
  /^https:\/\/[a-z0-9-]+\.vercel\.app$/,
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
];

function cors(origin: string | null): Record<string, string> {
  const ok = origin !== null && ALLOWED.some((r) => r.test(origin));
  return {
    "Access-Control-Allow-Origin": ok ? origin! : "https://wiseshrestha.github.io",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    Vary: "Origin",
  };
}

function json(body: unknown, status: number, headers: Record<string, string>, cache = false): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headers,
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": cache ? "public, max-age=86400" : "no-store",
    },
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  const headers = cors(origin);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "GET") return json({ error: "method not allowed" }, 405, headers);
  if (origin !== null && !ALLOWED.some((r) => r.test(origin))) return json({ error: "origin not allowed" }, 403, headers);

  const q = (new URL(req.url).searchParams.get("q") ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  if (q.length < 2 || q.length > 80) return json({ error: "q must be 2-80 characters" }, 400, headers);

  const key = Deno.env.get("UNSPLASH_API_ACCESS_KEY");
  if (!key) return json({ image: null, reason: "not_configured" }, 200, headers);

  try {
    const api = new URL("https://api.unsplash.com/search/photos");
    api.searchParams.set("query", q);
    api.searchParams.set("per_page", "1");
    api.searchParams.set("orientation", "landscape");
    api.searchParams.set("content_filter", "high");
    const res = await fetch(api, {
      headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return json({ image: null, reason: `unsplash_${res.status}` }, 200, headers);
    const data = await res.json();
    const p = data?.results?.[0];
    if (!p?.urls?.small) return json({ image: null, reason: "no_result" }, 200, headers, true);
    const utm = "?utm_source=bookinator&utm_medium=referral";
    return json(
      {
        image: {
          url: String(p.urls.small),
          alt: typeof p.alt_description === "string" ? p.alt_description.slice(0, 200) : null,
          photographer: String(p.user?.name ?? "Unsplash").slice(0, 100),
          photographer_url: `https://unsplash.com/@${encodeURIComponent(String(p.user?.username ?? ""))}${utm}`,
          photo_url: `https://unsplash.com/photos/${encodeURIComponent(String(p.id))}${utm}`,
        },
      },
      200,
      headers,
      true,
    );
  } catch {
    return json({ image: null, reason: "unavailable" }, 200, headers);
  }
});
