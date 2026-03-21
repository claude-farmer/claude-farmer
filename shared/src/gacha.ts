import type { GachaItem, Rarity } from './types.js';
import { RARITY_WEIGHTS } from './constants.js';

// ── 가챠 아이템 전체 목록 ──
export const GACHA_ITEMS: GachaItem[] = [
  // Common (9종)
  { id: 'c01', name: '돌멩이', rarity: 'common', description: '둥근 회색 돌' },
  { id: 'c02', name: '나뭇가지', rarity: 'common', description: '갈색 가지. 잎 1개' },
  { id: 'c03', name: '잡초', rarity: 'common', description: '초록 풀 3가닥' },
  { id: 'c04', name: '지렁이', rarity: 'common', description: '분홍 구불구불. 귀여운 눈' },
  { id: 'c05', name: '물뿌리개', rarity: 'common', description: '녹색 물뿌리개' },
  { id: 'c06', name: '나무 울타리', rarity: 'common', description: '갈색 나무 울타리' },
  { id: 'c07', name: '돌 길', rarity: 'common', description: '회색 돌 타일 패턴' },
  { id: 'c08', name: '잔디', rarity: 'common', description: '진한 초록 잔디 뭉치' },
  { id: 'c09', name: '버섯', rarity: 'common', description: '빨간 모자 + 하얀 점' },

  // Rare (7종)
  { id: 'r01', name: '고양이', rarity: 'rare', description: '앉아있는 주황 고양이' },
  { id: 'r02', name: '강아지', rarity: 'rare', description: '앉아있는 갈색 강아지' },
  { id: 'r03', name: '꽃밭', rarity: 'rare', description: '여러 색 꽃 모음' },
  { id: 'r04', name: '연못', rarity: 'rare', description: '작은 파란 연못 + 수련잎' },
  { id: 'r05', name: '벤치', rarity: 'rare', description: '나무 벤치' },
  { id: 'r06', name: '우체통', rarity: 'rare', description: '빨간 우체통' },
  { id: 'r07', name: '가로등', rarity: 'rare', description: '따뜻한 빛 가로등' },

  // Epic (5종)
  { id: 'e01', name: '분수대', rarity: 'epic', description: '작은 분수. 물방울 반짝' },
  { id: 'e02', name: '풍차', rarity: 'epic', description: '미니 풍차. 날개 4개' },
  { id: 'e03', name: '사과나무', rarity: 'epic', description: '빨간 사과 달린 나무' },
  { id: 'e04', name: '토끼', rarity: 'epic', description: '하얀 토끼. 당근 옆에' },
  { id: 'e05', name: '무지개', rarity: 'epic', description: '작은 무지개 아치' },

  // Legendary (3종)
  { id: 'l01', name: '황금 해바라기', rarity: 'legendary', description: '반짝이는 금색 해바라기' },
  { id: 'l02', name: '유니콘', rarity: 'legendary', description: '하얀 유니콘. 무지개 뿔' },
  { id: 'l03', name: '오로라 나무', rarity: 'legendary', description: '무지개빛 잎 나무' },
];

export const TOTAL_ITEMS = GACHA_ITEMS.length; // 24

function rollRarity(): Rarity {
  const roll = Math.random() * 100;
  let cumulative = 0;
  for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS) as [Rarity, number][]) {
    cumulative += weight;
    if (roll < cumulative) return rarity;
  }
  return 'common';
}

export function rollGacha(): GachaItem {
  const rarity = rollRarity();
  const pool = GACHA_ITEMS.filter(item => item.rarity === rarity);
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx];
}
