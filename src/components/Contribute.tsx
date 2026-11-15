import { useMemo, useState } from "react";
import { contributionsEnabled, saveDemoContribution, submitGameSession } from "../community/client.ts";
import { sessionPayload } from "../community/payload.ts";
import type { Session, SessionState } from "../engine/session.ts";
import { CC } from "../game.ts";
import type { Lang, Strings } from "../i18n/index.ts";
import { Captcha, useContributor } from "./ContributorAuth.tsx";
import { CONTRIBUTION } from "../i18n/contribution.ts";
export { AddBookScreen } from "./DemoBookForm.tsx";

export function ShareAnswers({ session, state, t, lang }: { session: Session; state: SessionState; t: Strings; lang: Lang }) {
  const [status, setStatus] = useState<"ask" | "sending" | "sent" | "declined" | "error">("ask");
  const [savedMessage, setSavedMessage] = useState(t.shared);
  const who = useContributor();
  const payload = useMemo(() => sessionPayload(CC, session, state), [session, state]);
  if (!contributionsEnabled || !payload) return null;
  if (status === "declined") return null;

  const send = async () => {
    setStatus("sending");
    try {
      if (state.action.kind === "found" && (state.action.book.id.startsWith("demo-book:") || payload.answers.some((answer) => answer.question_id.startsWith("demo-q:")))) {
        const book = state.action.book;
        const scope = await saveDemoContribution({ id: crypto.randomUUID(), catalog_version: CC.catalog.catalog_version,
          book_id: book.id, title: book.title_en, author: book.author, notes: "", answers: payload.answers, questions: [] }, who.captchaToken ?? undefined);
        setSavedMessage(scope === "shared" ? CONTRIBUTION[lang].shared : CONTRIBUTION[lang].local);
      } else {
        await who.signIn();
        await submitGameSession(payload);
      }
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  };
  return (
    <div className="card share-card" aria-live="polite">
      {status === "sent" ? (
        <p className="share-done">{savedMessage}</p>
      ) : (
        <>
          <p className="share-q">{t.shareAnswersQ}</p>
          <p className="share-help">{t.sendAnswersHelp}</p>
          {who.needsCaptcha && <Captcha onToken={who.setToken} lang={lang} />}
          {status === "error" && <p className="form-error">{t.sendFailed}</p>}
          <div className="share-actions">
            <button type="button" className="btn btn-primary" onClick={send} disabled={!who.ready || status === "sending"}>
              {status === "sending" ? t.sending : t.shareAnswersYes}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setStatus("declined")}>
              {t.shareAnswersNo}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
