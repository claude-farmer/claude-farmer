'use client';

import { useRef, useEffect } from 'react';
import { prepareThumbnailScene, renderThumbnailFrame, THUMBNAIL_SIZE } from '@/canvas/thumbnailScene';
import type { CharacterAppearance, InventoryItem } from '@claude-farmer/shared';

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
    canvas.width = THUMBNAIL_SIZE;
    canvas.height = THUMBNAIL_SIZE;

    const scene = prepareThumbnailScene({
      githubId, character, level, uniqueItems, streakDays, inventory,
    });

    const interval = setInterval(() => {
      frameRef.current++;
      renderThumbnailFrame(ctx, scene, frameRef.current);
    }, 100);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [githubId, level, uniqueItems, streakDays, JSON.stringify(character ?? null), (inventory ?? []).map(i => i.id).join(',')]);

  return (
    <canvas
      ref={canvasRef}
      width={THUMBNAIL_SIZE}
      height={THUMBNAIL_SIZE}
      className={`rounded-lg ${className ?? ''}`}
      style={{
        width: '100%',
        aspectRatio: '1/1',
        imageRendering: 'pixelated',
      }}
    />
  );
}
