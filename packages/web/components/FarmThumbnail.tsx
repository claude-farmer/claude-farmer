'use client';

import { useRef, useEffect } from 'react';
import { composeCharacterSprite } from '@/canvas/character';
import { drawSprite } from '@/canvas/sprites';
import { RARITY_COLOR } from '@claude-farmer/shared';
import type { CharacterAppearance, InventoryItem } from '@claude-farmer/shared';

// 썸네일 사이즈: 64×64 pixel art
const SIZE = 64;

interface FarmThumbnailProps {
  character?: CharacterAppearance;
  level: number;
  totalHarvests: number;
  uniqueItems?: number;
  streakDays?: number;
  inventory?: InventoryItem[];
  className?: string;
}

// 레어리티별 미니 아이콘 (2×2 색 블록)
function drawItemDot(ctx: CanvasRenderingContext2D, x: number, y: number, rarity: string) {
  ctx.fillStyle = RARITY_COLOR[rarity as keyof typeof RARITY_COLOR] ?? '#9ca3af';
  ctx.fillRect(x, y, 2, 2);
}

export default function FarmThumbnail({
  character, level, totalHarvests, uniqueItems = 0, streakDays = 0, inventory = [], className,
}: FarmThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    canvas.width = SIZE;
    canvas.height = SIZE;

    const sprite = composeCharacterSprite(character);

    // 유니크 아이템 세트 (도감 진행도)
    const ownedIds = new Set(inventory.map(i => i.id));
    const rarityList = inventory.reduce((acc, item) => {
      if (!acc.find(a => a.id === item.id)) acc.push(item);
      return acc;
    }, [] as InventoryItem[]);

    const interval = setInterval(() => {
      frameRef.current++;
      const f = frameRef.current;
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.imageSmoothingEnabled = false;

      // ── 배경: 하늘 그라디언트 ──
      const grad = ctx.createLinearGradient(0, 0, 0, 20);
      grad.addColorStop(0, '#1B2838');
      grad.addColorStop(1, '#2a3a4a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, SIZE, 20);

      // 잔디 배경
      ctx.fillStyle = '#5A9E32';
      ctx.fillRect(0, 20, SIZE, SIZE - 20);
      ctx.fillStyle = '#4A8828';
      for (let x = 0; x < SIZE; x += 4) {
        for (let y = 20; y < SIZE; y += 4) {
          ctx.fillRect(x + (y % 3), y, 1, 1);
        }
      }

      // ── 성취 배경: 도감 아이템 (작은 점들로 스택) ──
      for (let i = 0; i < rarityList.length && i < 24; i++) {
        const col = i % 8;
        const row = Math.floor(i / 8);
        const dx = 2 + col * 7;
        const dy = 22 + row * 7;
        // 반투명 아이템 도트
        ctx.globalAlpha = 0.4 + (f % 60 < 30 && i === f % rarityList.length ? 0.3 : 0);
        drawItemDot(ctx, dx, dy, rarityList[i].rarity);
      }
      ctx.globalAlpha = 1;

      // ── 레벨 뱃지 (좌상단) ──
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(1, 1, 12, 7);
      ctx.fillStyle = '#000';
      // "Lv" 텍스트 (3×5 font 대신 간단한 표현)
      ctx.fillRect(2, 2, 1, 5); // L
      ctx.fillRect(3, 6, 2, 1);
      ctx.fillRect(6, 2, 1, 3); // V
      ctx.fillRect(7, 4, 1, 1);
      ctx.fillRect(8, 2, 1, 3);
      // 레벨 숫자 (간단한 도트)
      ctx.fillStyle = '#000';
      if (level >= 10) {
        ctx.fillRect(10, 3, 1, 4);
        ctx.fillRect(11, 3, 1, 4);
      } else {
        ctx.fillRect(10, 3, 1, 4);
      }

      // ── 모닥불 (연속 스트릭, 우하단) ──
      if (streakDays > 0) {
        const bx = SIZE - 8;
        const by = SIZE - 10;
        ctx.fillStyle = '#8B6544';
        ctx.fillRect(bx, by + 5, 5, 2);
        if (streakDays >= 7) {
          ctx.fillStyle = streakDays >= 30 ? '#60a5fa' : '#EF4444';
          ctx.fillRect(bx + 1, by + 1, 3, 4);
          ctx.fillStyle = streakDays >= 30 ? '#93c5fd' : '#FACC15';
          ctx.fillRect(bx + 1, by, 2, 2);
          // 파티클
          ctx.globalAlpha = 0.5 + Math.sin(f * 0.1) * 0.3;
          ctx.fillRect(bx + 1 + (f % 3), by - 2, 1, 1);
          ctx.globalAlpha = 1;
        } else if (streakDays >= 3) {
          ctx.fillStyle = '#EF4444';
          ctx.fillRect(bx + 1, by + 3, 2, 2);
          ctx.fillStyle = '#FACC15';
          ctx.fillRect(bx + 2, by + 2, 1, 1);
        } else {
          ctx.fillStyle = '#EF4444';
          ctx.globalAlpha = 0.5 + Math.sin(f * 0.06) * 0.3;
          ctx.fillRect(bx + 2, by + 4, 1, 1);
          ctx.globalAlpha = 1;
        }
      }

      // ── 수확 게이지 (우상단, 작은 바) ──
      const barW = 14;
      const barX = SIZE - barW - 2;
      ctx.fillStyle = '#333';
      ctx.fillRect(barX, 2, barW, 3);
      const fill = Math.min(1, uniqueItems / 32);
      ctx.fillStyle = fill >= 1 ? '#fbbf24' : '#4ade80';
      ctx.fillRect(barX, 2, Math.round(barW * fill), 3);

      // ── 캐릭터 (중앙, 2배 스케일 = 32×32) ──
      const charX = (SIZE - 32) / 2;
      const charY = 14 + (f % 40 < 20 ? 0 : -1); // 바운스
      drawSprite(ctx, sprite, charX, charY, 2);

      // ── 별 (밤 반짝임) ──
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = 0.6;
      if (f % 50 < 30) ctx.fillRect(5, 5, 1, 1);
      if (f % 50 < 40) ctx.fillRect(50, 3, 1, 1);
      if (f % 60 < 25) ctx.fillRect(30, 8, 1, 1);
      ctx.globalAlpha = 1;

    }, 100); // 10fps (가벼운 애니메이션)

    return () => clearInterval(interval);
  }, [character, level, totalHarvests, uniqueItems, streakDays, inventory]);

  return (
    <canvas
      ref={canvasRef}
      className={`rounded-lg ${className ?? ''}`}
      style={{ width: '100%', aspectRatio: '1/1', imageRendering: 'pixelated' }}
    />
  );
}
