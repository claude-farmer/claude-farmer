'use client';

import { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { FarmRenderer, type FarmRenderState } from '@/canvas/renderer';
import type { CropSlot, Footprint } from '@claude-farmer/shared';

interface FarmCanvasProps {
  grid: (CropSlot | null)[];
  working?: boolean;
  className?: string;
  footprints?: Footprint[];
  farmOwnerId?: string;
}

export interface FarmCanvasHandle {
  triggerWaterAnim: (slotIndex: number) => void;
  triggerGrowthEffect: (slotIndex: number, boost?: boolean) => void;
  triggerPlantEffect: (slotIndex: number) => void;
  triggerHarvestParticles: (slotIndex: number, rarityColor: string) => void;
  triggerLegendaryHarvest: (slotIndex: number) => void;
  triggerLevelUp: (level: number) => void;
  triggerWaterReceivedEffect: (slotIndex: number, nickname?: string) => void;
}

const FarmCanvas = forwardRef<FarmCanvasHandle, FarmCanvasProps>(function FarmCanvas(
  { grid, working = false, className, footprints, farmOwnerId },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<FarmRenderer | null>(null);
  const rafRef = useRef<number>(0);
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  useImperativeHandle(ref, () => ({
    triggerWaterAnim: (slot) => rendererRef.current?.triggerWaterAnim(slot),
    triggerGrowthEffect: (slot, boost) => rendererRef.current?.triggerGrowthEffect(slot, boost),
    triggerPlantEffect: (slot) => rendererRef.current?.triggerPlantEffect(slot),
    triggerHarvestParticles: (slot, color) => rendererRef.current?.triggerHarvestParticles(slot, color),
    triggerLegendaryHarvest: (slot) => rendererRef.current?.triggerLegendaryHarvest(slot),
    triggerLevelUp: (level) => rendererRef.current?.triggerLevelUp(level),
    triggerWaterReceivedEffect: (slot, nick) => rendererRef.current?.triggerWaterReceivedEffect(slot, nick),
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    rendererRef.current = new FarmRenderer(canvas);

    // ~12fps for pixel art feel
    const interval = setInterval(() => {
      const renderer = rendererRef.current;
      if (!renderer) return;
      renderer.render({ grid, characterWorking: working, footprints, farmOwnerId });
    }, 80);

    return () => {
      clearInterval(interval);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [grid, working, footprints, farmOwnerId]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = 256 / rect.width;
    const scaleY = 192 / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;

    const fp = renderer.getFootprintAt(cx, cy);
    if (fp) {
      const hoursAgo = (Date.now() - new Date(fp.visited_at).getTime()) / (1000 * 60 * 60);
      const timeText = hoursAgo < 1 ? `${Math.floor(hoursAgo * 60)}m`
        : hoursAgo < 24 ? `${Math.floor(hoursAgo)}h`
        : 'yesterday';
      const waterText = fp.watered ? ' +' : '';
      setTooltip({
        text: `@${fp.nickname} · ${timeText}${waterText}`,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    } else {
      setTooltip(null);
    }
  }, []);

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className={`w-full max-w-[1024px] ${className ?? ''}`}
        style={{ aspectRatio: '256 / 192', imageRendering: 'pixelated' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap"
          style={{ left: tooltip.x + 8, top: tooltip.y - 24 }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
});

export default FarmCanvas;
