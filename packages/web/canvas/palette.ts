// 스펙에 정의된 색상 팔레트

export const PALETTE = {
  // 배경 그라데이션
  sky: {
    morning: ['#FFF3E0', '#FFCCBC'],
    afternoon: ['#B3E5FC', '#E1F5FE'],
    evening: ['#F48FB1', '#CE93D8', '#FFE082'],
    night: ['#0D1B2A', '#1B2838'],
  },

  // 땅/자연
  dirt: '#8B6914',
  dirtDark: '#6B4E0A',
  grass: '#7BC74D',
  grassDark: '#5A9E32',
  treeTrunk: '#A0724A',
  treeLeaf: '#4CAF50',

  // 캐릭터
  skin: '#FFD5B8',
  skinShadow: '#E8B796',
  hair: '#5C3A1E',
  hairHighlight: '#7A5230',
  eyes: '#3E2723',
  blush: '#FF9A9E',
  clothes: '#6C9BD2',
  clothesShadow: '#4A7FB5',
  pants: '#5B7A9E',
  pantsShadow: '#486888',
  shoes: '#8B6914',
  shadow: 'rgba(0,0,0,0.2)',

  // 구름
  cloudWhite: '#FFFFFF',
  cloudOrange: '#FFCC80',

  // 밤
  star: '#FFFFFF',
  moon: '#FFF9C4',
  firefly: '#C5E1A5',

  // 태양
  sunMorning: '#FFE0B2',
  sunAfternoon: '#FFF176',
  sunEvening: '#FF8A65',

  // UI
  uiBg: '#1a1d27',
  uiCard: '#232736',
  uiBorder: '#2a2d3a',
  uiText: '#e5e7eb',
  uiAccent: '#fbbf24',
  uiSuccess: '#4ade80',

  // 등급
  common: '#9ca3af',
  rare: '#60a5fa',
  epic: '#a78bfa',
  legendary: '#fbbf24',

  // 타일
  path: '#C4A97D',
  pathDark: '#B8956E',
  water: '#64B5F6',
  waterHighlight: '#42A5F5',
  fence: '#A0724A',
} as const;
