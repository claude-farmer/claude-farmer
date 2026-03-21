'use client';

import { useRef, useEffect, useCallback } from 'react';
import { FarmRenderer, type FarmRenderState } from '@/canvas/renderer';
import type { CropSlot } from '@claude-farmer/shared';

interface FarmCanvasProps {
  grid: (CropSlot | null)[];
  working?: boolean;
  className?: string;
}

export default function FarmCanvas({ grid, working = false, className }: FarmCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<FarmRenderer | null>(null);
  const rafRef = useRef<number>(0);

  const animate = useCallback(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    const state: FarmRenderState = { grid, characterWorking: working };
    renderer.render(state);

    rafRef.current = requestAnimationFrame(animate);
  }, [grid, working]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    rendererRef.current = new FarmRenderer(canvas);

    // ~12fps for pixel art feel
    const interval = setInterval(() => {
      const renderer = rendererRef.current;
      if (!renderer) return;
      renderer.render({ grid, characterWorking: working });
    }, 80);

    return () => {
      clearInterval(interval);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [grid, working]);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full max-w-[1024px] ${className ?? ''}`}
      style={{ aspectRatio: '256 / 192', imageRendering: 'pixelated' }}
    />
  );
}
