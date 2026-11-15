import { useEffect, useRef, useState } from "react";
import { contributionsEnabled, ensureSignedIn, isSignedIn, SUPABASE_CONFIG } from "../community/client.ts";
import type { Lang } from "../i18n/index.ts";

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let turnstileScript: Promise<void> | null = null;
function loadTurnstile(): Promise<void> {
  turnstileScript ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("captcha script failed to load"));
    document.head.appendChild(s);
  });
  return turnstileScript;
}

export function Captcha({ onToken, lang }: { onToken: (t: string | null) => void; lang: Lang }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let id: string | null = null;
    let cancelled = false;
    loadTurnstile()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        id = window.turnstile.render(ref.current, {
          sitekey: SUPABASE_CONFIG.turnstileSiteKey,
          language: lang,
          callback: (token: string) => onToken(token),
          "expired-callback": () => onToken(null),
          "error-callback": () => onToken(null),
        });
      })
      .catch(() => onToken(null));
    return () => {
      cancelled = true;
      if (id && window.turnstile) window.turnstile.remove(id);
    };
  }, [onToken, lang]);
  return <div ref={ref} className="captcha" />;
}

/** Whether a CAPTCHA token is still needed before the first anonymous sign-in. */
export function useContributor() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    if (!contributionsEnabled) return;
    isSignedIn().then(setSignedIn, () => setSignedIn(false));
  }, []);
  const needsCaptcha = Boolean(SUPABASE_CONFIG.turnstileSiteKey) && signedIn === false;
  return {
    needsCaptcha,
    captchaToken: token,
    ready: contributionsEnabled && signedIn !== null && (!needsCaptcha || token !== null),
    setToken,
    signIn: async () => {
      await ensureSignedIn(token ?? undefined);
      setSignedIn(true);
    },
  };
}

