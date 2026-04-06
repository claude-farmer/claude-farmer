import type { CropType, Rarity, CharacterAppearance } from './types.js';

// ── 농장 설정 ──
export const GRID_SIZE = 16; // 4×4
export const GRID_COLS = 4;
export const GRID_ROWS = 4;
export const GROWTH_STAGES = 4; // 0~3
export const MAX_GROWTH_STAGE = 3;

// ── 작물 목록 ──
export const CROPS: CropType[] = ['carrot', 'tomato', 'sunflower', 'strawberry', 'pumpkin', 'radish'];

export const CROP_EMOJI: Record<CropType, string[]> = {
  carrot:     ['🌰', '🌱', '🌿', '🥕'],
  tomato:     ['🌰', '🌱', '🌿', '🍅'],
  sunflower:  ['🌰', '🌱', '🌿', '🌻'],
  strawberry: ['🌰', '🌱', '🌿', '🍓'],
  pumpkin:    ['🌰', '🌱', '🌿', '🎃'],
  radish:     ['🌰', '🌱', '🌿', '🫚'],
};

export const CROP_NAME_KO: Record<CropType, string> = {
  carrot: '당근',
  tomato: '토마토',
  sunflower: '해바라기',
  strawberry: '딸기',
  pumpkin: '호박',
  radish: '무',
};

// ── 가챠 확률 ──
export const RARITY_WEIGHTS: Record<Rarity, number> = {
  common: 60,
  rare: 28,
  epic: 10,
  legendary: 2,
};

export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#9ca3af',
  rare: '#60a5fa',
  epic: '#a78bfa',
  legendary: '#fbbf24',
};

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};

// ── 부스트 타임 (21시 ~ 6시) ──
export function isBoostTime(hour?: number): boolean {
  const h = hour ?? new Date().getHours();
  return h >= 21 || h < 6;
}

export const BOOST_MULTIPLIER = 2;

// 부스트 시 가챠 확률 보정 (Rare +5%, Epic +2%)
export const BOOST_RARITY_WEIGHTS = {
  common: 53,
  rare: 33,
  epic: 12,
  legendary: 2,
} as const;

// ── 물 주기 ──
export const DAILY_WATER_LIMIT = 3; // legacy, kept for backward compat
export const WATER_COOLDOWN_SECONDS = 300; // 5 minutes between water actions
export const GUESTBOOK_MAX_ENTRIES = 100;

// ── 경로 ──
export const DATA_DIR = '.claude-farmer';
export const STATE_FILE = 'state.json';
export const ACTIVITY_FILE = 'activity.json';

// ── 날씨 ──
export type FarmWeather = 'clear' | 'rain' | 'snow' | 'fog' | 'aurora';

export function getFarmWeather(userId: string, date?: string): FarmWeather {
  const dateStr = date ?? new Date().toISOString().slice(0, 10);
  // 결정론적 해시: 같은 userId+date = 같은 날씨
  let hash = 0;
  const seed = userId + dateStr;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const roll = Math.abs(hash) % 100;
  // clear(70%), rain(15%), snow(8%), fog(5%), aurora(2%)
  if (roll < 2) return 'aurora';
  if (roll < 7) return 'fog';
  if (roll < 15) return 'snow';
  if (roll < 30) return 'rain';
  return 'clear';
}

// ── 시간대 ──
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export function getTimeOfDay(hour: number): TimeOfDay {
  if (hour >= 6 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

export const TIME_GREETING: Record<TimeOfDay, string> = {
  morning: '좋은 아침이에요!',
  afternoon: '좋은 오후에요!',
  evening: '수고한 하루에요!',
  night: '밤 늦게까지 수고해요!',
};

export const TIME_EMOJI: Record<TimeOfDay, string> = {
  morning: '🌅',
  afternoon: '☀️',
  evening: '🌇',
  night: '🌙',
};

// ── 농부 칭호 (활동량 기반) ──
export type FarmerTitle = {
  emoji: string;
  en: string;
  ko: string;
};

const FARMER_TITLES: { min: number; title: FarmerTitle }[] = [
  { min: 10000, title: { emoji: '⚡', en: 'Legendary Farmer', ko: '전설의 농부' } },
  { min: 5000,  title: { emoji: '🔥', en: 'Blazing Farmer', ko: '열혈 농부' } },
  { min: 2000,  title: { emoji: '🧑‍🌾', en: 'Diligent Farmer', ko: '부지런한 농부' } },
  { min: 500,   title: { emoji: '🌱', en: 'Strolling Farmer', ko: '산책하는 농부' } },
  { min: 0,     title: { emoji: '😴', en: 'Resting Farmer', ko: '휴식 중인 농부' } },
];

export function getFarmerTitle(inputChars: number): FarmerTitle {
  for (const { min, title } of FARMER_TITLES) {
    if (inputChars >= min) return title;
  }
  return FARMER_TITLES[FARMER_TITLES.length - 1].title;
}

// ── 아이템 진화 ──
export const EVOLUTION_TIERS = [
  { stars: 0, label: '', threshold: 1 },
  { stars: 1, label: '★', threshold: 3 },
  { stars: 2, label: '★★', threshold: 7 },
  { stars: 3, label: '★★★', threshold: 15 },
] as const;

export function getEvolutionTier(duplicateCount: number): { stars: number; label: string } {
  for (let i = EVOLUTION_TIERS.length - 1; i >= 0; i--) {
    if (duplicateCount >= EVOLUTION_TIERS[i].threshold) {
      return { stars: EVOLUTION_TIERS[i].stars, label: EVOLUTION_TIERS[i].label };
    }
  }
  return { stars: 0, label: '' };
}

export function getNextEvolutionThreshold(duplicateCount: number): number | null {
  for (const tier of EVOLUTION_TIERS) {
    if (duplicateCount < tier.threshold) return tier.threshold;
  }
  return null; // maxed out
}

// ── 캐릭터 커스터마이징 ──

export const DEFAULT_CHARACTER_APPEARANCE: CharacterAppearance = {
  type: 'human',
  hairStyle: 'short',
  hairColor: 'brown',
  skinTone: 'light',
  eyeStyle: 'dot',
  accessory: 'none',
  clothesColor: 'blue',
};

/** github_id 기반 결정론적 캐릭터 외형 생성 (커스텀하지 않은 유저용) */
export function generateDefaultAppearance(seed: string): CharacterAppearance {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const h = Math.abs(hash);

  const types = CHARACTER_TYPES;
  const type = types[h % types.length];

  if (type !== 'human') {
    const clothes = Object.keys(CHARACTER_CLOTHES_COLORS);
    const eyes: CharacterAppearance['eyeStyle'][] = ['dot', 'round', 'line', 'star', 'closed'];
    return {
      type,
      eyeStyle: eyes[(h >> 4) % eyes.length],
      clothesColor: clothes[(h >> 8) % clothes.length],
    };
  }

  const hairs: CharacterAppearance['hairStyle'][] = ['short', 'long', 'curly', 'ponytail', 'bun', 'spiky', 'bob', 'buzz'];
  const hairColors = Object.keys(CHARACTER_HAIR_COLORS);
  const skins: CharacterAppearance['skinTone'][] = ['light', 'medium', 'dark', 'pale'];
  const eyes: CharacterAppearance['eyeStyle'][] = ['dot', 'round', 'line', 'star', 'closed'];
  const accs: CharacterAppearance['accessory'][] = ['none', 'none', 'none', 'glasses', 'sunglasses']; // none 확률 높게
  const clothes = Object.keys(CHARACTER_CLOTHES_COLORS);

  return {
    type: 'human',
    hairStyle: hairs[(h >> 3) % hairs.length],
    hairColor: hairColors[(h >> 6) % hairColors.length],
    skinTone: skins[(h >> 9) % skins.length],
    eyeStyle: eyes[(h >> 12) % eyes.length],
    accessory: accs[(h >> 15) % accs.length],
    clothesColor: clothes[(h >> 18) % clothes.length],
  };
}

export const CHARACTER_HAIR_COLORS: Record<string, { base: string; highlight: string }> = {
  brown:  { base: '#5C3A1E', highlight: '#7A5230' },
  black:  { base: '#2C1810', highlight: '#3E2723' },
  blonde: { base: '#D4A543', highlight: '#E8C468' },
  red:    { base: '#A0522D', highlight: '#CD853F' },
  pink:   { base: '#E8A0BF', highlight: '#F0C0D0' },
  blue:   { base: '#4A6FA5', highlight: '#6B8FBF' },
  white:  { base: '#D0D0D0', highlight: '#EEEEEE' },
  green:  { base: '#5A9E5A', highlight: '#7BC77B' },
};

export const CHARACTER_SKIN_TONES: Record<string, { base: string; shadow: string }> = {
  light:  { base: '#FFD5B8', shadow: '#E8B796' },
  medium: { base: '#D4A574', shadow: '#B8886A' },
  dark:   { base: '#8B6544', shadow: '#6B4E30' },
  pale:   { base: '#FFF0E0', shadow: '#F0D8C0' },
};

export const CHARACTER_CLOTHES_COLORS: Record<string, { base: string; shadow: string }> = {
  blue:   { base: '#6C9BD2', shadow: '#4A7FB5' },
  red:    { base: '#E57373', shadow: '#C05050' },
  green:  { base: '#81C784', shadow: '#5A9E5A' },
  purple: { base: '#BA68C8', shadow: '#9040A0' },
  orange: { base: '#FFB74D', shadow: '#E09530' },
  pink:   { base: '#F06292', shadow: '#D04070' },
  teal:   { base: '#4DB6AC', shadow: '#309088' },
  yellow: { base: '#FFD54F', shadow: '#E0B830' },
};

export const ANIMAL_PALETTES: Record<string, { base: string; shadow: string; accent: string; nose: string }> = {
  bear:   { base: '#8B6544', shadow: '#6B4E30', accent: '#D4A574', nose: '#2C1810' },
  rabbit: { base: '#F5E6D3', shadow: '#E0CDB8', accent: '#FFB6C1', nose: '#FF9A9E' },
  tiger:  { base: '#E8A040', shadow: '#C08030', accent: '#2C1810', nose: '#2C1810' },
  wolf:   { base: '#8899AA', shadow: '#667788', accent: '#C0C8D0', nose: '#2C1810' },
  frog:   { base: '#5A9E32', shadow: '#488028', accent: '#7BC74D', nose: '#488028' },
  husky:  { base: '#7A8899', shadow: '#5A6877', accent: '#FFFFFF', nose: '#2C1810' },
  bichon: { base: '#FAFAFA', shadow: '#E8E0D8', accent: '#F0E8E0', nose: '#2C1810' },
  corgi:  { base: '#D4A040', shadow: '#B08030', accent: '#FAFAFA', nose: '#2C1810' },
};

export const CHARACTER_TYPES = ['human', 'bear', 'rabbit', 'tiger', 'wolf', 'frog', 'husky', 'bichon', 'corgi'] as const;

// ── 레벨 ──
export function calculateLevel(totalHarvests: number): number {
  if (totalHarvests < 5) return 1;
  if (totalHarvests < 15) return 2;
  if (totalHarvests < 30) return 3;
  if (totalHarvests < 50) return 4;
  if (totalHarvests < 80) return 5;
  if (totalHarvests < 120) return 6;
  if (totalHarvests < 170) return 7;
  if (totalHarvests < 230) return 8;
  if (totalHarvests < 300) return 9;
  return 10;
}
