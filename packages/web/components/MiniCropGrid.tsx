'use client';

import type { CropSlot } from '@claude-farmer/shared';

const CROP_COLORS: Record<string, string> = {
  carrot: '#FF8C00',
  tomato: '#EF4444',
  sunflower: '#FACC15',
  strawberry: '#FF6B81',
  pumpkin: '#F97316',
  radish: '#FBB6CE',
};

const STAGE_OPACITY = [0.2, 0.4, 0.7, 1.0];

interface MiniCropGridProps {
  grid: (CropSlot | null)[];
  className?: string;
}

export default function MiniCropGrid({ grid, className }: MiniCropGridProps) {
  return (
    <div className={`grid grid-cols-4 gap-px bg-[#6B4E0A] rounded overflow-hidden ${className ?? ''}`}>
      {grid.slice(0, 16).map((slot, i) => (
        <div
          key={i}
          className="aspect-square"
          style={{
            backgroundColor: slot
              ? CROP_COLORS[slot.crop] ?? '#7BC74D'
              : '#8B6914',
            opacity: slot ? STAGE_OPACITY[slot.stage] ?? 1 : 1,
          }}
        />
      ))}
    </div>
  );
}
