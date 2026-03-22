export type Locale = 'en' | 'ko';

export function detectLocale(langStr?: string): Locale {
  if (!langStr) return 'en';
  const lower = langStr.toLowerCase();
  if (lower === 'ko' || lower.startsWith('ko-') || lower.startsWith('ko_')) return 'ko';
  return 'en';
}

const dict = {
  en: {
    // ── Common ──
    initFirst: "Please run `claude-farmer init` first.",
    noFarm: "You don't have a farm yet! Run `claude-farmer init` to start.",
    farmOf: "'s farm",

    // ── init ──
    alreadyInit: "Already initialized! Run `claude-farmer` to see your farm.",
    welcomeTitle: "Welcome to Claude Farmer!",
    welcomeDesc: "An idle game where your farm grows as you code.",
    loginMethodPrompt: "Login method [1] GitHub Login (recommended)  [2] Manual input: ",
    githubIdPrompt: "GitHub ID: ",
    githubIdRequired: "Please enter your GitHub ID!",
    nicknamePrompt: "Nickname (shown on your farm): ",
    openingBrowser: "Opening GitHub login in your browser...",
    browserFallback: "If the browser doesn't open, please visit:",
    waitingOAuth: "Complete GitHub login to continue...",
    oauthTimeout: "OAuth timed out (2 min)",
    oauthFailed: "Auth failed:",
    oauthRetry: "Try again with `claude-farmer init`.",
    oauthSuccess: "GitHub login successful:",
    initDone: "Initialization complete!",
    initNickname: "Nickname:",
    initFarmSize: "Farm size: 4×4 (16 slots)",
    initHint: "Your farm grows automatically as you use Claude Code",
    initCheck: "Run `claude-farmer` to see your farm!",
    oauthCallbackTitle: "Auth Complete!",
    oauthCallbackBody: "Go back to your terminal. You can close this window.",
    langHint: "Tip: Set language with `claude-farmer config --lang ko`",

    // ── farm ──
    collection: "Collection:",
    harvests: "harvests",
    waterReceived: "Water received today:",
    streak: "Streak:",
    days: "d",
    morningGreet: "Good morning!",
    afternoonGreet: "Good afternoon!",
    eveningGreet: "Good evening!",
    nightGreet: "Burning the midnight oil!",

    // ── status ──
    currentStatus: "Current status:",
    statusEmpty: 'Status is empty. Set one with `claude-farmer status "message"`!',
    statusSet: "Status set:",

    // ── bag ──
    bagTitle: "Collection",
    bagCollected: "collected",

    // ── open ──
    openingWeb: "Opening claudefarmer.com...",

    // ── water ──
    waterLimitReached: "You've used all your water today. Come back tomorrow!",
    waterUserNotFound: "Can't find @{target}",
    waterServerLimit: "Daily water limit reached. Come back tomorrow!",
    waterSentOffline: "Watered @{target}! (offline mode)",
    waterSent: "Watered @{target}! (remaining: {remaining}/{limit})",

    // ── watch ──
    watchDetecting: "Detecting Claude Code activity... (Ctrl+C to stop)",

    // ── command descriptions ──
    descInit: "Initialize (GitHub login + nickname setup)",
    descStatus: "Set status message bubble",
    descBag: "Collection (collected items list)",
    descOpen: "Open web UI in browser",
    descWater: "Water another user's farm",
    descWatch: "Claude Code detection mode (background)",
    descConfig: "Settings (language, etc.)",

    // ── config ──
    configLangSet: "Language set to: {lang}",
    configCurrent: "Current settings:",
    configLang: "Language:",
    configHelp: "Change language: `claude-farmer config --lang en` or `--lang ko`",

    // ── VSCode Extension ──
    vscodeWelcome: "Welcome! Your farm has been created",
    vscodeHarvest: "Harvest",
    vscodeCollection: "Collection",
    vscodeWater: "Water",
    vscodeStreak: "Streak",
    vscodeOpenFull: "Open Full View",
    vscodeOnboardTitle: "Claude Farmer",
    vscodeOnboardDesc: "An idle game where your farm grows as you code.\nJust code — your farm takes care of itself!",
    vscodeHowSeed: "Write code and seeds are planted automatically",
    vscodeHowGrow: "Keep coding and crops grow",
    vscodeHowHarvest: "Fully grown crops are auto-harvested for gacha items",
    vscodeHowCollect: "Collect 24 items to complete your collection",
    vscodeHowWater: "Visit and water other developers' farms",
    vscodeGetStarted: "Get Started",
    vscodeStep1: 'Click the "GitHub Login" button below.\nA browser window will open.',
    vscodeStep2: "Approve on GitHub and you're done!\nYour farm is created automatically.",
    vscodeStep3: "Now just code.\nYour farm grows on its own",
    vscodeLoginBtn: "Login with GitHub to Start",
    vscodeLoginNote: "You just need a GitHub account.\nOnly your nickname and profile picture are used.",
    vscodeVisitWeb: "Visit Website",
    vscodeLangSetting: 'Language: Settings → "claudeFarmer.language"',
    vscodeNewSeed: "New seed planted!",
    vscodeHarvestDone: "Harvest!",
    vscodeGot: "Got",
  },

  ko: {
    initFirst: "먼저 `claude-farmer init`으로 시작해주세요.",
    noFarm: "아직 농장이 없어요! `claude-farmer init`으로 시작해보세요.",
    farmOf: "의 농장",

    alreadyInit: "이미 초기화되어 있어요! `claude-farmer`로 농장을 확인해보세요.",
    welcomeTitle: "Claude Farmer에 오신 걸 환영해요!",
    welcomeDesc: "코딩하면 농장이 자동으로 자라는 방치형 게임이에요.",
    loginMethodPrompt: "로그인 방법 선택 [1] GitHub 로그인 (추천)  [2] 수동 입력: ",
    githubIdPrompt: "GitHub 아이디: ",
    githubIdRequired: "앗, GitHub 아이디를 입력해주세요!",
    nicknamePrompt: "닉네임 (농장에 표시돼요): ",
    openingBrowser: "브라우저에서 GitHub 로그인 페이지를 여는 중...",
    browserFallback: "브라우저가 열리지 않으면 직접 열어주세요:",
    waitingOAuth: "GitHub 로그인을 완료하면 자동으로 진행됩니다...",
    oauthTimeout: "OAuth 시간 초과 (2분)",
    oauthFailed: "인증 실패:",
    oauthRetry: "`claude-farmer init`으로 다시 시도해보세요.",
    oauthSuccess: "GitHub 로그인 성공:",
    initDone: "초기화 완료!",
    initNickname: "닉네임:",
    initFarmSize: "농장 크기: 4×4 (16칸)",
    initHint: "Claude Code를 사용하면 자동으로 농장이 자라요",
    initCheck: "`claude-farmer`로 농장을 확인해보세요!",
    oauthCallbackTitle: "인증 완료!",
    oauthCallbackBody: "터미널로 돌아가세요. 이 창은 닫아도 됩니다.",
    langHint: "Tip: `claude-farmer config --lang en`으로 언어를 변경할 수 있어요",

    collection: "도감:",
    harvests: "회",
    waterReceived: "오늘 받은 물:",
    streak: "연속:",
    days: "일",
    morningGreet: "좋은 아침이에요!",
    afternoonGreet: "좋은 오후에요!",
    eveningGreet: "수고한 하루에요!",
    nightGreet: "밤 늦게까지 수고해요!",

    currentStatus: "현재 말풍선:",
    statusEmpty: '말풍선이 비어있어요. `claude-farmer status "메세지"` 로 설정해보세요!',
    statusSet: "말풍선 설정:",

    bagTitle: "도감",
    bagCollected: "수집",

    openingWeb: "claudefarmer.com을 열고 있어요...",

    waterLimitReached: "오늘 물 주기를 다 썼어요. 내일 다시 와주세요!",
    waterUserNotFound: "@{target}님을 찾을 수 없어요 🌧️",
    waterServerLimit: "오늘 물 주기를 다 썼어요. 내일 다시 와주세요!",
    waterSentOffline: "@{target}님에게 물을 줬어요! (오프라인 모드)",
    waterSent: "@{target}님에게 물을 줬어요! (남은 횟수: {remaining}/{limit})",

    watchDetecting: "Claude Code 활동을 감지하고 있어요... (Ctrl+C로 종료)",

    descInit: "초기화 (GitHub 로그인 + 닉네임 설정)",
    descStatus: "말풍선 상태 메세지 설정",
    descBag: "도감 (수집한 아이템 목록)",
    descOpen: "웹 UI 브라우저에서 열기",
    descWater: "다른 유저에게 물 주기",
    descWatch: "Claude Code 감지 모드 (백그라운드)",
    descConfig: "설정 (언어 등)",

    configLangSet: "언어 설정 완료: {lang}",
    configCurrent: "현재 설정:",
    configLang: "언어:",
    configHelp: "언어 변경: `claude-farmer config --lang en` 또는 `--lang ko`",

    vscodeWelcome: "환영해요! 농장이 생성되었어요",
    vscodeHarvest: "수확",
    vscodeCollection: "도감",
    vscodeWater: "물",
    vscodeStreak: "연속",
    vscodeOpenFull: "전체 화면 열기",
    vscodeOnboardTitle: "Claude Farmer",
    vscodeOnboardDesc: "코딩하면 농장이 자라는 방치형 게임이에요.\n아무것도 안 해도 돼요, 그냥 코딩만 하세요!",
    vscodeHowSeed: "코드를 작성하면 씨앗이 자동으로 심겨요",
    vscodeHowGrow: "계속 코딩하면 작물이 쑥쑥 자라요",
    vscodeHowHarvest: "다 자라면 자동 수확! 가챠 아이템을 받아요",
    vscodeHowCollect: "24종 아이템을 모아 도감을 완성하세요",
    vscodeHowWater: "다른 개발자 농장에 물도 줄 수 있어요",
    vscodeGetStarted: "시작하기",
    vscodeStep1: '아래 "GitHub 로그인" 버튼을 눌러주세요.\n브라우저가 열려요.',
    vscodeStep2: "GitHub에서 승인을 누르면 끝!\n자동으로 농장이 만들어져요.",
    vscodeStep3: "이제 코딩만 하세요.\n농장은 알아서 자라요",
    vscodeLoginBtn: "GitHub 로그인으로 시작하기",
    vscodeLoginNote: "GitHub 계정만 있으면 돼요.\n개인정보는 닉네임과 프로필 사진만 사용해요.",
    vscodeVisitWeb: "웹사이트에서 구경하기",
    vscodeLangSetting: '언어: 설정 → "claudeFarmer.language"',
    vscodeNewSeed: "새 씨앗을 심었어요!",
    vscodeHarvestDone: "수확!",
    vscodeGot: "획득",
  },
} as const;

export type TranslationKey = keyof typeof dict['en'];
export type Dict = Record<TranslationKey, string>;

export function getDict(locale: Locale): Dict {
  return dict[locale];
}

export function t(locale: Locale, key: TranslationKey, vars?: Record<string, string | number>): string {
  let text: string = dict[locale][key];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}

// Time of day greetings per locale
export function getTimeGreeting(locale: Locale, tod: 'morning' | 'afternoon' | 'evening' | 'night'): string {
  const map: Record<string, TranslationKey> = {
    morning: 'morningGreet',
    afternoon: 'afternoonGreet',
    evening: 'eveningGreet',
    night: 'nightGreet',
  };
  return dict[locale][map[tod]];
}
