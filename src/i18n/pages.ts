// Wording for the library pages (자료 찾기, 책 상세, 리더보드, 프로그램, 이용 안내, 도서관 소개).
// The library is FICTIONAL: a "Sea Library" on Pohang's Yeongildae beach, made up for this hackathon demo.
import type { Lang } from "./index.ts";

export const TAG_LABEL: Record<Lang, Record<string, string>> = {
  ko: {
    fantasy: "판타지", sf: "SF·미래", mystery: "미스터리·범죄", romance: "로맨스", coming_of_age: "성장", war: "전쟁",
    dystopia: "디스토피아", horror: "긴장·공포", humor: "유머", sea: "바다", family: "가족", friendship: "우정",
    journey: "여행·모험", survival: "생존", school: "학교", classic_era: "1900년 이전 배경", animals: "말하는 동물",
    loneliness: "고독", grief: "상실", philosophy: "철학적", korean: "한국 소설", japanese: "일본 소설", series: "시리즈",
  },
  en: {
    fantasy: "Fantasy", sf: "SF & future", mystery: "Mystery & crime", romance: "Romance", coming_of_age: "Coming of age",
    war: "War", dystopia: "Dystopia", horror: "Suspense & fear", humor: "Humor", sea: "The sea", family: "Family",
    friendship: "Friendship", journey: "Journey", survival: "Survival", school: "School", classic_era: "Set before 1900",
    animals: "Talking animals", loneliness: "Solitude", grief: "Loss", philosophy: "Philosophical", korean: "Korean novel",
    japanese: "Japanese novel", series: "Series",
  },
};

/** Mood words for a book page, from the same derived tags. */
export const MOOD_WORD: Record<Lang, Record<string, string>> = {
  ko: { horror: "으스스한", humor: "유쾌한", loneliness: "고독한", grief: "애틋한", philosophy: "사색적인", friendship: "따뜻한",
    survival: "긴장감 넘치는", dystopia: "암울한", romance: "설레는", fantasy: "신비로운", sea: "짠 바닷바람 같은", journey: "멀리 떠나는",
    coming_of_age: "풋풋한", war: "무거운", mystery: "수수께끼 같은" },
  en: { horror: "eerie", humor: "playful", loneliness: "solitary", grief: "bittersweet", philosophy: "reflective", friendship: "warm",
    survival: "tense", dystopia: "bleak", romance: "tender", fantasy: "enchanted", sea: "salt-aired", journey: "far-reaching",
    coming_of_age: "youthful", war: "heavy", mystery: "puzzling" },
};

const ko = {
  // catalog
  catEyebrow: "CATALOG",
  catTitle: "자료 찾기",
  catLead: (n: number, playable: number) => `북키네이터가 배운 소설 ${n}권이에요. 그중 ${playable}권은 지금 질문으로 찾을 수 있어요.`,
  catSearchLabel: "제목·작가 검색",
  catSearchPlaceholder: "예) 해리 포터, 오웰, 1984",
  catSearch: "검색",
  catTags: "태그",
  catAllTags: "전체",
  catStatus: "상태",
  catStatusAll: "모든 책",
  catStatusPlayable: "북키네이터로 찾을 수 있는 책",
  catStatusCandidate: "준비 중인 책",
  catSort: "정렬",
  catSortRank: "인기순",
  catSortTitle: "제목순",
  catResults: (n: number, from: number, to: number) => (n ? `${n}권 중 ${from}–${to}` : "맞는 책이 없어요"),
  catEmpty: "검색어나 태그를 바꿔 보세요. 그래도 없다면 북키네이터에게 기억을 들려주세요.",
  catPrev: "이전",
  catNext: "다음",
  catPage: (n: number) => `${n}쪽`,
  catTagNote: "태그는 각 책의 라벨에서 자동으로 뽑았어요 (사람이 검토하기 전).",
  statusPlayable: "북키네이터로 찾을 수 있어요",
  statusSeries: (s: string) => `‘${s}’ 시리즈로 찾을 수 있어요`,
  statusCandidate: "아직 준비 중이에요",
  rankBadge: (r: number) => `인기 ${r}위`,
  // book page
  bookBack: "자료 찾기로",
  bookAuthor: "작가",
  bookYear: "발표",
  bookLang: "원어",
  bookRank: "인기 순위",
  bookStatus: "북키네이터",
  bookStory: "줄거리",
  bookStoryNone: "이 책의 소개 글을 불러오지 못했어요. 아래 도서관 목록에서 확인해 주세요.",
  bookMood: "이 책의 분위기",
  bookMoodLead: "라벨에서 읽어 낸 분위기와, 제목으로 찾은 사진이에요.",
  bookMoodNone: "아직 분위기를 말할 만큼 라벨이 모이지 않았어요.",
  bookFacts: "이런 책이에요",
  bookFactsLead: "북키네이터가 이 책에 대해 알고 있는 것 중 일부예요.",
  bookFactsNone: "아직 게임에서 쓸 라벨이 없어요. 라벨이 모이면 북키네이터로도 찾을 수 있게 돼요.",
  bookYes: "예",
  bookNo: "아니요",
  bookPlay: "이 책을 떠올리며 북키네이터 하기",
  bookFind: "도서관에서 찾기",
  bookWikipedia: "위키백과 문서",
  bookNotFound: "그런 책을 찾지 못했어요.",
  bookSeriesNote: (s: string) => `이 책은 ‘${s}’ 시리즈로 묶여 있어서, 아래 정보는 시리즈 전체 기준이에요.`,
  // home: famous books
  famousEyebrow: "MOST LOVED",
  famousTitle: "가장 많이 사랑받은 소설",
  famousLead: "goodbooks-10k 평점 수 기준 인기 순위예요. 눌러서 자세히 보세요.",
  famousMore: "자료 찾기에서 더 보기",
  famousOpen: "자세히 보기",
  // leaderboard page
  lbPageTitle: "리더보드",
  lbPageLead: "독자들이 북키네이터로 찾아낸 책과, 지금 도서관에서 많이 빌리는 책을 모았어요.",
  lbPopularTitle: "역대 인기 소설 20",
  lbPopularLead: "goodbooks-10k 평점 수 기준이에요.",
  // programs
  progLead: "바다가 보이는 창가 열람실과 해변 데크에서 열리는 프로그램이에요.",
  progPlace: "장소",
  progWhen: "일시",
  progWho: "대상",
  progSeats: "정원",
  progDemo: "데모 도서관이라 실제 신청은 받지 않아요.",
  // guide
  guideTitle: "이용 안내",
  guideLead: "포항 영일대 해변 끝, 파도 소리가 들리는 도서관이에요.",
  // about
  aboutTitle: "도서관 소개",
  fictional: "이 도서관은 2026 IST-TECH IT Arena 해커톤을 위해 만든 가상의 도서관이에요. 주소·전화·일정은 실제가 아니에요.",
};

export type PageStrings = typeof ko;

const en: PageStrings = {
  catEyebrow: "CATALOG",
  catTitle: "Catalog",
  catLead: (n, playable) => `The ${n} novels Bookinator learned from. ${playable} of them can already be found by answering questions.`,
  catSearchLabel: "Search by title or author",
  catSearchPlaceholder: "e.g. Harry Potter, Orwell, 1984",
  catSearch: "Search",
  catTags: "Tags",
  catAllTags: "All",
  catStatus: "Status",
  catStatusAll: "All books",
  catStatusPlayable: "Findable with Bookinator",
  catStatusCandidate: "Coming soon",
  catSort: "Sort",
  catSortRank: "Most popular",
  catSortTitle: "Title",
  catResults: (n, from, to) => (n ? `${from}–${to} of ${n}` : "No books match"),
  catEmpty: "Try other words or tags. Still nothing? Tell Bookinator what you remember.",
  catPrev: "Previous",
  catNext: "Next",
  catPage: (n) => `Page ${n}`,
  catTagNote: "Tags are derived automatically from each book’s labels (not yet reviewed by a person).",
  statusPlayable: "Findable with Bookinator",
  statusSeries: (s) => `Findable through the ${s} series`,
  statusCandidate: "Coming soon",
  rankBadge: (r) => `#${r} most popular`,
  bookBack: "Back to the catalog",
  bookAuthor: "Author",
  bookYear: "Published",
  bookLang: "Original language",
  bookRank: "Popularity",
  bookStatus: "Bookinator",
  bookStory: "Story",
  bookStoryNone: "We couldn’t load a description of this book. Please check the library catalog below.",
  bookMood: "The mood of this book",
  bookMoodLead: "The mood read from its labels, and a photo found by its title.",
  bookMoodNone: "Not enough labels yet to describe its mood.",
  bookFacts: "What this book is like",
  bookFactsLead: "Some of what Bookinator knows about it.",
  bookFactsNone: "No game labels yet. Once they are gathered, Bookinator will be able to find it too.",
  bookYes: "Yes",
  bookNo: "No",
  bookPlay: "Think of this book and play Bookinator",
  bookFind: "Find it in a library",
  bookWikipedia: "Wikipedia article",
  bookNotFound: "We couldn’t find that book.",
  bookSeriesNote: (s) => `This book belongs to the ${s} series, so the details below describe the whole series.`,
  famousEyebrow: "MOST LOVED",
  famousTitle: "The most loved novels",
  famousLead: "Ranked by number of ratings on goodbooks-10k. Tap one to learn more.",
  famousMore: "See more in the catalog",
  famousOpen: "Learn more",
  lbPageTitle: "Leaderboard",
  lbPageLead: "Books readers found with Bookinator, and what libraries are lending most right now.",
  lbPopularTitle: "Top 20 most popular novels",
  lbPopularLead: "By number of ratings on goodbooks-10k.",
  progLead: "Programs in the window reading room and on the beach deck, with the sea in view.",
  progPlace: "Where",
  progWhen: "When",
  progWho: "For",
  progSeats: "Seats",
  progDemo: "This is a demo library, so registrations are not taken.",
  guideTitle: "Visit",
  guideLead: "At the end of Yeongildae Beach in Pohang, within earshot of the waves.",
  aboutTitle: "About",
  fictional: "This library is fictional, made for the 2026 IST-TECH IT Arena hackathon. Its address, phone number and events are not real.",
};

export const PAGES_TEXT: Record<Lang, PageStrings> = { ko, en };

/** Long-form content of the fictional library (guide + about + programs). */
export interface ProgramDetail { title: string; date: string; place: string; audience: string; seats: string; description: string }
export interface GuideSection { title: string; rows: [string, string][] }

export const LIBRARY_CONTENT: Record<Lang, {
  programs: ProgramDetail[];
  guide: GuideSection[];
  faq: [string, string][];
  aboutLead: string[];
  floors: [string, string][];
  credits: string[];
}> = {
  ko: {
    programs: [
      { title: "북키네이터 처음 쓰는 법", date: "2026년 11월 21일 (토) 14:00–15:00", place: "1층 바다 열람실", audience: "모두", seats: "20명",
        description: "기억만으로 책을 찾는 요령을 사서와 함께 알아봐요. ‘모르겠어요’를 언제 고르면 좋은지, 중간 점검에서 ‘아니요’를 눌렀을 때 무슨 일이 생기는지까지 다뤄요." },
      { title: "파도 소리 낭독회", date: "2026년 11월 22일 (일) 16:30–17:30", place: "옥상 해변 데크 (우천 시 3층 창가 열람실)", audience: "성인", seats: "30명",
        description: "해 질 무렵 데크에 모여 바다가 나오는 소설의 한 대목을 돌아가며 소리 내어 읽어요. 『노인과 바다』, 『모비 딕』 등을 준비해 둘게요." },
      { title: "수능 문학 다시 읽기", date: "2026년 11월 25일 (수) 19:00–21:00", place: "3층 창가 열람실", audience: "청소년", seats: "15명",
        description: "시험지 속 한 장면으로만 만났던 소설을 처음부터 끝까지 함께 읽어요. 이번 달은 『메밀꽃 필 무렵』과 『삼대』예요." },
      { title: "어린이 바다 그림책 시간", date: "2026년 11월 28일 (토) 11:00–12:00", place: "2층 어린이 갯벌방", audience: "어린이 (5–9세)와 보호자", seats: "12가족",
        description: "바다 동물이 나오는 그림책을 읽고, 해변에서 주워 온 조개껍데기로 책갈피를 만들어요." },
      { title: "기억 속 그 책 찾기 상담", date: "매주 토요일 10:00–12:00", place: "1층 안내 데스크", audience: "모두", seats: "예약 없이",
        description: "북키네이터로도 못 찾은 책이 있다면 사서에게 기억을 들려주세요. 찾은 책은 다음 사람을 위해 북키네이터 서가에 등록해요." },
      { title: "겨울 바다 필사 모임", date: "2026년 12월 5일 (토) 14:00–16:00", place: "3층 창가 열람실", audience: "성인", seats: "12명",
        description: "창밖 겨울 바다를 보며 좋아하는 문장을 천천히 옮겨 적어요. 만년필과 원고지는 도서관에서 빌려 드려요." },
    ],
    guide: [
      { title: "운영 시간", rows: [["바다 열람실 · 자료실", "화–일 09:00–21:00"], ["어린이 갯벌방", "화–일 09:00–18:00"], ["옥상 해변 데크", "화–일 10:00–일몰 (기상 악화 시 닫아요)"], ["휴관일", "매주 월요일, 1월 1일, 설·추석 당일"]] },
      { title: "대출 · 반납", rows: [["대출 권수", "1인 7권 (어린이 5권)"], ["대출 기간", "14일, 1회 7일 연장"], ["반납", "1층 반납대 또는 해변 산책로 무인 반납함 (24시간)"], ["상호대차", "포항 시내 공공도서관 책을 받아 볼 수 있어요 (2–4일)"]] },
      { title: "회원증 발급", rows: [["준비물", "신분증 (어린이는 보호자 신분증)"], ["온라인 신청", "신청 후 1층 안내 데스크에서 바로 받아요"], ["모바일 회원증", "도서관 앱에서 발급 (데모에서는 준비 중)"]] },
      { title: "오시는 길", rows: [["주소", "경북 포항시 북구 영일대 해변 산책로 끝 (가상 주소)"], ["버스", "영일대 해수욕장 정류장에서 걸어서 5분"], ["주차", "해변 공영주차장 이용 (도서관 이용 시 2시간 무료)"], ["문의", "054-000-0000 (데모)"]] },
    ],
    faq: [
      ["제목이 전혀 기억나지 않아도 찾을 수 있나요?", "네. 북키네이터는 제목 대신 줄거리·인물·배경에 대한 질문으로 찾아요. 모르는 질문은 ‘모르겠어요’를 골라도 괜찮아요."],
      ["북키네이터가 틀리면 어떻게 하나요?", "‘아니에요’를 누르면 그 책을 빼고 질문을 이어 가요. 끝내 못 찾으면 새 책 등록을 요청할 수 있어요."],
      ["제 답변이 저장되나요?", "게임이 끝난 뒤 직접 ‘보내기’를 누른 경우에만 답변이 익명으로 저장돼요. 이름이나 연락처는 받지 않아요."],
      ["찾은 책을 바로 빌릴 수 있나요?", "책 정보 화면의 도서관 목록 링크에서 소장 여부를 확인해 주세요. 소장·대출 조회 연동은 준비 중이에요."],
    ],
    aboutLead: [
      "바다 도서관은 포항 영일대 해변이 끝나는 곳에 서 있는, 파도 소리가 들리는 작은 공공도서관이에요.",
      "“제목은 기억 안 나는데, 바다가 나오는 그 책 있잖아요.” 안내 데스크에서 가장 자주 듣는 이 말에서 북키네이터가 시작됐어요. 기억의 조각을 질문으로 바꿔, 서가 사이에서 그 책을 찾아 드려요.",
    ],
    floors: [
      ["1층 바다 열람실", "통창 너머로 영일만이 보이는 일반 열람실과 안내 데스크, 북키네이터 체험석"],
      ["2층 어린이 갯벌방", "바다 그림책과 동화, 신발 벗고 앉는 낮은 서가"],
      ["3층 창가 열람실", "조용한 독서와 필사를 위한 1인석, 문학 자료실"],
      ["옥상 해변 데크", "날씨 좋은 날 열리는 야외 독서 데크와 낭독회 무대"],
    ],
    credits: [
      "줄거리·책 정보: CMU Book Summary Corpus (Bamman & Smith, 2013), 위키백과 (CC BY-SA)",
      "인기 순위: goodbooks-10k (Zygmunt Zając, 2017)",
      "책 정보 링크: Open Library",
      "분위기 사진: Unsplash (사진마다 작가 표시, 책 표지 아님)",
    ],
  },
  en: {
    programs: [
      { title: "Bookinator for beginners", date: "Sat 21 Nov 2026, 14:00–15:00", place: "1F Sea Reading Room", audience: "All ages", seats: "20",
        description: "Learn with a librarian how to find a book from memory alone: when to pick “Not sure”, and what happens when you say “No” at a check-in." },
      { title: "Sound of the Waves reading", date: "Sun 22 Nov 2026, 16:30–17:30", place: "Rooftop beach deck (3F Window Room if it rains)", audience: "Adults", seats: "30",
        description: "At sunset on the deck, take turns reading aloud passages from sea novels. We’ll have The Old Man and the Sea and Moby-Dick ready." },
      { title: "Rereading exam literature", date: "Wed 25 Nov 2026, 19:00–21:00", place: "3F Window Reading Room", audience: "Teens", seats: "15",
        description: "Read, start to finish, the novels you only met as a single excerpt on an exam. This month: When the Buckwheat Blooms and Three Generations." },
      { title: "Seaside picture-book hour", date: "Sat 28 Nov 2026, 11:00–12:00", place: "2F Children’s Tidal Room", audience: "Children (5–9) with a grown-up", seats: "12 families",
        description: "Read picture books about sea creatures, then make bookmarks from shells collected on the beach." },
      { title: "“That book I remember” help desk", date: "Every Saturday, 10:00–12:00", place: "1F Information Desk", audience: "All ages", seats: "Drop in",
        description: "Couldn’t find it even with Bookinator? Tell a librarian what you remember. Books we find are added to Bookinator’s shelves for the next person." },
      { title: "Winter sea copying circle", date: "Sat 5 Dec 2026, 14:00–16:00", place: "3F Window Reading Room", audience: "Adults", seats: "12",
        description: "Copy out favourite sentences slowly by hand, with the winter sea outside. Fountain pens and manuscript paper are on loan." },
    ],
    guide: [
      { title: "Opening hours", rows: [["Sea Reading Room & stacks", "Tue–Sun 9 AM–9 PM"], ["Children’s Tidal Room", "Tue–Sun 9 AM–6 PM"], ["Rooftop beach deck", "Tue–Sun 10 AM–sunset (closed in bad weather)"], ["Closed", "Mondays, 1 January, Seollal and Chuseok days"]] },
      { title: "Borrowing & returns", rows: [["Items", "7 per person (5 for children)"], ["Loan period", "14 days, renewable once for 7 days"], ["Returns", "1F returns desk or the 24-hour drop box on the beach path"], ["Interlibrary loan", "Books from other Pohang public libraries in 2–4 days"]] },
      { title: "Library card", rows: [["Bring", "A photo ID (a guardian’s ID for children)"], ["Apply online", "Then pick it up at the 1F Information Desk"], ["Mobile card", "Through the library app (coming soon in this demo)"]] },
      { title: "Getting here", rows: [["Address", "End of the Yeongildae Beach promenade, Buk-gu, Pohang (fictional)"], ["Bus", "5 minutes’ walk from the Yeongildae Beach stop"], ["Parking", "Public beach car park (2 hours free for library visitors)"], ["Contact", "054-000-0000 (demo)"]] },
    ],
    faq: [
      ["Can I find a book if I don’t remember the title at all?", "Yes. Bookinator asks about the story, characters and setting instead of the title. “Not sure” is always fine."],
      ["What if Bookinator guesses wrong?", "Say “No” and it drops that book and keeps asking. If it still can’t find it, you can ask us to add the book."],
      ["Are my answers stored?", "Only if you press “Send” at the end of a game, and then anonymously. We never ask for your name or contact details."],
      ["Can I borrow the book right away?", "Use the library catalog links on the book page to check holdings. Live availability is coming soon."],
    ],
    aboutLead: [
      "The Sea Library is a small public library where Yeongildae Beach in Pohang ends, close enough to hear the waves.",
      "“I can’t remember the title, but there’s the sea in it…” is what we hear most at the desk. Bookinator grew out of that sentence: it turns fragments of memory into questions and finds the book among the shelves.",
    ],
    floors: [
      ["1F Sea Reading Room", "General reading room facing Yeongil Bay, the information desk and Bookinator seats"],
      ["2F Children’s Tidal Room", "Sea picture books and stories, low shelves to sit by with your shoes off"],
      ["3F Window Reading Room", "Single desks for quiet reading and copying, the literature stacks"],
      ["Rooftop beach deck", "An outdoor reading deck and reading stage, open on fine days"],
    ],
    credits: [
      "Plots and book data: CMU Book Summary Corpus (Bamman & Smith, 2013), Wikipedia (CC BY-SA)",
      "Popularity ranking: goodbooks-10k (Zygmunt Zając, 2017)",
      "Book links: Open Library",
      "Mood photos: Unsplash (credited per photo; not book covers)",
    ],
  },
};
