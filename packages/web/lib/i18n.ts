export type Locale = 'en' | 'ko';

export function detectLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en';
  const lang = navigator.language || '';
  return lang.startsWith('ko') ? 'ko' : 'en';
}

const dict = {
  en: {
    // Landing - Hero
    heroTagline: 'Your code grows a farm.',
    heroDesc: 'An idle pixel-art farming game powered by Claude Code. Code to plant seeds, grow crops, and collect gacha items!',
    demoBtn: 'Try Demo →',

    // Landing - Features
    feat1Title: 'Auto Growth',
    feat1Desc: 'Just use Claude Code and your farm grows automatically',
    feat2Title: 'Gacha Collection',
    feat2Desc: 'Every harvest triggers gacha! Collect all 24 items',
    feat3Title: 'Social',
    feat3Desc: 'Visit other developers\' farms and water their crops',
    feat4Title: 'Pixel Art',
    feat4Desc: 'Cute 16×16 pixel art with time-based backgrounds',

    // Landing - Steps
    getStarted: 'Get Started',
    step3: 'Use Claude Code and your farm grows automatically!',

    // Landing - Gacha
    gachaTitle: 'Harvest for Gacha!',
    gachaDesc: 'Collect all 24 items',

    // Landing - Subscribe
    subscribeTitle: 'Stay Updated',
    subscribeDesc: 'Get notified about new features and seasonal events',
    subscribeBtn: 'Subscribe',
    subscribeDone: 'Subscribed! We\'ll keep you posted.',
    emailPlaceholder: 'Email address',

    // Footer
    footerLicense: 'MIT License · Built by doribear.com 🇰🇷',
    footerContrib: 'Open source — contributions welcome! Let\'s code something fun together.',

    // Farm page
    demoMode: 'Demo Mode',
    loginBtn: 'Login with GitHub',
    logoutBtn: 'Logout',
    loading: 'Loading farm...',

    // Farm view
    greeting_morning: 'Good morning!',
    greeting_afternoon: 'Good afternoon!',
    greeting_evening: 'Good evening!',
    greeting_night: 'Good night!',
    codex: 'Codex',
    harvests: 'Harvests',
    waterReceived: 'Water',
    streak: 'Streak',
    days: 'd',
    times: '',
    setBubble: 'Set a status message',

    // Bag view
    bagTitle: 'Codex',
    itemNotObtained: 'Not yet obtained',

    // Explore view
    exploreTitle: 'Explore',
    myNeighbors: 'Neighbors (Bookmarks)',
    noNeighbors: 'No neighbors yet.\nDiscover farms with Random Visit!',
    randomVisit: 'Random Farm Visit',
    searching: 'Searching...',
    discoveredFarms: 'Discovered Farms',

    // Visit screen
    visitBack: 'Back',
    visitWater: 'Water',
    visitWaterRemaining: '{remaining}/3',
    visitWaterDone: 'No water left today',
    visitBookmark: 'Bookmark',
    visitBookmarked: 'Bookmarked',
    visitLevel: 'Lv.',

    // Boost
    boostActive: 'BOOST x2 Active!',

    // Level up
    levelUp: 'Level Up!',

    // Tab bar
    tabFarm: 'Farm',
    tabBag: 'Codex',
    tabExplore: 'Explore',
  },
  ko: {
    heroTagline: 'Your code grows a farm.',
    heroDesc: 'Claude Code를 쓰면 농장이 자동으로 자라는 방치형 픽셀아트 농장 게임. 코딩하면 씨앗이 심기고, 대화할수록 자라고, 수확하면 가챠!',
    demoBtn: '데모 보기 →',

    feat1Title: '자동 성장',
    feat1Desc: 'Claude Code를 쓰기만 하면 농장이 자동으로 자라요',
    feat2Title: '가챠 수집',
    feat2Desc: '수확할 때마다 가챠! 24종 아이템 도감을 채워보세요',
    feat3Title: '소셜',
    feat3Desc: '다른 개발자 농장에 놀러가서 물도 줄 수 있어요',
    feat4Title: '픽셀아트',
    feat4Desc: '귀엽고 따뜻한 16×16 픽셀아트. 시간대별 배경 변화',

    getStarted: '시작하기',
    step3: 'Claude Code를 쓰면 자동으로 농장이 자라요!',

    gachaTitle: '수확하면 가챠!',
    gachaDesc: '24종 아이템을 수집해보세요',

    subscribeTitle: '업데이트 소식 받기',
    subscribeDesc: '새 기능, 시즌 이벤트 소식을 보내드려요',
    subscribeBtn: '구독',
    subscribeDone: '구독 완료! 소식을 보내드릴게요.',
    emailPlaceholder: '이메일 주소',

    footerLicense: 'MIT License · Built by doribear.com 🇰🇷',
    footerContrib: '오픈소스 — 함께 즐겁게 코딩해요! 참여 환영합니다.',

    demoMode: '데모 모드',
    loginBtn: 'GitHub 로그인',
    logoutBtn: '로그아웃',
    loading: '농장 불러오는 중...',

    greeting_morning: '좋은 아침이에요!',
    greeting_afternoon: '좋은 오후에요!',
    greeting_evening: '좋은 저녁이에요!',
    greeting_night: '좋은 밤이에요!',
    codex: '도감',
    harvests: '수확',
    waterReceived: '받은 물',
    streak: '연속',
    days: '일',
    times: '회',
    setBubble: '말풍선을 설정해보세요',

    bagTitle: '도감',
    itemNotObtained: '아직 획득하지 못했어요',

    exploreTitle: '탐험',
    myNeighbors: '내 이웃 (북마크)',
    noNeighbors: '아직 이웃이 없어요.\n랜덤 방문으로 농장을 구경해보세요!',
    randomVisit: '랜덤 농장 방문',
    searching: '찾는 중...',
    discoveredFarms: '발견한 농장',

    visitBack: '돌아가기',
    visitWater: '물 주기',
    visitWaterRemaining: '{remaining}/3',
    visitWaterDone: '오늘 물 다 줬어요',
    visitBookmark: '북마크',
    visitBookmarked: '북마크됨',
    visitLevel: 'Lv.',

    boostActive: '부스트 x2 활성!',

    levelUp: '레벨업!',

    tabFarm: '농장',
    tabBag: '도감',
    tabExplore: '탐험',
  },
} as const;

export type Dict = Record<keyof typeof dict['en'], string>;

export function getDict(locale: Locale): Dict {
  return dict[locale] as Dict;
}
