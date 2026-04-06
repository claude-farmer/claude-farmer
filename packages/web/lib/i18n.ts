import type { Locale } from '@claude-farmer/shared';
export type { Locale };

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

    // Landing - Live farms
    liveFarmsTitle: 'Live Farms',
    liveFarmsDesc: 'Real farms from real developers — visit them!',
    statsFarmers: 'Farmers',
    statsItems: 'Items',
    statsAutoGrow: 'Auto Grow',

    // Farm page
    demoMode: 'Demo Mode',
    demoBanner: 'This is a real farm! Login to grow your own.',
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

    // Evolution
    bagDuplicates: '×{count}',
    bagMaxEvolution: 'MAX',
    bagNextEvolution: '{needed} more to next ★',

    // Explore view
    exploreTitle: 'Explore',
    myNeighborsLabel: 'Neighbors',
    myNeighbors: 'Bookmarks',
    noNeighbors: 'No neighbors yet.\nDiscover farms with Random Visit!',
    randomVisit: 'Random Farm Visit',
    searching: 'Searching...',
    discoveredFarms: 'Discovered Farms',
    searchPlaceholder: 'Search by GitHub ID or nickname',
    searchBtn: 'Search',
    searchResults: 'Search Results',
    searchNoResults: 'No farmers found.',
    searchMinChars: 'Enter at least 2 characters.',

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

    // Guestbook
    guestbookTitle: 'Guestbook',
    guestbookTotalWater: 'Total water',
    guestbookEmpty: 'No visitors yet. Be the first!',
    guestbookJustNow: 'just now',
    guestbookMinAgo: 'm ago',
    guestbookHourAgo: 'h ago',
    guestbookDayAgo: 'd ago',

    // Gift
    giftBtn: 'Gift',
    giftPickerTitle: 'Send a Gift',
    giftPickerEmpty: 'No items to gift. Harvest more!',
    giftSent: 'Gift sent!',

    // Wave surf
    waveSurfBtn: 'Wave Surf — visit their neighbor!',
    waveSurfEmpty: 'This farmer has no neighbors yet.',

    // Visitor counter
    todayVisitors: 'Today',
    todayVisitorUnit: '',

    // Promo link
    promoLinkPlaceholder: 'https://...',
    allVisitors: 'Visitors',

    // Character editor
    charEditorTitle: 'Customize Character',
    charType: 'Type',
    charHairStyle: 'Hair',
    charHairColor: 'Hair Color',
    charSkinTone: 'Skin',
    charEyeStyle: 'Eyes',
    charAccessory: 'Accessory',
    charClothes: 'Clothes',
    charSave: 'Save',
    charCancel: 'Cancel',
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

    // Landing - Live farms
    liveFarmsTitle: '실시간 농장',
    liveFarmsDesc: '실제 개발자들의 농장이에요 — 놀러가보세요!',
    statsFarmers: '농부',
    statsItems: '아이템',
    statsAutoGrow: '자동 성장',

    demoMode: '데모 모드',
    demoBanner: '실제 농장이에요! 로그인해서 나만의 농장을 키워보세요.',
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

    // Evolution
    bagDuplicates: '×{count}',
    bagMaxEvolution: 'MAX',
    bagNextEvolution: '다음 ★까지 {needed}개',

    exploreTitle: '탐험',
    myNeighborsLabel: '이웃',
    myNeighbors: '북마크',
    noNeighbors: '아직 이웃이 없어요.\n랜덤 방문으로 농장을 구경해보세요!',
    randomVisit: '랜덤 농장 방문',
    searching: '찾는 중...',
    discoveredFarms: '발견한 농장',
    searchPlaceholder: 'GitHub ID 또는 닉네임으로 검색',
    searchBtn: '검색',
    searchResults: '검색 결과',
    searchNoResults: '농부를 찾지 못했어요.',
    searchMinChars: '2자 이상 입력해주세요.',

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

    // Guestbook
    guestbookTitle: '방명록',
    guestbookTotalWater: '총 받은 물',
    guestbookEmpty: '아직 방문자가 없어요. 첫 번째 손님이 되어보세요!',
    guestbookJustNow: '방금',
    guestbookMinAgo: '분 전',
    guestbookHourAgo: '시간 전',
    guestbookDayAgo: '일 전',

    // Gift
    giftBtn: '선물',
    giftPickerTitle: '선물 보내기',
    giftPickerEmpty: '선물할 아이템이 없어요. 더 수확해보세요!',
    giftSent: '선물 완료!',

    // Wave surf
    waveSurfBtn: '파도타기 — 이웃 농장으로!',
    waveSurfEmpty: '이 농부는 아직 이웃이 없어요.',

    // Visitor counter
    todayVisitors: '오늘',
    todayVisitorUnit: '명',

    // Promo link
    promoLinkPlaceholder: 'https://...',
    allVisitors: '방문자',

    // Character editor
    charEditorTitle: '캐릭터 꾸미기',
    charType: '유형',
    charHairStyle: '헤어',
    charHairColor: '머리 색',
    charSkinTone: '피부',
    charEyeStyle: '눈',
    charAccessory: '악세서리',
    charClothes: '의상',
    charSave: '저장',
    charCancel: '취소',
  },
} as const;

export type Dict = Record<keyof typeof dict['en'], string>;

export function getDict(locale: Locale): Dict {
  return dict[locale] as Dict;
}
