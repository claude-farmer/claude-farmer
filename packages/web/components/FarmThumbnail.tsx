'use client';

import { useRef, useEffect } from 'react';
import { composeCharacterSprite } from '@/canvas/character';
import { drawSprite } from '@/canvas/sprites';
import { generateDefaultAppearance } from '@claude-farmer/shared';
import type { CharacterAppearance, InventoryItem } from '@claude-farmer/shared';

const SIZE = 64;

interface FarmThumbnailProps {
  githubId?: string;
  character?: CharacterAppearance;
  level: number;
  totalHarvests: number;
  uniqueItems?: number;
  streakDays?: number;
  inventory?: InventoryItem[];
  className?: string;
}

// 아이템별 미니 스프라이트 그리기 (4×4~5×5, 구체적 형태)
function drawItemIcon(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, frame: number) {
  switch (id) {
    // Common
    case 'c01': // 돌멩이
      ctx.fillStyle = '#b0b8c4'; ctx.fillRect(x+1,y+1,3,2); ctx.fillRect(x,y+2,4,1);
      ctx.fillStyle = '#d0d8e4'; ctx.fillRect(x+2,y+1,1,1);
      break;
    case 'c02': // 나뭇가지
      ctx.fillStyle = '#8B6544'; ctx.fillRect(x,y+2,4,1); ctx.fillRect(x+3,y+1,1,1);
      ctx.fillStyle = '#5A9E32'; ctx.fillRect(x+3,y,2,1);
      break;
    case 'c03': // 잡초
      ctx.fillStyle = '#5A9E32'; ctx.fillRect(x+1,y+1,1,3); ctx.fillRect(x+3,y,1,4); ctx.fillRect(x+2,y+2,1,2);
      break;
    case 'c04': // 지렁이
      ctx.fillStyle = '#FFB6C1'; ctx.fillRect(x,y+2,1,1); ctx.fillRect(x+1,y+3,1,1); ctx.fillRect(x+2,y+2,1,1); ctx.fillRect(x+3,y+3,1,1);
      ctx.fillStyle = '#333'; ctx.fillRect(x,y+1,1,1);
      break;
    case 'c05': // 물뿌리개
      ctx.fillStyle = '#5A9E32'; ctx.fillRect(x,y+1,3,2); ctx.fillRect(x+3,y,1,2);
      ctx.fillStyle = '#64B5F6'; ctx.fillRect(x+3,y+2,1,1);
      break;
    case 'c06': // 울타리
      ctx.fillStyle = '#A0724A'; ctx.fillRect(x,y,1,4); ctx.fillRect(x+2,y,1,4); ctx.fillRect(x+4,y,1,4);
      ctx.fillRect(x,y+1,5,1);
      break;
    case 'c07': // 돌길
      ctx.fillStyle = '#C4A97D'; ctx.fillRect(x,y+1,4,3); ctx.fillStyle='#B8956E'; ctx.fillRect(x+1,y+2,2,1);
      break;
    case 'c08': // 잔디
      ctx.fillStyle = '#6BBF3B'; ctx.fillRect(x+1,y+1,1,3); ctx.fillRect(x+2,y,1,4); ctx.fillRect(x+3,y+1,1,3);
      break;
    case 'c09': // 버섯
      ctx.fillStyle = '#EF4444'; ctx.fillRect(x+1,y,3,2); ctx.fillStyle='#fff'; ctx.fillRect(x+2,y,1,1);
      ctx.fillStyle = '#F5E6D3'; ctx.fillRect(x+2,y+2,1,2);
      break;
    case 'c10': // 고무오리
      ctx.fillStyle = '#FACC15'; ctx.fillRect(x+1,y,3,3); ctx.fillRect(x,y+1,1,1);
      ctx.fillStyle = '#E8A040'; ctx.fillRect(x,y+2,1,1);
      ctx.fillStyle = '#333'; ctx.fillRect(x+2,y,1,1);
      break;
    case 'c11': // 세그폴트
      ctx.fillStyle = '#555'; ctx.fillRect(x,y+3,4,1); ctx.fillRect(x+1,y+2,1,1); ctx.fillRect(x+3,y+1,1,2);
      ctx.fillStyle = '#EF4444'; ctx.fillRect(x+2,y+2,1,1);
      break;
    case 'c12': // TODO 메모
      ctx.fillStyle = '#FACC15'; ctx.fillRect(x,y,4,4); ctx.fillStyle='#8B6544'; ctx.fillRect(x+1,y+1,2,1); ctx.fillRect(x+1,y+3,1,1);
      break;
    // Rare
    case 'r01': // 고양이
      ctx.fillStyle = '#E8A040'; ctx.fillRect(x+1,y+1,3,3); ctx.fillRect(x+1,y,1,1); ctx.fillRect(x+3,y,1,1);
      ctx.fillStyle = '#333'; ctx.fillRect(x+1,y+2,1,1); ctx.fillRect(x+3,y+2,1,1);
      ctx.fillStyle = '#FFB6C1'; ctx.fillRect(x+2,y+3,1,1);
      break;
    case 'r02': // 강아지
      ctx.fillStyle = '#8B6544'; ctx.fillRect(x+1,y+1,3,3); ctx.fillRect(x,y,1,2); ctx.fillRect(x+4,y,1,2);
      ctx.fillStyle = '#333'; ctx.fillRect(x+1,y+2,1,1); ctx.fillRect(x+3,y+2,1,1);
      ctx.fillStyle = '#EF4444'; ctx.fillRect(x+2,y+4,1,1);
      break;
    case 'r03': // 꽃밭
      ctx.fillStyle='#FF6B81'; ctx.fillRect(x,y,2,2); ctx.fillStyle='#FACC15'; ctx.fillRect(x+2,y,2,2);
      ctx.fillStyle='#a78bfa'; ctx.fillRect(x,y+2,2,2); ctx.fillStyle='#fff'; ctx.fillRect(x+2,y+2,2,2);
      ctx.fillStyle='#5A9E32'; ctx.fillRect(x+1,y+1,1,1); ctx.fillRect(x+3,y+3,1,1);
      break;
    case 'r04': // 연못
      ctx.fillStyle = '#64B5F6'; ctx.fillRect(x+1,y+1,3,2); ctx.fillRect(x,y+2,4,1);
      ctx.fillStyle = '#42A5F5'; ctx.fillRect(x+2,y+1,1,1);
      ctx.fillStyle = '#5A9E32'; ctx.fillRect(x,y,2,1);
      break;
    case 'r05': // 벤치
      ctx.fillStyle = '#A0724A'; ctx.fillRect(x,y+1,5,1); ctx.fillRect(x,y+2,1,2); ctx.fillRect(x+4,y+2,1,2);
      ctx.fillRect(x+1,y+3,3,1);
      break;
    case 'r06': // 우체통
      ctx.fillStyle = '#EF4444'; ctx.fillRect(x+1,y,3,3); ctx.fillStyle='#8B6544'; ctx.fillRect(x+2,y+3,1,2);
      ctx.fillStyle='#fff'; ctx.fillRect(x+2,y+1,1,1);
      break;
    case 'r07': // 가로등
      ctx.fillStyle = '#888'; ctx.fillRect(x+2,y+1,1,4);
      ctx.fillStyle = '#FACC15';
      ctx.globalAlpha = 0.6 + Math.sin(frame * 0.08) * 0.3;
      ctx.fillRect(x+1,y,3,2);
      ctx.globalAlpha = 1;
      break;
    case 'r08': // 404 허수아비
      ctx.fillStyle = '#8B6544'; ctx.fillRect(x+2,y+2,1,3); ctx.fillRect(x,y+2,5,1);
      ctx.fillStyle = '#F5E6D3'; ctx.fillRect(x+1,y,3,2);
      ctx.fillStyle = '#a78bfa'; ctx.fillRect(x+2,y,1,1);
      break;
    case 'r09': // 커피잔
      ctx.fillStyle = '#F5E6D3'; ctx.fillRect(x+1,y+1,3,3); ctx.fillRect(x+4,y+2,1,1);
      ctx.fillStyle = '#8B6544'; ctx.fillRect(x+2,y+4,1,1);
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = 0.4 + Math.sin(frame * 0.06) * 0.3;
      ctx.fillRect(x+2,y,1,1); ctx.fillRect(x+1,y-1,1,1);
      ctx.globalAlpha = 1;
      break;
    // Epic
    case 'e01': // 분수대
      ctx.fillStyle = '#9ca3af'; ctx.fillRect(x,y+3,5,2); ctx.fillRect(x+1,y+1,3,2);
      ctx.fillStyle = '#64B5F6';
      ctx.globalAlpha = 0.6 + Math.sin(frame * 0.1) * 0.3;
      ctx.fillRect(x+2,y,1,2);
      ctx.globalAlpha = 1;
      break;
    case 'e02': // 풍차
      ctx.fillStyle = '#A0724A'; ctx.fillRect(x+2,y+2,1,3);
      ctx.fillStyle = '#F5E6D3';
      const a = frame * 0.04;
      ctx.fillRect(x+2+Math.round(Math.cos(a)*2), y+1, 1, 1);
      ctx.fillRect(x+2+Math.round(Math.sin(a)*2), y+1, 1, 1);
      ctx.fillRect(x+2-Math.round(Math.cos(a)*2), y+3, 1, 1);
      break;
    case 'e03': // 사과나무
      ctx.fillStyle = '#8B6544'; ctx.fillRect(x+2,y+3,1,2);
      ctx.fillStyle = '#5A9E32'; ctx.fillRect(x+1,y+1,3,3);
      ctx.fillStyle = '#EF4444'; ctx.fillRect(x+1,y+1,1,1); ctx.fillRect(x+3,y+2,1,1);
      break;
    case 'e04': // 토끼
      ctx.fillStyle = '#fff'; ctx.fillRect(x+1,y+1,3,3); ctx.fillRect(x+1,y,1,1); ctx.fillRect(x+3,y,1,1);
      ctx.fillStyle = '#FFB6C1'; ctx.fillRect(x+2,y+2,1,1);
      ctx.fillStyle = '#333'; ctx.fillRect(x+1,y+2,1,1); ctx.fillRect(x+3,y+2,1,1);
      break;
    case 'e05': // 무지개
      const rc = ['#EF4444','#FACC15','#5A9E32','#64B5F6','#a78bfa'];
      for (let i = 0; i < 5; i++) { ctx.fillStyle = rc[i]; ctx.fillRect(x+i, y+3-Math.round(Math.abs(i-2)*0.7), 1, 1); }
      break;
    case 'e06': // 스택오버플로우
      ctx.fillStyle = '#E8A040'; ctx.fillRect(x,y+1,4,4);
      ctx.fillStyle = '#60a5fa'; ctx.fillRect(x+1,y+2,1,1); ctx.fillRect(x+3,y+3,1,1);
      ctx.fillRect(x+1,y,3,1);
      break;
    case 'e07': // Git 가지
      ctx.fillStyle = '#8B6544'; ctx.fillRect(x+2,y+2,1,3);
      ctx.fillStyle = '#5A9E32'; ctx.fillRect(x,y,2,3);
      ctx.fillStyle = '#EF4444'; ctx.fillRect(x+3,y,2,3);
      break;
    // Legendary
    case 'l01': // 황금 해바라기
      ctx.fillStyle = '#fbbf24'; ctx.fillRect(x+1,y,3,1); ctx.fillRect(x,y+1,5,2); ctx.fillRect(x+1,y+3,3,1);
      ctx.fillStyle = '#8B6544'; ctx.fillRect(x+2,y+4,1,1);
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = 0.4 + Math.sin(frame * 0.07) * 0.4;
      ctx.fillRect(x,y,1,1); ctx.fillRect(x+4,y,1,1);
      ctx.globalAlpha = 1;
      break;
    case 'l02': // 유니콘
      ctx.fillStyle = '#fff'; ctx.fillRect(x+1,y+1,3,4); ctx.fillRect(x,y+3,1,2);
      ctx.fillStyle = '#a78bfa'; ctx.fillRect(x+3,y,1,2);
      ctx.fillStyle = '#FFB6C1'; ctx.fillRect(x+2,y+1,1,1);
      ctx.fillStyle = '#333'; ctx.fillRect(x+1,y+2,1,1);
      break;
    case 'l03': // 오로라 나무
      ctx.fillStyle = '#8B6544'; ctx.fillRect(x+2,y+3,1,2);
      const tc = ['#EF4444','#FACC15','#5A9E32','#64B5F6','#a78bfa'];
      for (let i = 0; i < 5; i++) { ctx.fillStyle = tc[(i + Math.floor(frame * 0.03)) % 5]; ctx.fillRect(x+i,y+1+Math.round(Math.abs(i-2)*0.4),1,2); }
      break;
    case 'l04': // 황금 세미콜론
      ctx.fillStyle = '#fbbf24'; ctx.fillRect(x+2,y,1,3); ctx.fillRect(x+2,y+4,1,1); ctx.fillRect(x+1,y+3,1,1);
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = 0.3 + Math.sin(frame * 0.09) * 0.4;
      ctx.fillRect(x+3,y,1,1); ctx.fillRect(x+1,y+1,1,1);
      ctx.globalAlpha = 1;
      break;
    default:
      ctx.fillStyle = '#9ca3af'; ctx.fillRect(x+1,y+1,3,3);
  }
}

export default function FarmThumbnail({
  githubId, character, level, uniqueItems = 0, streakDays = 0, inventory = [], className,
}: FarmThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    canvas.width = SIZE;
    canvas.height = SIZE;

    const appearance = character ?? generateDefaultAppearance(githubId ?? 'default');
    const sprite = composeCharacterSprite(appearance);

    // 유니크 아이템
    const seen = new Set<string>();
    const uniqueInv: InventoryItem[] = [];
    for (const item of inventory) {
      if (!seen.has(item.id)) { seen.add(item.id); uniqueInv.push(item); }
    }
    // 레어리티 순 정렬
    const rarityOrder: Record<string, number> = { legendary: 0, epic: 1, rare: 2, common: 3 };
    const sorted = [...uniqueInv].sort((a, b) => (rarityOrder[a.rarity] ?? 4) - (rarityOrder[b.rarity] ?? 4));

    const interval = setInterval(() => {
      frameRef.current++;
      const f = frameRef.current;
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.imageSmoothingEnabled = false;

      // ── 하늘 ──
      const grad = ctx.createLinearGradient(0, 0, 0, 22);
      grad.addColorStop(0, '#1B2838');
      grad.addColorStop(1, '#2a3a4a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, SIZE, 22);

      // ── 잔디 ──
      ctx.fillStyle = '#5A9E32';
      ctx.fillRect(0, 22, SIZE, SIZE - 22);
      ctx.fillStyle = '#4A8828';
      for (let x = 0; x < SIZE; x += 5) {
        for (let y = 22; y < SIZE; y += 5) {
          ctx.fillRect(x + (y % 3), y, 1, 1);
        }
      }

      // ── 레벨 기반 배경 장식 ──
      if (level >= 3) {
        // 작은 꽃들
        const flowerColors = ['#FF6B81', '#FACC15', '#a78bfa', '#fff'];
        for (let i = 0; i < Math.min(level, 8); i++) {
          const fx = (i * 13 + 5) % (SIZE - 6) + 2;
          const fy = 24 + (i * 17) % 34;
          ctx.fillStyle = '#5A9E32';
          ctx.fillRect(fx, fy + 1, 1, 2);
          ctx.fillStyle = flowerColors[i % flowerColors.length];
          ctx.fillRect(fx, fy, 1, 1);
          ctx.fillRect(fx - 1, fy, 1, 1);
          ctx.fillRect(fx + 1, fy, 1, 1);
        }
      }
      if (level >= 5) {
        // 흙길
        ctx.fillStyle = '#C4A97D';
        ctx.fillRect(28, 50, 8, 14);
        ctx.fillStyle = '#B8956E';
        ctx.fillRect(29, 52, 2, 1); ctx.fillRect(31, 56, 2, 1);
      }
      if (level >= 7) {
        // 미니 울타리 (하단)
        ctx.fillStyle = '#A0724A';
        for (let fx = 4; fx < 60; fx += 8) {
          ctx.fillRect(fx, 58, 1, 4);
          ctx.fillRect(fx, 59, 6, 1);
        }
      }

      // ── 수집품 (땅 위에 구체적 아이템 스프라이트) ──
      const decoSlots = [
        { x: 2, y: 28 }, { x: 10, y: 36 }, { x: 4, y: 44 }, { x: 12, y: 24 },
        { x: 48, y: 28 }, { x: 55, y: 36 }, { x: 50, y: 44 }, { x: 57, y: 24 },
        { x: 20, y: 50 }, { x: 38, y: 50 }, { x: 8, y: 52 }, { x: 52, y: 52 },
      ];
      for (let i = 0; i < sorted.length && i < decoSlots.length; i++) {
        const s = decoSlots[i];
        drawItemIcon(ctx, sorted[i].id, s.x, s.y, f);
      }

      // ── 캐릭터 (2× 스케일, 중앙) ──
      const charX = (SIZE - 32) / 2;
      const charY = 12 + (f % 40 < 20 ? 0 : -1);
      drawSprite(ctx, sprite, charX, charY, 2);

      // ── 도감 진행 바 (우상단) ──
      const barW = 14;
      const barX = SIZE - barW - 2;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(barX - 1, 1, barW + 2, 5);
      ctx.fillStyle = '#333';
      ctx.fillRect(barX, 2, barW, 3);
      const fill = Math.min(1, uniqueItems / 32);
      ctx.fillStyle = fill >= 1 ? '#fbbf24' : '#4ade80';
      ctx.fillRect(barX, 2, Math.round(barW * fill), 3);

      // ── 모닥불 (우하단) ──
      if (streakDays > 0) {
        const bx = SIZE - 9, by = SIZE - 11;
        ctx.fillStyle = '#8B6544';
        ctx.fillRect(bx, by + 5, 5, 2);
        if (streakDays >= 30) {
          ctx.fillStyle = '#60a5fa'; ctx.fillRect(bx+1,by+1,3,4);
          ctx.fillStyle = '#93c5fd'; ctx.fillRect(bx+1,by-1,2,2);
        } else if (streakDays >= 7) {
          ctx.fillStyle = '#EF4444'; ctx.fillRect(bx+1,by+1,3,4);
          ctx.fillStyle = '#FACC15'; ctx.fillRect(bx+1,by,2,2);
        } else if (streakDays >= 3) {
          ctx.fillStyle = '#EF4444'; ctx.fillRect(bx+1,by+3,2,2);
        } else {
          ctx.fillStyle = '#EF4444';
          ctx.globalAlpha = 0.5 + Math.sin(f * 0.06) * 0.3;
          ctx.fillRect(bx+2,by+4,1,1);
          ctx.globalAlpha = 1;
        }
      }

      // ── 별 ──
      ctx.fillStyle = '#fff';
      if (f % 50 < 25) { ctx.globalAlpha = 0.6; ctx.fillRect(5, 6, 1, 1); }
      if (f % 60 < 30) { ctx.globalAlpha = 0.5; ctx.fillRect(50, 4, 1, 1); }
      if (f % 45 < 20) { ctx.globalAlpha = 0.4; ctx.fillRect(30, 9, 1, 1); }
      ctx.globalAlpha = 1;

    }, 100);

    return () => clearInterval(interval);
  }, [character, githubId, level, uniqueItems, streakDays, inventory]);

  return (
    <canvas
      ref={canvasRef}
      className={`rounded-lg ${className ?? ''}`}
      style={{ width: '100%', aspectRatio: '1/1', imageRendering: 'pixelated' }}
    />
  );
}
