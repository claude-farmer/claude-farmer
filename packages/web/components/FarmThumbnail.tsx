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

      // ── 수집품을 땅 위에 배치 ──
      const groundY2 = 22;
      const decoSlots = [
        // 좌측 잔디
        { x: 3, y: groundY2 + 24 }, { x: 12, y: groundY2 + 32 },
        { x: 5, y: groundY2 + 38 }, { x: 14, y: groundY2 + 18 },
        { x: 2, y: groundY2 + 10 }, { x: 10, y: groundY2 + 6 },
        // 우측 잔디
        { x: 48, y: groundY2 + 24 }, { x: 54, y: groundY2 + 32 },
        { x: 50, y: groundY2 + 38 }, { x: 58, y: groundY2 + 18 },
        { x: 46, y: groundY2 + 10 }, { x: 56, y: groundY2 + 6 },
        // 하단
        { x: 20, y: groundY2 + 36 }, { x: 38, y: groundY2 + 36 },
        { x: 28, y: groundY2 + 38 },
      ];
      // 레어리티 순 정렬 (legendary 우선)
      const rarityOrder: Record<string, number> = { legendary: 0, epic: 1, rare: 2, common: 3 };
      const sorted = [...uniqueInventory].sort((a, b) => (rarityOrder[a.rarity] ?? 4) - (rarityOrder[b.rarity] ?? 4));
      for (let i = 0; i < sorted.length && i < decoSlots.length; i++) {
        const slot = decoSlots[i];
        const color = RARITY_COLOR[sorted[i].rarity] ?? '#9ca3af';
        // 미니 아이템 아이콘 (3×3 + 레어리티 색상)
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.7;
        ctx.fillRect(slot.x, slot.y, 3, 3);
        // 레전더리/에픽은 하이라이트
        if (sorted[i].rarity === 'legendary' || sorted[i].rarity === 'epic') {
          ctx.fillStyle = '#fff';
          ctx.globalAlpha = 0.3 + Math.sin(f * 0.08 + i) * 0.2;
          ctx.fillRect(slot.x, slot.y, 1, 1);
        }
        ctx.globalAlpha = 1;
      }

      // ── 캐릭터 (2배 스케일 = 32×32, 중앙) ──
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
