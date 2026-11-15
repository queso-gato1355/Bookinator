// UI language (Korean / English), following the Bookinator design canvas. The choice is a
// per-viewer convenience kept in localStorage; the default follows the browser language.
import { useCallback, useEffect, useState } from "react";
import type { Answer, CatalogBook, CatalogQuestion } from "../engine/model.ts";
import { QUESTIONS_KO } from "./questionsKo.ts";

export type Lang = "ko" | "en";

const STORAGE_KEY = "bookinator-lang";

function initialLang(): Lang {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "ko" || saved === "en") return saved;
  } catch {
    /* storage unavailable */
  }
  try {
    return navigator.language.toLowerCase().startsWith("ko") ? "ko" : "en";
  } catch {
    return "ko";
  }
}

export function useLang(): [Lang, (l: Lang) => void] {
  const [lang, setLangState] = useState<Lang>(initialLang);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* storage unavailable */
    }
  }, []);
  return [lang, setLang];
}

export const ANSWER_TEXT: Record<Lang, Record<Answer, string>> = {
  ko: { yes: "예", probably: "아마 그럴 거예요", dont_know: "모르겠어요", probably_not: "아마 아닐 거예요", no: "아니요" },
  en: { yes: "Yes", probably: "Probably", dont_know: "Not sure", probably_not: "Probably not", no: "No" },
};

export function questionText(q: CatalogQuestion, lang: Lang): string {
  return lang === "ko" ? QUESTIONS_KO[q.text] ?? q.text : q.text;
}

/** Title in the UI language, with the other title as a secondary line when it differs. */
export function bookTitles(b: CatalogBook, lang: Lang): { main: string; alt: string | null } {
  if (lang === "ko" && b.title_ko) return { main: b.title_ko, alt: b.title_en };
  return { main: b.title_en, alt: b.title_ko && b.title_ko !== b.title_en ? b.title_ko : null };
}

const ko = {
  brand: "북키네이터",
  langGroup: "언어",
  tagline: "소설 한 권을 떠올려 보세요. 북키네이터가 찾아드릴게요.",
  start: "시작하기",
  filmMode: "영화·드라마로 더 기억나요",
  collectionsLabel: "책장 고르기",
  classicShelf: "기본 책장",
  researchShelf: "연구용 책장",
  booksCount: (n: number) => `${n}권`,
  seeShelf: (n: number) => `북키네이터가 아는 책 ${n}권 보기`,
  popularHeading: "독자들이 가장 많이 찾아낸 책",
  libraryPopularHeading: "요즘 도서관에서 많이 빌리는 문학",
  libraryPopularSource: "출처: 도서관 정보나루 · 최근 30일 인기 대출",
  foundBy: (n: number) => `${n}명이 찾았어요`,
  photoNote: "분위기 사진 (책 표지 아님)",
  devData: "개발용 데이터",
  unreviewedData: "검수 전 데이터",
  question: (n: number) => `질문 ${n}`,
  questionOf: (n: number, max: number) => `질문 ${n} / 최대 ${max}`,
  prevQuestion: "이전 질문",
  whatCounts: "무슨 뜻이에요?",
  dontKnowHint: "잘 모르겠으면 ‘몰라’도 괜찮아요. 어떤 책에도 불리하지 않아요.",
  answersGroup: "내 대답",
  myAnswers: (n: number) => `내 대답 ${n}개`,
  notThese: "아니었던 책",
  isThisIt: "혹시 이 책인가요?",
  isThisItAgain: "그럼… 이 책인가요?",
  thatsIt: "맞아!",
  nope: "아니야",
  notInCollection: "여기 없는 책 같아요",
  startOver: "처음부터 다시",
  cover: "표지",
  whyThisBook: "왜 이 책일까요?",
  youSaid: "내 대답",
  catalogSays: "책 정보",
  source: "출처",
  aiChecked: "AI 확인",
  unchecked: "확인 전 정보",
  fromReaders: (n: number) => `독자 ${n}명의 대답 (검수됨)`,
  demoReaderAnswer: "독자가 입력한 데모 답변 · 검수 전",
  shortlistLine: "음… 이 중에 있나요?",
  shortlistReason: {
    rejections: "두 번 틀렸어요. 가장 가까운 책들이에요.",
    question_cap: "질문을 다 썼어요. 가장 가까운 책들이에요.",
    no_questions: "더 물어볼 질문이 없어요. 가장 가까운 책들이에요.",
    low_information: "남은 질문으로는 이 책들을 구별할 수 없어요.",
  },
  thisOne: "이 책이에요",
  noneOfThese: "여기 없어요",
  foundLine: "역시! 찾았어요.",
  foundShortlistLine: "좋아요, 기억해 둘게요.",
  foundAfter: (n: number, viaGuess: boolean) => `${viaGuess ? "맞춘" : "목록에서 고른"} 책 · 질문 ${n}개`,
  findInCatalog: "도서관에서 찾기",
  librarianTip: "정확한 판본과 소장 여부는 도서관 목록에서 확인해 주세요.",
  anotherBook: "다른 책 찾기",
  undo: "되돌리기",
  // contribution
  missedLine: "이런, 못 맞췄네요. 어떤 책이었나요?",
  allRejectedLine: "제가 아는 책은 다 아니었네요. 어떤 책이었나요?",
  title: "제목",
  author: "작가",
  similarExists: "비슷한 책이 이미 있어요",
  tapIfSame: "같은 책이면 눌러 주세요",
  addBook: "책 추가하기",
  playAgain: "다시 하기",
  sendAnswersToo: "이번 게임의 대답도 함께 보내기",
  sendAnswersHelp: "보내면 다음에 이 책을 더 잘 맞출 수 있어요. 대답과 책 정보만 보내고, 이름이나 연락처는 받지 않아요.",
  contributionsOff: "지금은 책 추가 기능이 꺼져 있어요. 대신 도서관 사서에게 기억나는 단서를 알려 주세요.",
  sending: "보내는 중…",
  thanksNew: "책과 답변을 데모에 바로 추가했어요.",
  thanksExisting: "고마워요! 이 책을 더 잘 맞추는 데 쓸게요.",
  thanksNoSend: "이 책을 데모에 추가했어요.",
  duplicateBook: "이미 등록된 책이에요.",
  duplicateSubmission: "누군가 이미 추가를 요청한 책이에요. 대답만 더해 둘게요.",
  confirmNotDuplicate: "비슷한 책이 있어요. 그래도 다른 책이라면 한 번 더 눌러 주세요.",
  sendFailed: "보내지 못했어요. 잠시 뒤에 다시 해 주세요.",
  needTitleAuthor: "제목을 적어 주세요. 작가는 모르면 비워도 돼요.",
  rateLimited: "잠시 동안 너무 많이 보냈어요. 한 시간쯤 뒤에 다시 해 주세요.",
  invalidInput: "입력한 내용을 확인해 주세요. 제목은 300자, 작가는 200자까지예요.",
  inThisShelf: "이 책장에 있는 책",
  submitted: "검토 중인 책",
  shareAnswersQ: "이번 대답을 보내서 북키네이터를 더 똑똑하게 만들까요?",
  shareAnswersYes: "보내기",
  shareAnswersNo: "괜찮아요",
  shared: "보냈어요. 고마워요!",
  footer: (books: number, imported: number | null, version: string, source: string) =>
    `${books}권${imported ? ` (수집 ${imported}권 중)` : ""} · 카탈로그 ${version} · ${source}`,
  sourceBundled: "브라우저에서만 실행",
  sourceRemote: "Supabase에서 불러옴",
};

export type Strings = typeof ko;

const en: Strings = {
  brand: "Bookinator",
  langGroup: "Language",
  tagline: "Think of a novel. Bookinator will find it.",
  start: "Start",
  filmMode: "I mostly remember the film or TV version",
  collectionsLabel: "Choose a shelf",
  classicShelf: "Classic shelf",
  researchShelf: "Research shelf",
  booksCount: (n) => `${n} books`,
  seeShelf: (n) => `See the ${n} books Bookinator knows`,
  popularHeading: "Books readers found most often",
  libraryPopularHeading: "Most borrowed literature in Korean libraries",
  libraryPopularSource: "Source: Data4Library (data4library.kr), loans in the last 30 days",
  foundBy: (n) => `found by ${n}`,
  photoNote: "Mood photo, not the cover",
  devData: "Development data",
  unreviewedData: "Unreviewed data",
  question: (n) => `Question ${n}`,
  questionOf: (n, max) => `Question ${n} of at most ${max}`,
  prevQuestion: "Previous question",
  whatCounts: "What counts?",
  dontKnowHint: "Not sure? “Don’t know” is always fine — it won’t count against any book.",
  answersGroup: "Your answer",
  myAnswers: (n) => `My answers (${n})`,
  notThese: "Not these",
  isThisIt: "Is this your book?",
  isThisItAgain: "Then… is it this one?",
  thatsIt: "That’s it!",
  nope: "Nope",
  notInCollection: "My book isn’t on this shelf",
  startOver: "Start over",
  cover: "Cover",
  whyThisBook: "Why this book",
  youSaid: "You said",
  catalogSays: "Catalog",
  source: "source",
  aiChecked: "AI-checked",
  unchecked: "unchecked label",
  fromReaders: (n) => `${n} readers’ answers (reviewed)`,
  demoReaderAnswer: "Reader-supplied demo answer · not reviewed",
  shortlistLine: "Hmm… is it one of these?",
  shortlistReason: {
    rejections: "Two guesses missed. Here are my closest matches.",
    question_cap: "I’m out of questions. Here are my closest matches.",
    no_questions: "I’ve run out of useful questions. Here are my closest matches.",
    low_information: "My remaining questions can’t tell these apart.",
  },
  thisOne: "This one",
  noneOfThese: "None of these",
  foundLine: "I knew it!",
  foundShortlistLine: "Good pick. I’ll remember it.",
  foundAfter: (n, viaGuess) => `${viaGuess ? "Guessed" : "Picked from the list"} after ${n} question${n === 1 ? "" : "s"}`,
  findInCatalog: "Find it in a library",
  librarianTip: "Check the library’s own catalog for copies and the exact edition.",
  anotherBook: "Find another book",
  undo: "Undo",
  missedLine: "Oops, I couldn’t guess it. Which book was it?",
  allRejectedLine: "It wasn’t any book I know. Which one was it?",
  title: "Title",
  author: "Author",
  similarExists: "A similar book already exists",
  tapIfSame: "Tap it if it’s the same book",
  addBook: "Add this book",
  playAgain: "Play again",
  sendAnswersToo: "Also send my answers from this game",
  sendAnswersHelp: "They help Bookinator find this book next time. Only your answers and the book details are sent — no name or contact details.",
  contributionsOff: "Adding books is switched off right now. A librarian can help with the clues you remember.",
  sending: "Sending…",
  thanksNew: "Your book and answers were added directly to the demo.",
  thanksExisting: "Thank you! This helps Bookinator find that book.",
  thanksNoSend: "This book was added to the demo.",
  duplicateBook: "That book is already on the shelf.",
  duplicateSubmission: "Someone has already suggested that book. Your answers were added to it.",
  confirmNotDuplicate: "There are similar books. If yours is different, press once more.",
  sendFailed: "Couldn’t send that. Please try again in a moment.",
  needTitleAuthor: "Please enter the title. Leave the author blank if you are not sure.",
  rateLimited: "Too many submissions in a short time. Please try again in about an hour.",
  invalidInput: "Please check what you entered. Titles can be up to 300 characters, authors up to 200.",
  inThisShelf: "On this shelf",
  submitted: "Waiting for review",
  shareAnswersQ: "Send your answers to make Bookinator smarter?",
  shareAnswersYes: "Send",
  shareAnswersNo: "No thanks",
  shared: "Sent — thank you!",
  footer: (books, imported, version, source) =>
    `${books} books${imported ? ` (of ${imported} imported)` : ""} · catalog ${version} · ${source}`,
  sourceBundled: "runs entirely in your browser",
  sourceRemote: "loaded from Supabase",
};

export const STRINGS: Record<Lang, Strings> = { ko, en };
