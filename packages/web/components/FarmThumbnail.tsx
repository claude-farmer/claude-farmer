'use client';

import { useRef, useEffect } from 'react';
import { composeCharacterSprite } from '@/canvas/character';
import { drawSprite } from '@/canvas/sprites';
import { RARITY_COLOR, generateDefaultAppearance } from '@claude-farmer/shared';
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

    // 캐릭터 설정이 없으면 githubId 기반 자동 생성
    const appearance = character ?? generateDefaultAppearance(githubId ?? 'default');
    const sprite = composeCharacterSprite(appearance);

    // 유니크 아이템 (중복 제거)
    const seen = new Set<string>();
    const uniqueInventory: InventoryItem[] = [];
    for (const item of inventory) {
      if (!seen.has(item.id)) { seen.add(item.id); uniqueInventory.push(item); }
    }

    const interval = setInterval(() => {
      frameRef.current++;
      const f = frameRef.current;
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.imageSmoothingEnabled = false;

      // ── 배경 ──
      const grad = ctx.createLinearGradient(0, 0, 0, 22);
      grad.addColorStop(0, '#1B2838');
      grad.addColorStop(1, '#2a3a4a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, SIZE, 22);

      // 잔디
      ctx.fillStyle = '#5A9E32';
      ctx.fillRect(0, 22, SIZE, SIZE - 22);
      ctx.fillStyle = '#4A8828';
      for (let x = 0; x < SIZE; x += 5) {
        for (let y = 22; y < SIZE; y += 5) {
          ctx.fillRect(x + (y % 3), y, 1, 1);
        }
      }

      // ── 성취 도트 (배경에 깔리는 도감 아이템) ──
      for (let i = 0; i < uniqueInventory.length && i < 32; i++) {
        const col = i % 8;
        const row = Math.floor(i / 8);
        const dx = 2 + col * 7;
        const dy = 24 + row * 7;
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = RARITY_COLOR[uniqueInventory[i].rarity] ?? '#9ca3af';
        ctx.fillRect(dx, dy, 3, 3);
      }
      ctx.globalAlpha = 1;

      // ── 캐릭터 (2배 스케일 = 32×32, 중앙) ──
      const charX = (SIZE - 32) / 2;
      const charY = 12 + (f % 40 < 20 ? 0 : -1);
      drawSprite(ctx, sprite, charX, charY, 2);

      // ── 레벨 뱃지 (좌상단) ──
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(1, 1, 16, 8);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(2, 2, 14, 6);
      ctx.fillStyle = '#000';
      // "Lv" + number in minimal pixel font
      ctx.font = '7px monospace';
      ctx.textBaseline = 'top';
      ctx.fillText(`${level}`, 4, 2);

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
        const bx = SIZE - 9;
        const by = SIZE - 11;
        ctx.fillStyle = '#8B6544';
        ctx.fillRect(bx, by + 5, 5, 2);
        if (streakDays >= 30) {
          ctx.fillStyle = '#60a5fa';
          ctx.fillRect(bx + 1, by + 1, 3, 4);
          ctx.fillStyle = '#93c5fd';
          ctx.fillRect(bx + 1, by - 1, 2, 2);
        } else if (streakDays >= 7) {
          ctx.fillStyle = '#EF4444';
          ctx.fillRect(bx + 1, by + 1, 3, 4);
          ctx.fillStyle = '#FACC15';
          ctx.fillRect(bx + 1, by, 2, 2);
        } else if (streakDays >= 3) {
          ctx.fillStyle = '#EF4444';
          ctx.fillRect(bx + 1, by + 3, 2, 2);
        } else {
          ctx.fillStyle = '#EF4444';
          ctx.globalAlpha = 0.5 + Math.sin(f * 0.06) * 0.3;
          ctx.fillRect(bx + 2, by + 4, 1, 1);
          ctx.globalAlpha = 1;
        }
      }

      // ── 별 반짝임 ──
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
