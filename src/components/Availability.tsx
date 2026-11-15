import { useState } from "react";
import { availabilityEnabled, checkAvailability, pickEdition, type AvailabilityResult } from "../availability.ts";
import type { CatalogBook } from "../engine/model.ts";
import { AVAILABILITY } from "../game.ts";
import type { Lang } from "../i18n/index.ts";

export function Availability({ book, lang = "en" }: { book: CatalogBook; lang?: Lang }) {
  const [state, setState] = useState<"idle" | "loading" | AvailabilityResult>("idle");
  if (!availabilityEnabled(AVAILABILITY)) return null;
  const edition = pickEdition(book);
  if (!edition) return null;
  const lib = AVAILABILITY.libName || (lang === "ko" ? "도서관" : "the library");
  const A = lang === "ko" ? {
    check: `${lib} 소장 여부 확인`, checking: `${lib} 확인 중…`, held: "소장", notHeld: "미소장", unknown: "확인되지 않음",
    borrow: "대출 가능", notBorrow: "현재 대출 불가", cached: "저장된 결과 시각", checked: "확인 시각",
    note: "도서관 정보는 늦게 갱신될 수 있어요. 방문 전에 확인해 주세요.", failure: "소장 여부를 확인하지 못했어요. 위의 도서 목록 링크를 이용해 주세요.",
  } : {
    check: `Check if ${lib} has it`, checking: `Checking ${lib}…`, held: "Held", notHeld: "Not held", unknown: "Unknown",
    borrow: "Available to borrow", notBorrow: "Not available right now", cached: "Cached result from", checked: "Checked at",
    note: "Library data can lag; confirm before you go.", failure: "We couldn’t check availability. Use the catalog link above instead.",
  };
  const yesNo = (value: boolean | null, yes: string, no: string) => value === null ? A.unknown : value ? yes : no;
  return <div className="availability" aria-live="polite">
    {state === "idle" && <button type="button" onClick={async () => { setState("loading"); setState(await checkAvailability(AVAILABILITY, book)); }}>{A.check}</button>}
    {state === "loading" && <p className="muted">{A.checking}</p>}
    {typeof state === "object" && state.ok && <p>
      <b>{yesNo(state.hasBook, A.held, A.notHeld)}</b> · {yesNo(state.loanAvailable, A.borrow, A.notBorrow)}
      <span className="hint"> — {lib} · ISBN {state.edition.isbn}{state.edition.title ? ` (${state.edition.title})` : ""}. Data4Library · {state.cached ? A.cached : A.checked} {new Date(state.fetchedAt).toLocaleString(lang)}. {A.note}</span>
    </p>}
    {typeof state === "object" && !state.ok && <p className="hint">{A.failure}</p>}
  </div>;
}
