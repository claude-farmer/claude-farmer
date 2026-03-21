import type { CropType, Rarity } from './types.js';

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

// ── 물 주기 ──
export const DAILY_WATER_LIMIT = 3;

// ── 경로 ──
export const DATA_DIR = '.claude-farmer';
export const STATE_FILE = 'state.json';
export const ACTIVITY_FILE = 'activity.json';

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
