import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Content-Security-Policy for the built site (GitHub Pages cannot send headers, so it is a <meta>).
 * Build only: the dev server needs inline scripts for hot reload. Everything is same-origin except
 * the services the app really calls. frame-ancestors / X-Frame-Options cannot be set from a meta tag.
 */
function csp(env: Record<string, string>): Plugin {
  const origin = (u: string | undefined) => {
    try {
      return u ? new URL(u).origin : null;
    } catch {
      return null;
    }
  };
  const connect = ["'self'", origin(env.VITE_SUPABASE_URL), origin(env.VITE_LIBRARY_PROXY_URL), "https://openlibrary.org", "https://en.wikipedia.org", "https://ko.wikipedia.org"];
  const policy = [
    "default-src 'self'",
    "script-src 'self' https://challenges.cloudflare.com",
    "style-src 'self' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https://images.unsplash.com https://covers.openlibrary.org https://archive.org https://*.archive.org",
    `connect-src ${connect.filter(Boolean).join(" ")}`,
    "frame-src https://challenges.cloudflare.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
  return {
    name: "bookinator-csp",
    apply: "build",
    transformIndexHtml: () => [
      { tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: policy }, injectTo: "head-prepend" },
      { tag: "meta", attrs: { name: "referrer", content: "strict-origin-when-cross-origin" }, injectTo: "head-prepend" },
    ],
  };
}

// Relative base so the built app works from any static host or a local file server.
export default defineConfig(({ mode }) => ({
  plugins: [react(), csp(loadEnv(mode, process.cwd(), "VITE_"))],
  base: "./",
}));
