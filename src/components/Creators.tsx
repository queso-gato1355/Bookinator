import type { Lang } from "../i18n/index.ts";

const creators = [
  ["Shresth Gupta", "KAIST"],
  ["정영찬 · Jung, Young-chan", "UNIST"],
  ["이준영 · Lee Jun-Yeong", "UNIST"],
  ["Kang, Yeju", "DGIST"],
  ["유주원 · Yoo, Juwon", "GIST"],
];

export function Creators({ lang }: { lang: Lang }) {
  return <section className="about-creators" aria-labelledby="creators-heading">
    <p className="eyebrow">{lang === "ko" ? "ABOUT US · 만든 사람들" : "ABOUT US · THE CREATORS"}</p>
    <h2 id="creators-heading">{lang === "ko" ? "북키네이터 팀을 소개해요" : "The team behind Bookinator"}</h2>
    <p>{lang === "ko" ? "기억 속 이야기를 다시 책으로 이어 주는 도서관 해커톤 프로젝트예요." : "A library hackathon project that helps turn a remembered story back into a book."}</p>
    <ul>{creators.map(([name, university]) => <li key={name}><span>{name}</span><b>{university}</b></li>)}</ul>
  </section>;
}
