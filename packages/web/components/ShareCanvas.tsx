'use client';

import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { prepareThumbnailScene, renderThumbnailFrame, THUMBNAIL_SIZE } from '@/canvas/thumbnailScene';
import type { CharacterAppearance, InventoryItem } from '@claude-farmer/shared';

const SHARE_SIZE = 800;
const THUMB_SCALE = 8; // 64 → 512
const THUMB_DRAWN = THUMBNAIL_SIZE * THUMB_SCALE; // 512

interface ShareCanvasProps {
  username: string;
  nickname: string;
  level: number;
  totalHarvests: number;
  uniqueItems: number;
  streakDays: number;
  inventory: InventoryItem[];
  character?: CharacterAppearance;
  statusText?: string;
}

export interface ShareCanvasHandle {
  getBlob: () => Promise<Blob | null>;
}

const ShareCanvas = forwardRef<ShareCanvasHandle, ShareCanvasProps>(function ShareCanvas(
  { username, nickname, level, totalHarvests, uniqueItems, streakDays, inventory, character, statusText },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useImperativeHandle(ref, () => ({
    getBlob: () =>
      new Promise<Blob | null>(resolve => {
        const canvas = canvasRef.current;
        if (!canvas) return resolve(null);
        canvas.toBlob(b => resolve(b), 'image/png');
      }),
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = SHARE_SIZE;
    canvas.height = SHARE_SIZE;

    // ── 배경 그라디언트 ──
    const bg = ctx.createLinearGradient(0, 0, 0, SHARE_SIZE);
    bg.addColorStop(0, '#1a1d27');
    bg.addColorStop(0.5, '#232736');
    bg.addColorStop(1, '#2a3a4a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, SHARE_SIZE, SHARE_SIZE);

    // ── 상단 브랜딩 ──
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 32px -apple-system, "Segoe UI", "Apple SD Gothic Neo", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText('Claude Farmer', 48, 56);

    ctx.fillStyle = '#9ca3af';
    ctx.font = '24px -apple-system, "Segoe UI", "Apple SD Gothic Neo", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`@${username}`, SHARE_SIZE - 48, 56);

    // ── 상단 디바이더 ──
    ctx.fillStyle = '#2a2d3a';
    ctx.fillRect(48, 96, SHARE_SIZE - 96, 1);

    // ── 중앙: 썸네일 씬 (8× nearest-neighbor blit) ──
    // 오프스크린에 64×64 그린 후 메인에 512로 확대
    const off = document.createElement('canvas');
    off.width = THUMBNAIL_SIZE;
    off.height = THUMBNAIL_SIZE;
    const offCtx = off.getContext('2d');
    if (offCtx) {
      const scene = prepareThumbnailScene({
        githubId: username, character, level, uniqueItems, streakDays, inventory,
      });
      // 정적 프레임 (애니메이션 중간 상태로 보이는 16프레임)
      renderThumbnailFrame(offCtx, scene, 16);

      const thumbX = (SHARE_SIZE - THUMB_DRAWN) / 2;
      const thumbY = 130;

      // 카드 프레임
      ctx.fillStyle = '#0f1117';
      ctx.fillRect(thumbX - 8, thumbY - 8, THUMB_DRAWN + 16, THUMB_DRAWN + 16);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.strokeRect(thumbX - 8, thumbY - 8, THUMB_DRAWN + 16, THUMB_DRAWN + 16);

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, thumbX, thumbY, THUMB_DRAWN, THUMB_DRAWN);
    }

    // ── 하단: 닉네임 + 통계 + 상태 ──
    const bottomY = 130 + THUMB_DRAWN + 40;

    // 닉네임
    ctx.fillStyle = '#e5e7eb';
    ctx.font = 'bold 36px -apple-system, "Segoe UI", "Apple SD Gothic Neo", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(nickname, 48, bottomY);

    // 통계 row (Lv 포함)
    const statY = bottomY + 44;
    ctx.fillStyle = '#9ca3af';
    ctx.font = '22px -apple-system, "Segoe UI", "Apple SD Gothic Neo", sans-serif';
    const stats = [
      `Lv.${level}`,
      `Harvests ${totalHarvests}`,
      `Codex ${uniqueItems}/32`,
    ];
    if (streakDays > 0) stats.push(`Streak ${streakDays}d`);
    ctx.fillText(stats.join('  ·  '), 48, statY);

    // 상태 메시지 (있을 때만)
    if (statusText) {
      ctx.fillStyle = '#6b7280';
      ctx.font = 'italic 20px -apple-system, "Segoe UI", "Apple SD Gothic Neo", sans-serif';
      const truncated = statusText.length > 60 ? statusText.slice(0, 60) + '…' : statusText;
      ctx.fillText(`"${truncated}"`, 48, statY + 32);
    }

    // 우하단: URL
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 20px -apple-system, "Segoe UI", "Apple SD Gothic Neo", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`claudefarmer.com/@${username}`, SHARE_SIZE - 48, SHARE_SIZE - 32);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, nickname, level, totalHarvests, uniqueItems, streakDays, character, statusText, inventory.map(i => i.id).join(',')]);

  return (
    <canvas
      ref={canvasRef}
      width={SHARE_SIZE}
      height={SHARE_SIZE}
      className="rounded-lg w-full"
      style={{
        aspectRatio: '1/1',
        imageRendering: 'pixelated',
      }}
    />
  );
});

export default ShareCanvas;
