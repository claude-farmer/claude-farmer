// 캐릭터 스프라이트 합성 엔진
// 대두(chibi) 스타일: 머리 8px + 몸 8px = 16×16
// docs/PIXEL_ART_STYLE_GUIDE.md 참조

import type { CharacterAppearance } from '@claude-farmer/shared';
import {
  DEFAULT_CHARACTER_APPEARANCE,
  CHARACTER_HAIR_COLORS,
  CHARACTER_SKIN_TONES,
  CHARACTER_CLOTHES_COLORS,
  ANIMAL_PALETTES,
} from '@claude-farmer/shared';
import type { SpriteData } from './sprites';

// ── 스프라이트 캐시 ──
const spriteCache = new Map<string, SpriteData>();

function cacheKey(a: CharacterAppearance): string {
  return `${a.type}:${a.hairStyle ?? ''}:${a.hairColor ?? ''}:${a.skinTone ?? ''}:${a.eyeStyle ?? ''}:${a.accessory ?? ''}:${a.clothesColor ?? ''}`;
}

// ── 16×16 풀 스프라이트 합성 ──
export function composeCharacterSprite(appearance?: CharacterAppearance): SpriteData {
  const a = appearance ?? DEFAULT_CHARACTER_APPEARANCE;
  const key = cacheKey(a);
  const cached = spriteCache.get(key);
  if (cached) return cached;

  const grid: SpriteData = Array.from({ length: 16 }, () => Array(16).fill(null));

  // 의상 색상
  const clothes = CHARACTER_CLOTHES_COLORS[a.clothesColor ?? 'blue'] ?? CHARACTER_CLOTHES_COLORS.blue;

  // rows 8-15: 공유 바디 템플릿
  drawBody(grid, clothes.base, clothes.shadow);

  // rows 0-7: 타입별 머리
  if (a.type === 'human') {
    drawHumanHead(grid, a);
  } else {
    drawAnimalHead(grid, a.type, a.eyeStyle);
  }

  spriteCache.set(key, grid);
  return grid;
}

// ── 공유 바디 (rows 8-15) ──
function drawBody(grid: SpriteData, clothesBase: string, clothesShadow: string) {
  const pants = '#5B7A9E';
  const pantsShadow = '#486888';
  const shoes = '#8B6914';
  const shadow = 'rgba(0,0,0,0.2)';

  // row 8: 상의 상단
  fillRow(grid, 8, 5, 10, clothesBase);
  // row 9: 상의 + 그림자
  set(grid, 9, 4, clothesShadow); fillRow(grid, 9, 5, 10, clothesBase); set(grid, 9, 10, clothesShadow);
  // row 10: 상의
  set(grid, 10, 4, clothesShadow); fillRow(grid, 10, 5, 10, clothesBase); set(grid, 10, 10, clothesShadow);
  // row 11: 바지
  fillRow(grid, 11, 5, 10, pants);
  // row 12: 바지 + 그림자
  fillRow(grid, 12, 5, 7, pants); set(grid, 12, 7, pantsShadow); set(grid, 12, 8, pantsShadow); fillRow(grid, 12, 8, 10, pants);
  // row 13: 바지 다리
  fillRow(grid, 13, 5, 7, pants); fillRow(grid, 13, 8, 10, pants);
  // row 14: 신발
  fillRow(grid, 14, 5, 7, shoes); fillRow(grid, 14, 8, 10, shoes);
  // row 15: 그림자
  fillRow(grid, 15, 4, 11, shadow);
}

// ── 인간 머리 (rows 0-7) ──
function drawHumanHead(grid: SpriteData, a: CharacterAppearance) {
  const hair = CHARACTER_HAIR_COLORS[a.hairColor ?? 'brown'] ?? CHARACTER_HAIR_COLORS.brown;
  const skin = CHARACTER_SKIN_TONES[a.skinTone ?? 'light'] ?? CHARACTER_SKIN_TONES.light;
  const eyes = '#3E2723';
  const blush = '#FF9A9E';

  // 헤어 스타일별 머리 그리기
  switch (a.hairStyle ?? 'short') {
    case 'short':
      // row 0-1: 둥근 짧은 머리
      fillRow(grid, 0, 6, 9, hair.base);
      fillRow(grid, 1, 5, 10, hair.base); set(grid, 1, 6, hair.highlight);
      // row 2-3: 머리 + 이마
      fillRow(grid, 2, 4, 11, hair.base); set(grid, 2, 5, hair.highlight);
      set(grid, 3, 4, hair.base); fillRow(grid, 3, 5, 10, skin.base); set(grid, 3, 10, hair.base);
      break;
    case 'long':
      fillRow(grid, 0, 6, 9, hair.base);
      fillRow(grid, 1, 5, 10, hair.base); set(grid, 1, 7, hair.highlight);
      fillRow(grid, 2, 4, 11, hair.base); set(grid, 2, 5, hair.highlight);
      set(grid, 3, 4, hair.base); fillRow(grid, 3, 5, 10, skin.base); set(grid, 3, 10, hair.base);
      // 사이드 머리 연장
      set(grid, 4, 4, hair.base); set(grid, 4, 10, hair.base);
      set(grid, 5, 4, hair.base); set(grid, 5, 10, hair.base);
      set(grid, 6, 4, hair.base); set(grid, 6, 10, hair.base);
      break;
    case 'curly':
      set(grid, 0, 5, hair.base); fillRow(grid, 0, 6, 9, hair.highlight); set(grid, 0, 9, hair.base);
      fillRow(grid, 1, 4, 11, hair.base); set(grid, 1, 5, hair.highlight); set(grid, 1, 8, hair.highlight);
      fillRow(grid, 2, 4, 11, hair.base); set(grid, 2, 6, hair.highlight); set(grid, 2, 9, hair.highlight);
      set(grid, 3, 4, hair.base); fillRow(grid, 3, 5, 10, skin.base); set(grid, 3, 10, hair.base);
      break;
    case 'ponytail':
      fillRow(grid, 0, 6, 9, hair.base);
      fillRow(grid, 1, 5, 10, hair.base); set(grid, 1, 6, hair.highlight);
      fillRow(grid, 2, 4, 11, hair.base); set(grid, 2, 10, hair.highlight); set(grid, 2, 11, hair.base);
      set(grid, 3, 4, hair.base); fillRow(grid, 3, 5, 10, skin.base); set(grid, 3, 10, hair.base); set(grid, 3, 11, hair.base);
      set(grid, 4, 11, hair.base);
      break;
    case 'bun':
      fillRow(grid, 0, 6, 9, hair.highlight); // 번 상단
      set(grid, 0, 5, hair.base); set(grid, 0, 9, hair.base);
      fillRow(grid, 1, 5, 10, hair.base); set(grid, 1, 7, hair.highlight);
      fillRow(grid, 2, 4, 11, hair.base); set(grid, 2, 5, hair.highlight);
      set(grid, 3, 4, hair.base); fillRow(grid, 3, 5, 10, skin.base); set(grid, 3, 10, hair.base);
      break;
    case 'spiky':
      set(grid, 0, 5, hair.base); set(grid, 0, 7, hair.highlight); set(grid, 0, 9, hair.base);
      fillRow(grid, 1, 5, 10, hair.base); set(grid, 1, 6, hair.highlight); set(grid, 1, 8, hair.highlight);
      fillRow(grid, 2, 4, 11, hair.base); set(grid, 2, 5, hair.highlight);
      set(grid, 3, 4, hair.base); fillRow(grid, 3, 5, 10, skin.base); set(grid, 3, 10, hair.base);
      break;
    case 'bob':
      fillRow(grid, 0, 5, 10, hair.base);
      fillRow(grid, 1, 4, 11, hair.base); set(grid, 1, 6, hair.highlight);
      fillRow(grid, 2, 4, 11, hair.base); set(grid, 2, 5, hair.highlight);
      set(grid, 3, 3, hair.base); set(grid, 3, 4, hair.base); fillRow(grid, 3, 5, 10, skin.base); set(grid, 3, 10, hair.base); set(grid, 3, 11, hair.base);
      set(grid, 4, 3, hair.base); set(grid, 4, 11, hair.base);
      break;
    case 'buzz':
      fillRow(grid, 1, 5, 10, hair.base);
      fillRow(grid, 2, 4, 11, hair.base);
      set(grid, 3, 4, hair.base); fillRow(grid, 3, 5, 10, skin.base); set(grid, 3, 10, hair.base);
      break;
  }

  // row 4-5: 얼굴 (모든 헤어에 공통)
  set(grid, 4, 4, skin.shadow); fillRow(grid, 4, 5, 10, skin.base); set(grid, 4, 10, skin.shadow);
  set(grid, 5, 4, skin.shadow); fillRow(grid, 5, 5, 10, skin.base); set(grid, 5, 10, skin.shadow);

  // 눈
  drawEyes(grid, a.eyeStyle ?? 'dot', eyes);

  // 볼터치
  set(grid, 5, 5, blush);
  set(grid, 5, 9, blush);

  // row 6-7: 턱/목
  fillRow(grid, 6, 5, 10, skin.base);
  fillRow(grid, 7, 6, 9, skin.shadow);

  // 액세서리
  if (a.accessory && a.accessory !== 'none') {
    drawAccessory(grid, a.accessory);
  }
}

function drawEyes(grid: SpriteData, style: string, color: string) {
  switch (style) {
    case 'dot':
      set(grid, 4, 6, color); set(grid, 4, 8, color);
      break;
    case 'round':
      set(grid, 4, 6, color); set(grid, 5, 6, color);
      set(grid, 4, 8, color); set(grid, 5, 8, color);
      break;
    case 'line':
      set(grid, 4, 6, color); set(grid, 4, 7, color);
      set(grid, 4, 8, color); set(grid, 4, 9, color);
      break;
    case 'star':
      set(grid, 4, 6, color); set(grid, 4, 8, color);
      set(grid, 3, 6, '#FFFFFF'); set(grid, 3, 8, '#FFFFFF'); // sparkle
      break;
    case 'closed':
      set(grid, 4, 6, color); set(grid, 4, 7, color);
      set(grid, 4, 8, color); set(grid, 4, 9, color);
      break;
  }
}

function drawAccessory(grid: SpriteData, acc: string) {
  switch (acc) {
    case 'glasses':
      // 둥근 안경 프레임
      set(grid, 4, 5, '#555'); set(grid, 4, 7, '#555'); set(grid, 4, 9, '#555');
      set(grid, 3, 6, '#555'); set(grid, 3, 8, '#555');
      break;
    case 'sunglasses':
      set(grid, 4, 5, '#1a1a1a'); set(grid, 4, 6, '#333'); set(grid, 4, 7, '#1a1a1a');
      set(grid, 4, 8, '#333'); set(grid, 4, 9, '#1a1a1a');
      break;
    case 'eyepatch':
      set(grid, 4, 6, '#2C1810'); set(grid, 3, 6, '#2C1810'); set(grid, 5, 6, '#2C1810');
      set(grid, 3, 7, '#2C1810'); set(grid, 3, 8, '#2C1810'); // strap
      break;
    case 'bandaid':
      set(grid, 5, 10, '#FFD5B8'); set(grid, 6, 10, '#FFF0C0');
      set(grid, 6, 9, '#FFF0C0');
      break;
  }
}

// ── 동물 머리 (rows 0-7) ──
function drawAnimalHead(grid: SpriteData, type: string, eyeStyle?: string) {
  const pal = ANIMAL_PALETTES[type] ?? ANIMAL_PALETTES.bear;
  const eyes = '#3E2723';

  switch (type) {
    case 'bear':
      // 귀 (작은 원형)
      set(grid, 0, 4, pal.base); set(grid, 0, 5, pal.base);
      set(grid, 0, 9, pal.base); set(grid, 0, 10, pal.base);
      // 머리
      fillRow(grid, 1, 5, 10, pal.base);
      fillRow(grid, 2, 4, 11, pal.base);
      fillRow(grid, 3, 4, 11, pal.base);
      // 얼굴
      fillRow(grid, 4, 4, 11, pal.base);
      set(grid, 4, 6, eyes); set(grid, 4, 8, eyes);
      fillRow(grid, 5, 4, 11, pal.base);
      // 코/주둥이
      set(grid, 5, 6, pal.accent); set(grid, 5, 7, pal.nose); set(grid, 5, 8, pal.accent);
      // 턱
      fillRow(grid, 6, 5, 10, pal.base);
      fillRow(grid, 7, 6, 9, pal.shadow);
      break;

    case 'rabbit':
      // 긴 귀
      set(grid, 0, 5, pal.base); set(grid, 0, 9, pal.base);
      set(grid, 0, 5, pal.base); set(grid, 0, 9, pal.base);
      set(grid, 1, 5, pal.base); set(grid, 1, 9, pal.base);
      // 귀 안쪽 핑크
      set(grid, 1, 5, pal.accent); set(grid, 1, 9, pal.accent);
      // 머리
      fillRow(grid, 2, 4, 11, pal.base);
      fillRow(grid, 3, 4, 11, pal.base);
      // 얼굴
      fillRow(grid, 4, 4, 11, pal.base);
      set(grid, 4, 6, eyes); set(grid, 4, 8, eyes);
      fillRow(grid, 5, 4, 11, pal.base);
      set(grid, 5, 7, pal.nose); // 핑크 코
      // 턱
      fillRow(grid, 6, 5, 10, pal.base);
      fillRow(grid, 7, 6, 9, pal.shadow);
      break;

    case 'tiger':
      // 작은 둥근 귀 + 줄무늬
      set(grid, 0, 4, pal.base); set(grid, 0, 5, pal.base);
      set(grid, 0, 9, pal.base); set(grid, 0, 10, pal.base);
      fillRow(grid, 1, 5, 10, pal.base); set(grid, 1, 7, pal.accent); // 이마 줄무늬
      fillRow(grid, 2, 4, 11, pal.base); set(grid, 2, 5, pal.accent); set(grid, 2, 9, pal.accent);
      fillRow(grid, 3, 4, 11, pal.base);
      fillRow(grid, 4, 4, 11, pal.base);
      set(grid, 4, 6, eyes); set(grid, 4, 8, eyes);
      fillRow(grid, 5, 4, 11, pal.base);
      set(grid, 5, 6, '#FAFAFA'); set(grid, 5, 7, pal.nose); set(grid, 5, 8, '#FAFAFA'); // 흰 주둥이
      fillRow(grid, 6, 5, 10, pal.base);
      fillRow(grid, 7, 6, 9, pal.shadow);
      break;

    case 'wolf':
      // 뾰족한 귀
      set(grid, 0, 4, pal.base); set(grid, 0, 10, pal.base);
      set(grid, 0, 5, pal.base); set(grid, 0, 9, pal.base);
      fillRow(grid, 1, 5, 10, pal.base);
      fillRow(grid, 2, 4, 11, pal.base);
      fillRow(grid, 3, 4, 11, pal.base);
      fillRow(grid, 4, 4, 11, pal.base);
      set(grid, 4, 6, eyes); set(grid, 4, 8, eyes);
      fillRow(grid, 5, 4, 11, pal.base);
      set(grid, 5, 6, pal.accent); set(grid, 5, 7, pal.nose); set(grid, 5, 8, pal.accent);
      fillRow(grid, 6, 5, 10, pal.accent); // 밝은 턱
      fillRow(grid, 7, 6, 9, pal.shadow);
      break;

    case 'frog':
      // 귀 없음, 볼록한 눈
      fillRow(grid, 1, 5, 10, pal.base);
      set(grid, 1, 5, pal.accent); set(grid, 1, 9, pal.accent); // 볼록눈
      fillRow(grid, 2, 4, 11, pal.base);
      set(grid, 2, 5, eyes); set(grid, 2, 9, eyes); // 눈 위쪽
      fillRow(grid, 3, 4, 11, pal.base);
      fillRow(grid, 4, 4, 11, pal.base);
      set(grid, 4, 6, eyes); set(grid, 4, 8, eyes);
      fillRow(grid, 5, 4, 11, pal.base);
      // 넓은 입
      fillRow(grid, 6, 4, 11, pal.base);
      set(grid, 6, 5, pal.accent); fillRow(grid, 6, 6, 9, pal.accent);
      fillRow(grid, 7, 6, 9, pal.shadow);
      break;

    case 'husky':
      // 뾰족한 귀
      set(grid, 0, 4, pal.base); set(grid, 0, 10, pal.base);
      set(grid, 0, 5, pal.base); set(grid, 0, 9, pal.base);
      fillRow(grid, 1, 5, 10, pal.base);
      fillRow(grid, 2, 4, 11, pal.base);
      // 허스키 얼굴 마스크 (흰색)
      fillRow(grid, 3, 4, 11, pal.base);
      set(grid, 3, 6, pal.accent); set(grid, 3, 7, pal.accent); set(grid, 3, 8, pal.accent);
      fillRow(grid, 4, 4, 11, pal.base);
      set(grid, 4, 5, pal.accent); set(grid, 4, 6, eyes); set(grid, 4, 7, pal.accent);
      set(grid, 4, 8, eyes); set(grid, 4, 9, pal.accent);
      fillRow(grid, 5, 4, 11, pal.accent); // 흰 하반
      set(grid, 5, 4, pal.base); set(grid, 5, 10, pal.base);
      set(grid, 5, 7, pal.nose);
      fillRow(grid, 6, 5, 10, pal.accent);
      fillRow(grid, 7, 6, 9, pal.shadow);
      break;

    case 'bichon':
      // 둥글둥글한 솜사탕 같은 머리
      fillRow(grid, 0, 4, 11, pal.base);
      set(grid, 0, 5, pal.shadow); set(grid, 0, 9, pal.shadow); // 질감
      fillRow(grid, 1, 3, 12, pal.base); set(grid, 1, 4, pal.shadow);
      fillRow(grid, 2, 3, 12, pal.base);
      fillRow(grid, 3, 4, 11, pal.base);
      fillRow(grid, 4, 4, 11, pal.base);
      set(grid, 4, 6, eyes); set(grid, 4, 8, eyes);
      fillRow(grid, 5, 4, 11, pal.base);
      set(grid, 5, 7, pal.nose);
      fillRow(grid, 6, 5, 10, pal.base);
      fillRow(grid, 7, 6, 9, pal.shadow);
      break;

    case 'corgi':
      // 큰 뾰족 귀
      set(grid, 0, 3, pal.base); set(grid, 0, 4, pal.base);
      set(grid, 0, 10, pal.base); set(grid, 0, 11, pal.base);
      set(grid, 1, 4, pal.base); fillRow(grid, 1, 5, 10, pal.base); set(grid, 1, 10, pal.base);
      fillRow(grid, 2, 4, 11, pal.base);
      // 얼굴 — 탄/흰 분할
      fillRow(grid, 3, 4, 11, pal.base);
      set(grid, 3, 6, pal.accent); set(grid, 3, 7, pal.accent); set(grid, 3, 8, pal.accent);
      fillRow(grid, 4, 4, 11, pal.base);
      set(grid, 4, 6, eyes); set(grid, 4, 7, pal.accent); set(grid, 4, 8, eyes);
      fillRow(grid, 5, 4, 11, pal.accent); // 흰 하반
      set(grid, 5, 4, pal.base); set(grid, 5, 10, pal.base);
      set(grid, 5, 7, pal.nose);
      fillRow(grid, 6, 5, 10, pal.accent);
      fillRow(grid, 7, 6, 9, pal.shadow);
      break;
  }
}

// ── 유틸 ──
function set(grid: SpriteData, row: number, col: number, color: string) {
  if (row >= 0 && row < 16 && col >= 0 && col < 16) {
    grid[row][col] = color;
  }
}

function fillRow(grid: SpriteData, row: number, fromCol: number, toCol: number, color: string) {
  for (let c = fromCol; c < toCol; c++) {
    set(grid, row, c, color);
  }
}

// ── 6×12 고스트 캐릭터 렌더링 ──
export function drawGhostCharacter(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  appearance?: CharacterAppearance
) {
  const a = appearance ?? DEFAULT_CHARACTER_APPEARANCE;
  const clothes = CHARACTER_CLOTHES_COLORS[a.clothesColor ?? 'blue'] ?? CHARACTER_CLOTHES_COLORS.blue;

  if (a.type === 'human') {
    const hair = CHARACTER_HAIR_COLORS[a.hairColor ?? 'brown'] ?? CHARACTER_HAIR_COLORS.brown;
    const skin = CHARACTER_SKIN_TONES[a.skinTone ?? 'light'] ?? CHARACTER_SKIN_TONES.light;
    // 머리카락
    ctx.fillStyle = hair.base;
    ctx.fillRect(x, y, 6, 3);
    ctx.fillStyle = hair.highlight;
    ctx.fillRect(x + 2, y, 1, 1);
    // 피부
    ctx.fillStyle = skin.base;
    ctx.fillRect(x + 1, y + 3, 4, 3);
    // 눈
    ctx.fillStyle = '#3E2723';
    ctx.fillRect(x + 2, y + 4, 1, 1);
    ctx.fillRect(x + 4, y + 4, 1, 1);
  } else {
    const pal = ANIMAL_PALETTES[a.type] ?? ANIMAL_PALETTES.bear;
    // 귀 (종별)
    if (a.type === 'rabbit') {
      ctx.fillStyle = pal.base;
      ctx.fillRect(x + 1, y, 1, 2);
      ctx.fillRect(x + 4, y, 1, 2);
    } else if (a.type === 'frog') {
      // 귀 없음, 볼록눈
      ctx.fillStyle = pal.accent;
      ctx.fillRect(x + 1, y, 1, 1);
      ctx.fillRect(x + 4, y, 1, 1);
    } else if (a.type === 'bichon') {
      ctx.fillStyle = pal.base;
      ctx.fillRect(x, y, 6, 1); // 솜사탕 넓은 머리
    } else {
      // 기본 귀 (곰, 호랑이, 늑대, 허스키, 코기)
      ctx.fillStyle = pal.base;
      ctx.fillRect(x, y, 2, 1);
      ctx.fillRect(x + 4, y, 2, 1);
    }
    // 머리
    ctx.fillStyle = pal.base;
    ctx.fillRect(x, y + 1, 6, 2);
    // 얼굴
    ctx.fillStyle = pal.base;
    ctx.fillRect(x + 1, y + 3, 4, 2);
    // 눈
    ctx.fillStyle = '#3E2723';
    ctx.fillRect(x + 2, y + 3, 1, 1);
    ctx.fillRect(x + 4, y + 3, 1, 1);
    // 코
    ctx.fillStyle = pal.nose;
    ctx.fillRect(x + 3, y + 4, 1, 1);
    // 하반 (허스키/코기는 흰색)
    if (a.type === 'husky' || a.type === 'corgi') {
      ctx.fillStyle = pal.accent;
      ctx.fillRect(x + 1, y + 5, 4, 1);
    }
  }

  // 공유 바디
  ctx.fillStyle = clothes.base;
  ctx.fillRect(x, y + 6, 6, 4);
  ctx.fillStyle = '#5B7A9E';
  ctx.fillRect(x + 1, y + 10, 2, 2);
  ctx.fillRect(x + 3, y + 10, 2, 2);
}

// ── 6×8 미니 포트레이트 렌더링 ──
export function drawMiniCharacter(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  appearance?: CharacterAppearance
) {
  const a = appearance ?? DEFAULT_CHARACTER_APPEARANCE;
  const clothes = CHARACTER_CLOTHES_COLORS[a.clothesColor ?? 'blue'] ?? CHARACTER_CLOTHES_COLORS.blue;

  if (a.type === 'human') {
    const hair = CHARACTER_HAIR_COLORS[a.hairColor ?? 'brown'] ?? CHARACTER_HAIR_COLORS.brown;
    const skin = CHARACTER_SKIN_TONES[a.skinTone ?? 'light'] ?? CHARACTER_SKIN_TONES.light;
    ctx.fillStyle = hair.base;
    ctx.fillRect(x + 1, y, 4, 2);
    ctx.fillStyle = skin.base;
    ctx.fillRect(x + 1, y + 2, 4, 2);
    ctx.fillStyle = '#3E2723';
    ctx.fillRect(x + 2, y + 3, 1, 1);
    ctx.fillRect(x + 3, y + 3, 1, 1);
  } else {
    const pal = ANIMAL_PALETTES[a.type] ?? ANIMAL_PALETTES.bear;
    // 귀 실루엣 (종 구분의 핵심)
    if (a.type === 'rabbit') {
      ctx.fillStyle = pal.base;
      ctx.fillRect(x + 1, y, 1, 1); ctx.fillRect(x + 4, y, 1, 1);
    } else if (a.type === 'bichon') {
      ctx.fillStyle = pal.base;
      ctx.fillRect(x, y, 6, 1);
    } else if (a.type === 'corgi') {
      ctx.fillStyle = pal.base;
      ctx.fillRect(x, y, 2, 1); ctx.fillRect(x + 4, y, 2, 1);
    } else if (a.type !== 'frog') {
      ctx.fillStyle = pal.base;
      ctx.fillRect(x + 1, y, 1, 1); ctx.fillRect(x + 4, y, 1, 1);
    }
    ctx.fillStyle = pal.base;
    ctx.fillRect(x + 1, y + 1, 4, 3);
    ctx.fillStyle = '#3E2723';
    ctx.fillRect(x + 2, y + 3, 1, 1);
    ctx.fillRect(x + 3, y + 3, 1, 1);
  }

  // 바디
  ctx.fillStyle = clothes.base;
  ctx.fillRect(x, y + 4, 6, 3);
  ctx.fillStyle = '#5B7A9E';
  ctx.fillRect(x + 1, y + 7, 2, 1);
  ctx.fillRect(x + 3, y + 7, 2, 1);
}
