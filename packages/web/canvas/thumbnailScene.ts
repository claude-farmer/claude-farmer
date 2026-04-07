// 64×64 픽셀 아트 농장 썸네일 씬 그리기 (순수 모듈)
// FarmThumbnail.tsx와 ShareCanvas.tsx에서 공유

import { composeCharacterSprite } from './character';
import { drawSprite } from './sprites';
import { generateDefaultAppearance } from '@claude-farmer/shared';
import type { CharacterAppearance, InventoryItem } from '@claude-farmer/shared';

export const THUMBNAIL_SIZE = 64;

export const THUMBNAIL_SKY_THEMES = [
  { top: '#2D1B4E', bot: '#4A2B6B' },
  { top: '#1B2838', bot: '#2a3a4a' },
  { top: '#3B1929', bot: '#6B3040' },
  { top: '#1A2F1A', bot: '#2A4A2A' },
];
const SKY_THEMES = THUMBNAIL_SKY_THEMES;

export function getThumbnailSkyTheme(githubId: string) {
  return SKY_THEMES[(githubId.charCodeAt(0) ?? 0) % SKY_THEMES.length];
}

export function getThumbnailTier(level: number, uniqueItems: number, streakDays: number): number {
  const score = level * 10 + uniqueItems * 5 + streakDays * 2;
  if (score >= 251) return 4;
  if (score >= 101) return 3;
  if (score >= 31) return 2;
  return 1;
}

export interface ThumbnailSceneOpts {
  githubId?: string;
  character?: CharacterAppearance;
  level: number;
  uniqueItems?: number;
  streakDays?: number;
  inventory?: InventoryItem[];
}

export interface PreparedScene {
  sprite: ReturnType<typeof composeCharacterSprite>;
  sorted: InventoryItem[];
  petId: string | null;
  tier: number;
  skyTheme: { top: string; bot: string };
  githubId: string;
  level: number;
  uniqueItems: number;
  streakDays: number;
}

export function prepareThumbnailScene(opts: ThumbnailSceneOpts): PreparedScene {
  const githubId = opts.githubId ?? 'default';
  const appearance = opts.character ?? generateDefaultAppearance(githubId);
  const sprite = composeCharacterSprite(appearance);

  // 유니크 아이템 정리
  const inventory = opts.inventory ?? [];
  const seen = new Set<string>();
  const uniqueInv: InventoryItem[] = [];
  let hasCat = false, hasDog = false;
  for (const item of inventory) {
    if (item.id === 'r01') hasCat = true;
    if (item.id === 'r02') hasDog = true;
    if (!seen.has(item.id)) { seen.add(item.id); uniqueInv.push(item); }
  }
  const petId = hasCat ? 'r01' : hasDog ? 'r02' : null;
  const displayItems = petId ? uniqueInv.filter(i => i.id !== petId) : uniqueInv;
  const rarityOrder: Record<string, number> = { legendary: 0, epic: 1, rare: 2, common: 3 };
  const sorted = [...displayItems].sort((a, b) => (rarityOrder[a.rarity] ?? 4) - (rarityOrder[b.rarity] ?? 4));

  const uniqueItems = opts.uniqueItems ?? 0;
  const streakDays = opts.streakDays ?? 0;
  const tier = getThumbnailTier(opts.level, uniqueItems, streakDays);
  const skyTheme = SKY_THEMES[(githubId.charCodeAt(0) ?? 0) % SKY_THEMES.length];

  return { sprite, sorted, petId, tier, skyTheme, githubId, level: opts.level, uniqueItems, streakDays };
}

// 64×64 좌표계로 그림. ctx는 호출자가 변환을 관리.
export function renderThumbnailFrame(
  ctx: CanvasRenderingContext2D,
  scene: PreparedScene,
  f: number,
): void {
  const SIZE = THUMBNAIL_SIZE;
  const { sprite, sorted, petId, tier, skyTheme, githubId, uniqueItems, streakDays } = scene;

  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.imageSmoothingEnabled = false;

  // ── 하늘 ──
  const grad = ctx.createLinearGradient(0, 0, 0, 24);
  grad.addColorStop(0, skyTheme.top);
  grad.addColorStop(1, skyTheme.bot);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, 24);

  // 별
  ctx.fillStyle = '#fff';
  if (f % 50 < 25) { ctx.globalAlpha = 0.6; ctx.fillRect(5, 5, 1, 1); }
  if (f % 60 < 30) { ctx.globalAlpha = 0.5; ctx.fillRect(48, 3, 1, 1); }
  if (f % 45 < 20) { ctx.globalAlpha = 0.4; ctx.fillRect(28, 8, 1, 1); }
  if (f % 55 < 28) { ctx.globalAlpha = 0.3; ctx.fillRect(15, 12, 1, 1); }
  if (f % 40 < 18) { ctx.globalAlpha = 0.5; ctx.fillRect(58, 10, 1, 1); }
  ctx.globalAlpha = 1;

  // ── 실루엣 스카이라인 ──
  const silCol = skyTheme.bot + '88';
  ctx.fillStyle = silCol;
  const hoff = ((githubId.charCodeAt(1) ?? 3) * 7) % 20;
  ctx.fillRect(0, 20, SIZE, 4);
  ctx.fillRect(4 + hoff, 18, 30, 2);
  ctx.fillRect(10 + hoff, 16, 18, 2);
  const tx1 = (8 + hoff) % 50 + 4;
  const tx2 = (tx1 + 25) % 56 + 4;
  ctx.fillRect(tx1, 14, 2, 6); ctx.fillRect(tx1 - 2, 12, 6, 3);
  ctx.fillRect(tx2, 15, 2, 5); ctx.fillRect(tx2 - 1, 13, 4, 2);

  // ── 3단 깊이 지면 ──
  const farColor = tier >= 3 ? '#3D7020' : tier >= 2 ? '#4A8828' : '#7A5A10';
  const midColor = tier >= 3 ? '#4A8828' : tier >= 2 ? '#5A9E32' : '#8B6914';
  const nearColor = tier >= 3 ? '#5A9E32' : tier >= 2 ? '#6AB840' : '#9B7920';
  ctx.fillStyle = farColor;
  ctx.fillRect(0, 24, SIZE, 12);
  ctx.fillStyle = midColor;
  for (let gx = 0; gx < SIZE; gx += 6) {
    ctx.fillRect(gx + 1, 26, 1, 1);
  }
  ctx.fillStyle = midColor;
  ctx.fillRect(0, 36, SIZE, 14);
  if (tier >= 2) {
    ctx.fillStyle = farColor;
    for (let gx = 0; gx < SIZE; gx += 4) {
      for (let gy = 36; gy < 50; gy += 4) {
        ctx.fillRect(gx + (gy % 3), gy, 1, 1);
      }
    }
  }
  ctx.fillStyle = nearColor;
  ctx.fillRect(0, 50, SIZE, 14);
  if (tier >= 2) {
    ctx.fillStyle = midColor;
    for (let gx = 0; gx < SIZE; gx += 3) {
      for (let gy = 50; gy < 64; gy += 3) {
        ctx.fillRect(gx + (gy % 2), gy, 1, 1);
      }
    }
  }

  if (tier >= 3) {
    const fc = ['#FF6B81', '#FACC15', '#a78bfa', '#fff', '#FFB6C1'];
    for (let i = 0; i < 6; i++) {
      const fx = (i * 11 + 3) % 60 + 2;
      const fy = 26 + (i * 13) % 32;
      ctx.fillStyle = '#5A9E32';
      ctx.fillRect(fx, fy + 1, 1, 1);
      ctx.fillStyle = fc[i % fc.length];
      ctx.fillRect(fx, fy, 1, 1);
    }
  }

  if (tier >= 3) {
    ctx.fillStyle = '#C4A97D';
    ctx.fillRect(28, 52, 8, 12);
    ctx.fillStyle = '#B8956E';
    ctx.fillRect(29, 54, 2, 1); ctx.fillRect(32, 58, 2, 1);
  }

  // ── 아이템 배치 ──
  const leftSlots = [
    { x: 2, y: 26 }, { x: 2, y: 34 }, { x: 2, y: 42 }, { x: 2, y: 50 },
  ];
  const rightSlots = [
    { x: 57, y: 26 }, { x: 57, y: 34 }, { x: 57, y: 42 }, { x: 57, y: 50 },
  ];
  const bottomSlots = [
    { x: 14, y: 54 }, { x: 24, y: 56 }, { x: 38, y: 56 }, { x: 48, y: 54 },
  ];
  const allSlots = [...bottomSlots, ...leftSlots, ...rightSlots];

  for (let i = 0; i < sorted.length && i < allSlots.length; i++) {
    const s = allSlots[i];
    drawItemWithFrame(ctx, sorted[i].id, sorted[i].rarity, s.x, s.y, f);
  }

  // ── 캐릭터 (2× 스케일, 중앙) ──
  const charX = (SIZE - 32) / 2;
  const charY = 14 + Math.round(Math.sin(f * 0.08) * 0.8);
  drawSprite(ctx, sprite, charX, charY, 2);

  if (petId) {
    drawPet(ctx, petId, charX + 34, charY + 24, f);
  }

  // ── 도감 진행 바 ──
  const barW = 14;
  const barX = SIZE - barW - 2;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(barX - 1, 1, barW + 2, 5);
  ctx.fillStyle = '#333';
  ctx.fillRect(barX, 2, barW, 3);
  const fill = Math.min(1, uniqueItems / 32);
  ctx.fillStyle = fill >= 1 ? '#fbbf24' : '#4ade80';
  ctx.fillRect(barX, 2, Math.round(barW * fill), 3);

  // ── 모닥불 ──
  if (streakDays > 0) {
    const bx = SIZE - 9, by = SIZE - 11;
    ctx.fillStyle = '#8B6544';
    ctx.fillRect(bx, by + 5, 5, 2);
    if (streakDays >= 30) {
      ctx.fillStyle = '#60a5fa'; ctx.fillRect(bx+1,by+1,3,4);
      ctx.fillStyle = '#93c5fd'; ctx.fillRect(bx+1,by-1,2,2);
      ctx.fillStyle = '#bfdbfe'; ctx.globalAlpha = 0.3 + Math.sin(f*0.12)*0.3;
      ctx.fillRect(bx,by-2,5,1); ctx.globalAlpha = 1;
    } else if (streakDays >= 7) {
      ctx.fillStyle = '#EF4444'; ctx.fillRect(bx+1,by+1,3,4);
      ctx.fillStyle = '#FACC15'; ctx.fillRect(bx+1,by,2,2);
    } else if (streakDays >= 3) {
      ctx.fillStyle = '#EF4444'; ctx.fillRect(bx+1,by+3,2,2);
      ctx.fillStyle = '#FACC15'; ctx.fillRect(bx+2,by+2,1,1);
    } else {
      ctx.fillStyle = '#EF4444'; ctx.globalAlpha = 0.5+Math.sin(f*0.06)*0.3;
      ctx.fillRect(bx+2,by+4,1,1); ctx.globalAlpha = 1;
    }
  }

  // ── Tier 4 골드 보더 ──
  if (tier >= 4) {
    ctx.fillStyle = '#fbbf24';
    ctx.globalAlpha = 0.5 + Math.sin(f * 0.05) * 0.3;
    ctx.fillRect(0, 0, SIZE, 1);
    ctx.fillRect(0, SIZE - 1, SIZE, 1);
    ctx.fillRect(0, 0, 1, SIZE);
    ctx.fillRect(SIZE - 1, 0, 1, SIZE);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    if (f % 30 < 15) { ctx.fillRect(1, 1, 1, 1); ctx.fillRect(SIZE-2, SIZE-2, 1, 1); }
    else { ctx.fillRect(SIZE-2, 1, 1, 1); ctx.fillRect(1, SIZE-2, 1, 1); }
  }
}

// ── 5×5 아이템 ──
function drawItemWithFrame(
  ctx: CanvasRenderingContext2D, id: string, rarity: string,
  x: number, y: number, frame: number
) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x - 1, y - 1, 7, 7);

  drawItem5x5(ctx, id, x, y, frame);

  if (rarity === 'legendary') {
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.5 + Math.sin(frame * 0.12 + x) * 0.5;
    ctx.fillRect(x + (frame + x) % 5, y - 1, 1, 1);
    ctx.fillRect(x + 4 - (frame + y) % 4, y + 5, 1, 1);
    ctx.globalAlpha = 1;
  } else if (rarity === 'epic') {
    ctx.fillStyle = '#a78bfa';
    ctx.globalAlpha = 0.15 + Math.sin(frame * 0.08 + x) * 0.1;
    ctx.fillRect(x - 1, y - 1, 7, 7);
    ctx.globalAlpha = 1;
  } else if (rarity === 'rare') {
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.5;
    ctx.fillRect(x, y, 1, 1);
    ctx.globalAlpha = 1;
  }
}

function drawItem5x5(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, f: number) {
  switch (id) {
    case 'c01':
      ctx.fillStyle='#b0b8c4'; ctx.fillRect(x+1,y+2,3,2); ctx.fillRect(x+2,y+1,2,1);
      ctx.fillStyle='#d8e0e8'; ctx.fillRect(x+2,y+2,1,1);
      break;
    case 'c02':
      ctx.fillStyle='#8B6544'; ctx.fillRect(x,y+3,5,1); ctx.fillRect(x+3,y+2,1,1); ctx.fillRect(x+4,y+1,1,1);
      ctx.fillStyle='#5A9E32'; ctx.fillRect(x+4,y,1,1); ctx.fillRect(x+3,y+1,1,1);
      break;
    case 'c03':
      ctx.fillStyle='#5A9E32'; ctx.fillRect(x+1,y+2,1,3); ctx.fillRect(x+2,y+1,1,4); ctx.fillRect(x+3,y+2,1,3);
      ctx.fillStyle='#7BC74D'; ctx.fillRect(x+2,y,1,1);
      break;
    case 'c04':
      ctx.fillStyle='#FFB6C1'; ctx.fillRect(x,y+3,1,1); ctx.fillRect(x+1,y+2,1,1); ctx.fillRect(x+2,y+3,1,1); ctx.fillRect(x+3,y+2,1,1); ctx.fillRect(x+4,y+3,1,1);
      ctx.fillStyle='#333'; ctx.fillRect(x,y+2,1,1);
      break;
    case 'c05':
      ctx.fillStyle='#5A9E32'; ctx.fillRect(x,y+2,4,2); ctx.fillRect(x+4,y+1,1,2);
      ctx.fillStyle='#64B5F6'; ctx.fillRect(x+4,y+3,1,1); ctx.fillRect(x+3,y+4,1,1);
      ctx.fillStyle='#4A8828'; ctx.fillRect(x+1,y+1,1,1);
      break;
    case 'c06':
      ctx.fillStyle='#A0724A'; ctx.fillRect(x,y+1,1,4); ctx.fillRect(x+2,y+1,1,4); ctx.fillRect(x+4,y+1,1,4);
      ctx.fillRect(x,y+2,5,1); ctx.fillRect(x,y+4,5,1);
      break;
    case 'c07':
      ctx.fillStyle='#C4A97D'; ctx.fillRect(x,y+1,5,3);
      ctx.fillStyle='#B8956E'; ctx.fillRect(x+1,y+2,1,1); ctx.fillRect(x+3,y+2,1,1);
      ctx.fillStyle='#D4B98D'; ctx.fillRect(x+2,y+1,1,1);
      break;
    case 'c08':
      ctx.fillStyle='#6BBF3B'; ctx.fillRect(x+1,y+2,1,3); ctx.fillRect(x+2,y+1,1,4); ctx.fillRect(x+3,y+2,1,3);
      ctx.fillStyle='#8FD460'; ctx.fillRect(x+2,y,1,1); ctx.fillRect(x,y+3,1,1); ctx.fillRect(x+4,y+3,1,1);
      break;
    case 'c09':
      ctx.fillStyle='#EF4444'; ctx.fillRect(x+1,y,3,2);
      ctx.fillStyle='#fff'; ctx.fillRect(x+2,y,1,1); ctx.fillRect(x+1,y+1,1,1);
      ctx.fillStyle='#F5E6D3'; ctx.fillRect(x+2,y+2,1,2);
      ctx.fillStyle='#E0D0B8'; ctx.fillRect(x+1,y+4,3,1);
      break;
    case 'c10':
      ctx.fillStyle='#FACC15'; ctx.fillRect(x+1,y+1,3,3); ctx.fillRect(x+2,y,1,1);
      ctx.fillStyle='#E8A040'; ctx.fillRect(x,y+2,1,2);
      ctx.fillStyle='#333'; ctx.fillRect(x+3,y+1,1,1);
      ctx.fillStyle='#FFE066'; ctx.fillRect(x+2,y+1,1,1);
      break;
    case 'c11':
      ctx.fillStyle='#555'; ctx.fillRect(x+1,y+4,3,1); ctx.fillRect(x+2,y+3,1,1); ctx.fillRect(x+3,y+2,1,1);
      ctx.fillStyle='#EF4444'; ctx.fillRect(x+2,y+1,1,1); ctx.fillRect(x+1,y,1,1);
      ctx.fillRect(x+2,y+3,1,1);
      break;
    case 'c12':
      ctx.fillStyle='#FACC15'; ctx.fillRect(x,y,5,5);
      ctx.fillStyle='#D4A020'; ctx.fillRect(x,y,5,1);
      ctx.fillStyle='#8B6544'; ctx.fillRect(x+1,y+2,3,1); ctx.fillRect(x+1,y+4,2,1);
      break;
    case 'r01':
      ctx.fillStyle='#E8A040'; ctx.fillRect(x+1,y+1,3,3);
      ctx.fillRect(x+1,y,1,1); ctx.fillRect(x+3,y,1,1);
      ctx.fillStyle='#333'; ctx.fillRect(x+1,y+2,1,1); ctx.fillRect(x+3,y+2,1,1);
      ctx.fillStyle='#FFB6C1'; ctx.fillRect(x+2,y+3,1,1);
      ctx.fillStyle='#E8A040'; ctx.fillRect(x+4,y+3,1,2);
      break;
    case 'r02':
      ctx.fillStyle='#8B6544'; ctx.fillRect(x+1,y+1,3,3);
      ctx.fillRect(x,y+1,1,2); ctx.fillRect(x+4,y+1,1,2);
      ctx.fillStyle='#333'; ctx.fillRect(x+1,y+2,1,1); ctx.fillRect(x+3,y+2,1,1);
      ctx.fillStyle='#EF4444'; ctx.fillRect(x+2,y+4,1,1);
      break;
    case 'r03':
      ctx.fillStyle='#FF6B81'; ctx.fillRect(x,y,2,2);
      ctx.fillStyle='#FACC15'; ctx.fillRect(x+3,y,2,2);
      ctx.fillStyle='#a78bfa'; ctx.fillRect(x,y+3,2,2);
      ctx.fillStyle='#64B5F6'; ctx.fillRect(x+3,y+3,2,2);
      ctx.fillStyle='#5A9E32'; ctx.fillRect(x+2,y+1,1,3);
      break;
    case 'r04':
      ctx.fillStyle='#64B5F6'; ctx.fillRect(x+1,y+1,3,3);
      ctx.fillStyle='#42A5F5'; ctx.fillRect(x+2,y+2,1,1);
      ctx.fillStyle='#90CAF9'; ctx.fillRect(x+1,y+1,1,1);
      ctx.fillStyle='#5A9E32'; ctx.fillRect(x,y,2,1); ctx.fillRect(x+4,y+2,1,1);
      break;
    case 'r05':
      ctx.fillStyle='#A0724A'; ctx.fillRect(x,y+2,5,1); ctx.fillRect(x,y+3,5,1);
      ctx.fillRect(x,y+1,1,1); ctx.fillRect(x+4,y+1,1,1);
      ctx.fillRect(x,y+4,1,1); ctx.fillRect(x+4,y+4,1,1);
      break;
    case 'r06':
      ctx.fillStyle='#EF4444'; ctx.fillRect(x+1,y,3,3);
      ctx.fillStyle='#C05050'; ctx.fillRect(x+1,y+2,3,1);
      ctx.fillStyle='#8B6544'; ctx.fillRect(x+2,y+3,1,2);
      ctx.fillStyle='#fff'; ctx.fillRect(x+2,y+1,1,1);
      break;
    case 'r07':
      ctx.fillStyle='#888'; ctx.fillRect(x+2,y+2,1,3);
      ctx.fillStyle='#FACC15';
      ctx.globalAlpha = 0.6 + Math.sin(f * 0.08) * 0.4;
      ctx.fillRect(x+1,y,3,2);
      ctx.globalAlpha = 0.2;
      ctx.fillRect(x,y+2,5,2);
      ctx.globalAlpha = 1;
      break;
    case 'r08':
      ctx.fillStyle='#8B6544'; ctx.fillRect(x+2,y+2,1,3); ctx.fillRect(x,y+2,5,1);
      ctx.fillStyle='#F5E6D3'; ctx.fillRect(x+1,y,3,2);
      ctx.fillStyle='#333'; ctx.fillRect(x+1,y+1,1,1); ctx.fillRect(x+3,y+1,1,1);
      break;
    case 'r09':
      ctx.fillStyle='#F5E6D3'; ctx.fillRect(x+1,y+1,3,3);
      ctx.fillStyle='#8B6544'; ctx.fillRect(x+1,y+4,3,1);
      ctx.fillRect(x+4,y+2,1,1);
      ctx.fillStyle='#fff';
      ctx.globalAlpha = 0.4 + Math.sin(f * 0.06) * 0.3;
      ctx.fillRect(x+2,y,1,1); ctx.fillRect(x+3,y-1,1,1);
      ctx.globalAlpha = 1;
      break;
    case 'e01':
      ctx.fillStyle='#9ca3af'; ctx.fillRect(x,y+3,5,2); ctx.fillRect(x+1,y+2,3,1);
      ctx.fillStyle='#64B5F6';
      ctx.globalAlpha = 0.7 + Math.sin(f * 0.1) * 0.3;
      ctx.fillRect(x+2,y,1,3);
      ctx.fillRect(x+1,y+1,1,1); ctx.fillRect(x+3,y+1,1,1);
      ctx.globalAlpha = 1;
      break;
    case 'e02': {
      ctx.fillStyle='#A0724A'; ctx.fillRect(x+2,y+2,1,3); ctx.fillRect(x+1,y+3,3,1);
      ctx.fillStyle='#F5E6D3';
      const a = f * 0.06;
      const dx = Math.round(Math.cos(a) * 2);
      const dy = Math.round(Math.sin(a) * 2);
      ctx.fillRect(x+2+dx, y+1+dy, 1, 1);
      ctx.fillRect(x+2-dx, y+1-dy, 1, 1);
      ctx.fillRect(x+2+dy, y+1-dx, 1, 1);
      ctx.fillRect(x+2-dy, y+1+dx, 1, 1);
      break;
    }
    case 'e03':
      ctx.fillStyle='#8B6544'; ctx.fillRect(x+2,y+3,1,2);
      ctx.fillStyle='#5A9E32'; ctx.fillRect(x+1,y+1,3,2); ctx.fillRect(x,y+1,1,1); ctx.fillRect(x+4,y+1,1,1);
      ctx.fillStyle='#EF4444'; ctx.fillRect(x+1,y,1,1); ctx.fillRect(x+3,y+1,1,1);
      break;
    case 'e04':
      ctx.fillStyle='#fff'; ctx.fillRect(x+1,y+2,3,3);
      ctx.fillRect(x+1,y,1,2); ctx.fillRect(x+3,y,1,2);
      ctx.fillStyle='#FFB6C1'; ctx.fillRect(x+1,y+1,1,1); ctx.fillRect(x+3,y+1,1,1);
      ctx.fillStyle='#333'; ctx.fillRect(x+1,y+3,1,1); ctx.fillRect(x+3,y+3,1,1);
      ctx.fillStyle='#FFB6C1'; ctx.fillRect(x+2,y+4,1,1);
      break;
    case 'e05': {
      const rc=['#EF4444','#FACC15','#5A9E32','#64B5F6','#a78bfa'];
      for(let i=0;i<5;i++){
        ctx.fillStyle=rc[i];
        const ry = y + 4 - Math.round(Math.sqrt(Math.max(0, 4 - (i-2)*(i-2))) * 1.5);
        ctx.fillRect(x+i, ry, 1, y+5-ry);
      }
      break;
    }
    case 'e06':
      ctx.fillStyle='#E8A040'; ctx.fillRect(x,y+2,5,3);
      ctx.fillStyle='#6B4E0A'; ctx.fillRect(x,y+4,5,1);
      ctx.fillRect(x+1,y,3,2);
      ctx.fillStyle='#fff'; ctx.fillRect(x+1,y+3,3,1);
      break;
    case 'e07':
      ctx.fillStyle='#8B6544'; ctx.fillRect(x+2,y+2,1,3);
      ctx.fillStyle='#5A9E32'; ctx.fillRect(x,y,2,2); ctx.fillRect(x+1,y+1,1,1);
      ctx.fillStyle='#EF4444'; ctx.fillRect(x+3,y,2,2); ctx.fillRect(x+3,y+1,1,1);
      ctx.fillStyle='#8B6544'; ctx.fillRect(x+1,y+2,1,1); ctx.fillRect(x+3,y+2,1,1);
      break;
    case 'l01':
      ctx.fillStyle='#fbbf24'; ctx.fillRect(x+1,y,3,1); ctx.fillRect(x,y+1,5,2); ctx.fillRect(x+1,y+3,3,1);
      ctx.fillStyle='#92400e'; ctx.fillRect(x+2,y+1,1,1);
      ctx.fillStyle='#5A9E32'; ctx.fillRect(x+2,y+4,1,1);
      break;
    case 'l02':
      ctx.fillStyle='#fff'; ctx.fillRect(x+1,y+1,3,4);
      ctx.fillRect(x,y+3,1,2); ctx.fillRect(x+4,y+3,1,2);
      ctx.fillStyle='#a78bfa'; ctx.fillRect(x+3,y,1,2);
      ctx.fillStyle='#FFB6C1'; ctx.fillRect(x+1,y,2,1);
      ctx.fillStyle='#333'; ctx.fillRect(x+1,y+2,1,1);
      break;
    case 'l03': {
      ctx.fillStyle='#8B6544'; ctx.fillRect(x+2,y+3,1,2);
      const tc=['#EF4444','#FACC15','#5A9E32','#64B5F6','#a78bfa'];
      for(let i=0;i<5;i++){
        ctx.fillStyle=tc[(i+Math.floor(f*0.04))%5];
        ctx.fillRect(x+i, y+1-Math.round(Math.abs(i-2)*0.3), 1, 2);
      }
      ctx.fillStyle=tc[(Math.floor(f*0.04)+2)%5]; ctx.fillRect(x+1,y,3,1);
      break;
    }
    case 'l04':
      ctx.fillStyle='#fbbf24';
      ctx.fillRect(x+2,y,2,2);
      ctx.fillRect(x+2,y+3,2,1);
      ctx.fillRect(x+1,y+4,2,1);
      ctx.fillStyle='#fff';
      ctx.globalAlpha = 0.3 + Math.sin(f * 0.09) * 0.4;
      ctx.fillRect(x+3,y,1,1);
      ctx.globalAlpha = 1;
      break;
    default:
      ctx.fillStyle='#9ca3af'; ctx.fillRect(x+1,y+1,3,3);
  }
}

function drawPet(ctx: CanvasRenderingContext2D, petId: string, x: number, y: number, f: number) {
  const bounce = f % 30 < 15 ? 0 : -1;
  const py = y + bounce;
  if (petId === 'r01') {
    ctx.fillStyle='#E8A040'; ctx.fillRect(x,py+1,4,3);
    ctx.fillRect(x,py,1,1); ctx.fillRect(x+3,py,1,1);
    ctx.fillStyle='#333'; ctx.fillRect(x,py+2,1,1); ctx.fillRect(x+2,py+2,1,1);
    ctx.fillStyle='#E8A040'; ctx.fillRect(x+4,py+2,1,2);
  } else {
    ctx.fillStyle='#8B6544'; ctx.fillRect(x,py+1,4,3);
    ctx.fillRect(x-1,py+1,1,2); ctx.fillRect(x+4,py+1,1,2);
    ctx.fillStyle='#333'; ctx.fillRect(x,py+2,1,1); ctx.fillRect(x+2,py+2,1,1);
    ctx.fillStyle='#EF4444'; ctx.fillRect(x+1,py+4,1,1);
  }
}
