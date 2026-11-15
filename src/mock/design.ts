// DESIGN SAMPLE DATA — the only place where the Figma file's example content lives.
// None of this is real library data: ranks, counts, trends, opening hours, the librarian's picks and
// the programs are placeholders from the design. Components receive it through props, and the
// leaderboard uses it only while there is no shared game data yet (it then says so on screen).
import type { Lang } from "../i18n/index.ts";

export interface LeaderboardEntry {
  rank: number;
  title: string;
  author: string;
  count: number;
  /** Change against the previous period: a number, "new", or null when unknown. */
  trend: number | "new" | null;
  description?: string;
  avgQuestions?: number;
  imageCaption?: string;
}

export interface CollectionItem {
  title: string;
  author: string;
  genre: string;
  description: string;
  imageCaption: string;
}

export interface ProgramItem {
  date: string;
  audience: string;
  title: string;
  description: string;
}

interface DesignMock {
  hours: string;
  address: string;
  leaderboard: LeaderboardEntry[];
  collection: CollectionItem[];
  programs: ProgramItem[];
}

export const DESIGN_MOCK: Record<Lang, DesignMock> = {
  ko: {
    hours: "오늘 운영 09:00 – 21:00  ·  매주 월요일 휴관",
    address: "포항 영일대 해변 산책로 끝 (가상 도서관)  ·  054-000-0000 (데모)",
    leaderboard: [
      { rank: 1, title: "노인과 바다", author: "어니스트 헤밍웨이 · 1952", count: 412, trend: 1, avgQuestions: 9, imageCaption: "새벽 바다 위 작은 돛배",
        description: "84일 동안 고기를 잡지 못한 늙은 어부가 홀로 먼바다에 나가 거대한 청새치와 사흘 밤낮을 싸운다." },
      { rank: 2, title: "광장", author: "최인훈 · 1960", count: 287, trend: 2 },
      { rank: 3, title: "난장이가 쏘아올린 작은 공", author: "조세희 · 1978", count: 241, trend: 1 },
      { rank: 4, title: "동물농장", author: "조지 오웰 · 1945", count: 198, trend: -1 },
      { rank: 5, title: "삼대", author: "염상섭 · 1931", count: 176, trend: "new" },
      { rank: 6, title: "1984", author: "조지 오웰 · 1949", count: 154, trend: 0 },
      { rank: 7, title: "메밀꽃 필 무렵", author: "이효석 · 1936", count: 133, trend: 3 },
      { rank: 8, title: "데미안", author: "헤르만 헤세 · 1919", count: 120, trend: -2 },
    ],
    collection: [
      { title: "모비 딕", author: "허먼 멜빌 · 1851", genre: "장편소설", imageCaption: "폭풍이 이는 먼바다",
        description: "흰 고래에게 다리를 잃은 에이해브 선장이 복수를 위해 포경선을 몰고 바다 끝까지 쫓는다." },
      { title: "등대로", author: "버지니아 울프 · 1927", genre: "장편소설", imageCaption: "안개 낀 바다 위 등대",
        description: "스코틀랜드 섬의 여름 별장. 등대에 가자던 약속이 십 년의 세월을 건너 이루어진다." },
      { title: "갯마을", author: "오영수 · 1953", genre: "단편소설", imageCaption: "썰물 때의 작은 포구",
        description: "고기잡이 나간 남편을 바다에 잃은 해순이 갯마을을 떠났다가 다시 바다로 돌아온다." },
    ],
    programs: [
      { date: "11월 21일 (토) 14:00", audience: "모두", title: "북키네이터 처음 쓰는 법",
        description: "기억만으로 책을 찾는 요령을 사서와 함께 알아봐요. 답을 모를 때 고르는 법까지 다뤄요." },
      { date: "11월 25일 (수) 19:00", audience: "청소년", title: "수능 문학 다시 읽기",
        description: "시험지 속 한 장면으로만 만났던 소설을 처음부터 끝까지 함께 읽어요." },
      { date: "11월 22일 (일) 16:30", audience: "성인", title: "파도 소리 낭독회",
        description: "바다가 나오는 소설의 한 대목을 창가 열람실에서 소리 내어 읽어요." },
    ],
  },
  en: {
    hours: "Open today 9 AM – 9 PM  ·  Closed Mondays",
    address: "End of Yeongildae Beach, Pohang (fictional library)  ·  054-000-0000 (demo)",
    leaderboard: [
      { rank: 1, title: "The Old Man and the Sea", author: "Ernest Hemingway · 1952", count: 412, trend: 1, avgQuestions: 9, imageCaption: "A small sailboat on the dawn sea",
        description: "After 84 days without a catch, an old fisherman sails out alone and battles a giant marlin for three days and nights." },
      { rank: 2, title: "The Square", author: "Choi In-hun · 1960", count: 287, trend: 2 },
      { rank: 3, title: "The Dwarf", author: "Cho Se-hui · 1978", count: 241, trend: 1 },
      { rank: 4, title: "Animal Farm", author: "George Orwell · 1945", count: 198, trend: -1 },
      { rank: 5, title: "Three Generations", author: "Yom Sang-seop · 1931", count: 176, trend: "new" },
      { rank: 6, title: "1984", author: "George Orwell · 1949", count: 154, trend: 0 },
      { rank: 7, title: "When the Buckwheat Blooms", author: "Lee Hyo-seok · 1936", count: 133, trend: 3 },
      { rank: 8, title: "Demian", author: "Hermann Hesse · 1919", count: 120, trend: -2 },
    ],
    collection: [
      { title: "Moby-Dick", author: "Herman Melville · 1851", genre: "Novel", imageCaption: "A storm rising over the open sea",
        description: "Captain Ahab, who lost a leg to the white whale, drives his whaling ship to the ends of the sea for revenge." },
      { title: "To the Lighthouse", author: "Virginia Woolf · 1927", genre: "Novel", imageCaption: "A lighthouse over a misty sea",
        description: "A summer house on a Scottish isle, where a promised trip to the lighthouse is kept ten years later." },
      { title: "Seaside Village", author: "Oh Yeong-su · 1953", genre: "Short story", imageCaption: "A small harbor at low tide",
        description: "Haesun, who lost her husband to the sea, leaves her fishing village — and finds her way back to the sea." },
    ],
    programs: [
      { date: "Sat 21 Nov, 14:00", audience: "All ages", title: "Bookinator for beginners",
        description: "Learn with a librarian how to find a book from memory alone — including what to pick when you’re unsure." },
      { date: "Wed 25 Nov, 19:00", audience: "Teens", title: "Rereading exam literature",
        description: "Read, start to finish, the novels you only met as a single excerpt on an exam." },
      { date: "Sun 22 Nov, 16:30", audience: "Adults", title: "Sound of the Waves reading",
        description: "Read aloud passages from sea novels in the window reading room." },
    ],
  },
};
