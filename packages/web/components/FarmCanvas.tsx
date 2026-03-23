'use client';

import { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { FarmRenderer, type FarmRenderState } from '@/canvas/renderer';
import { screenToWorld, zoomAtPoint } from '@/canvas/camera';
import type { CropSlot, Footprint, CharacterAppearance } from '@claude-farmer/shared';

interface FarmCanvasProps {
  grid: (CropSlot | null)[];
  working?: boolean;
  className?: string;
  footprints?: Footprint[];
  farmOwnerId?: string;
  clickToMove?: boolean; // 클릭으로 캐릭터 이동 (기본 true)
  // 유저 정보 (하단 패널 + 말풍선용)
  ownerNickname?: string;
  ownerLevel?: number;
  ownerStatusText?: string;
  ownerStatusLink?: string;
  ownerTotalHarvests?: number;
  ownerUniqueItems?: number;
  ownerCharacter?: CharacterAppearance;
  visitorProfiles?: Map<string, { nickname: string; level?: number; statusText?: string; statusLink?: string; totalHarvests?: number; character?: CharacterAppearance }>;
  onVisitFarm?: (userId: string) => void;
}

export interface FarmCanvasHandle {
  triggerWaterAnim: (slotIndex: number) => void;
  triggerGrowthEffect: (slotIndex: number, boost?: boolean) => void;
  triggerPlantEffect: (slotIndex: number) => void;
  triggerHarvestParticles: (slotIndex: number, rarityColor: string) => void;
  triggerLegendaryHarvest: (slotIndex: number) => void;
  triggerLevelUp: (level: number) => void;
  triggerWaterReceivedEffect: (slotIndex: number, nickname?: string) => void;
  moveCharacterTo: (worldX: number, worldY: number) => void;
  resetZoom: () => void;
  toggleViewMode: () => void;
}

const BASE_W = 256;
const BASE_H = 192;
const DRAG_THRESHOLD = 3; // px before drag is detected

const FarmCanvas = forwardRef<FarmCanvasHandle, FarmCanvasProps>(function FarmCanvas(
  { grid, working = false, className, footprints, farmOwnerId, clickToMove = true,
    ownerNickname, ownerLevel, ownerStatusText, ownerStatusLink,
    ownerTotalHarvests, ownerUniqueItems, ownerCharacter, visitorProfiles, onVisitFarm },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<FarmRenderer | null>(null);
  const stateRef = useRef<FarmRenderState>({ grid, characterWorking: working, footprints, farmOwnerId });
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const [viewMode, setViewMode] = useState<'first' | 'third'>('third');
  const [showVisitorModal, setShowVisitorModal] = useState(false);

  // 드래그/핀치 상태
  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startCamX: number;
    startCamY: number;
    moved: boolean;
  } | null>(null);

  const pinchRef = useRef<{
    initialDist: number;
    initialZoom: number;
    centerX: number;
    centerY: number;
  } | null>(null);

  stateRef.current = {
    grid, characterWorking: working, footprints, farmOwnerId,
    ownerNickname, ownerLevel, ownerStatusText, ownerStatusLink,
    ownerTotalHarvests, ownerUniqueItems, ownerCharacter, visitorProfiles,
  };

  useImperativeHandle(ref, () => ({
    triggerWaterAnim: (slot) => rendererRef.current?.triggerWaterAnim(slot),
    triggerGrowthEffect: (slot, boost) => rendererRef.current?.triggerGrowthEffect(slot, boost),
    triggerPlantEffect: (slot) => rendererRef.current?.triggerPlantEffect(slot),
    triggerHarvestParticles: (slot, color) => rendererRef.current?.triggerHarvestParticles(slot, color),
    triggerLegendaryHarvest: (slot) => rendererRef.current?.triggerLegendaryHarvest(slot),
    triggerLevelUp: (level) => rendererRef.current?.triggerLevelUp(level),
    triggerWaterReceivedEffect: (slot, nick) => rendererRef.current?.triggerWaterReceivedEffect(slot, nick),
    moveCharacterTo: (x, y) => rendererRef.current?.moveCharacterTo(x, y),
    resetZoom: () => rendererRef.current?.resetCamera(),
    toggleViewMode: () => {
      const mode = rendererRef.current?.toggleViewMode();
      if (mode) setViewMode(mode);
    },
  }));

  // renderer는 canvas 마운트 시 한번만 생성
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    rendererRef.current = new FarmRenderer(canvas);

    // 작은 화면 자동 줌 (VSCode 사이드바 등)
    const containerWidth = canvas.parentElement?.clientWidth ?? canvas.clientWidth;
    rendererRef.current.autoZoomForSmallScreen(containerWidth);

    // ~12fps for pixel art feel
    const interval = setInterval(() => {
      const renderer = rendererRef.current;
      if (!renderer) return;
      renderer.render(stateRef.current);
    }, 80);

    return () => {
      clearInterval(interval);
      rendererRef.current = null;
    };
  }, []);

  // 화면→월드 좌표 변환 헬퍼
  const toWorld = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return null;
    const rect = canvas.getBoundingClientRect();
    const cam = renderer.getCamera();
    return screenToWorld(
      clientX - rect.left, clientY - rect.top,
      cam, BASE_W, BASE_H, rect.width, rect.height
    );
  }, []);

  // ── 포인터 이벤트 (드래그 팬 + 클릭 이동) ──
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    // 핀치 중이면 무시
    if (e.pointerType === 'touch' && pinchRef.current) return;

    const cam = renderer.getTargetCamera();
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startCamX: cam.x,
      startCamY: cam.y,
      moved: false,
    };

    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    const renderer = rendererRef.current;
    const canvas = canvasRef.current;
    if (!renderer || !canvas) return;

    // 드래그 팬
    if (drag?.active) {
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;

      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        drag.moved = true;
      }

      if (drag.moved) {
        // 1인칭 모드에서 드래그 시 3인칭으로 전환
        if (renderer.getViewMode() === 'first') {
          renderer.setViewMode('third');
          setViewMode('third');
        }
        const rect = canvas.getBoundingClientRect();
        const scaleX = BASE_W / rect.width;
        const scaleY = BASE_H / rect.height;
        const cam = renderer.getTargetCamera();
        renderer.setTargetCamera({
          x: drag.startCamX + dx * scaleX,
          y: drag.startCamY + dy * scaleY,
          zoom: cam.zoom,
        });
        setTooltip(null);
        return;
      }
    }

    // 풋프린트 툴팁 (드래그 중이 아닐 때)
    if (!drag?.moved) {
      const world = toWorld(e.clientX, e.clientY);
      if (world) {
        const fp = renderer.getFootprintAt(world.x, world.y);
        if (fp) {
          const rect = canvas.getBoundingClientRect();
          const hoursAgo = (Date.now() - new Date(fp.visited_at).getTime()) / (1000 * 60 * 60);
          const timeText = hoursAgo < 1 ? `${Math.floor(hoursAgo * 60)}m`
            : hoursAgo < 24 ? `${Math.floor(hoursAgo)}h`
            : 'yesterday';
          const waterText = fp.watered ? ' 💧' : '';
          setTooltip({
            text: `@${fp.nickname} · ${timeText}${waterText}`,
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
          });
        } else {
          setTooltip(null);
        }
      }
    }
  }, [toWorld]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    const renderer = rendererRef.current;
    dragRef.current = null;

    if (!drag || !renderer) return;

    // 드래그가 아닌 클릭
    if (!drag.moved) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      // 유저 아이콘 사이드바 클릭 체크
      const hit = renderer.hitTestUserList(sx, sy, rect.width, rect.height);
      if (hit) {
        if (hit.type === 'user' && hit.id) {
          renderer.trackUser(hit.id);
          setViewMode('first');
        } else if (hit.type === 'overflow') {
          setShowVisitorModal(true);
        }
        return;
      }

      // 하단 정보 패널 버튼 클릭 체크
      const panelHit = renderer.hitTestInfoPanel(sx, sy, rect.width, rect.height);
      if (panelHit) {
        if (panelHit.type === 'farm' && onVisitFarm) {
          // URL에서 userId 추출 (/farm?visit=ID)
          const id = panelHit.url.split('visit=')[1];
          if (id) onVisitFarm(id);
        } else if (panelHit.type === 'link') {
          window.open(panelHit.url, '_blank', 'noopener');
        }
        return;
      }

      // 캐릭터 이동 (clickToMove가 true일 때만)
      if (clickToMove) {
        const world = toWorld(e.clientX, e.clientY);
        if (world) {
          renderer.moveCharacterTo(world.x, world.y);
        }
      }
    }
  }, [toWorld, clickToMove, onVisitFarm]);

  // ── 터치 핀치 줌 ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getTouchDist = (t1: Touch, t2: Touch) =>
      Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const renderer = rendererRef.current;
        if (!renderer) return;
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const dist = getTouchDist(t0, t1);
        if (dist < 10) return; // zero-distance guard
        const cam = renderer.getTargetCamera();
        pinchRef.current = {
          initialDist: dist,
          initialZoom: cam.zoom,
          centerX: (t0.clientX + t1.clientX) / 2,
          centerY: (t0.clientY + t1.clientY) / 2,
        };
        // 드래그 취소
        dragRef.current = null;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const renderer = rendererRef.current;
        if (!renderer) return;
        const rect = canvas.getBoundingClientRect();
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const dist = getTouchDist(t0, t1);
        const ratio = dist / pinchRef.current.initialDist;
        const newZoom = pinchRef.current.initialZoom * ratio;
        const delta = newZoom - renderer.getTargetCamera().zoom;
        const centerX = (t0.clientX + t1.clientX) / 2 - rect.left;
        const centerY = (t0.clientY + t1.clientY) / 2 - rect.top;
        const cam = renderer.getTargetCamera();
        const newCam = zoomAtPoint(cam, centerX, centerY, delta, BASE_W, BASE_H, rect.width, rect.height);
        renderer.setTargetCamera(newCam);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        pinchRef.current = null;
      }
    };

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);

    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  // ── 마우스 휠 줌 ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const renderer = rendererRef.current;
      if (!renderer) return;
      const rect = canvas.getBoundingClientRect();
      const delta = e.deltaY > 0 ? -0.25 : 0.25;
      const cam = renderer.getTargetCamera();
      const newCam = zoomAtPoint(
        cam, e.clientX - rect.left, e.clientY - rect.top,
        delta, BASE_W, BASE_H, rect.width, rect.height
      );
      renderer.setTargetCamera(newCam);
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, []);

  // ── 더블클릭 → 줌 리셋 ──
  const handleDoubleClick = useCallback(() => {
    rendererRef.current?.resetCamera();
  }, []);

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  const handleToggleView = useCallback(() => {
    const mode = rendererRef.current?.toggleViewMode();
    if (mode) setViewMode(mode);
  }, []);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Pixel art farm"
        className={`w-full max-w-[1024px] cursor-grab active:cursor-grabbing ${className ?? ''}`}
        style={{ aspectRatio: '256 / 192', imageRendering: 'pixelated', touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onMouseLeave={handleMouseLeave}
      />
      {/* 시점 전환 버튼 */}
      {clickToMove && (
        <button
          onClick={handleToggleView}
          className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white text-base px-3 py-2 min-w-[40px] min-h-[40px] rounded-lg border border-white/20 transition-colors flex items-center justify-center"
          title={viewMode === 'third' ? '1인칭 모드' : '3인칭 모드'}
        >
          {viewMode === 'third' ? '👁' : '🗺'}
        </button>
      )}
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-black/80 text-white text-xs px-2 py-1 rounded max-w-[200px] truncate"
          style={{ left: tooltip.x + 8, top: tooltip.y - 24 }}
        >
          {tooltip.text}
        </div>
      )}
      {/* 방문자 목록 모달 */}
      {showVisitorModal && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
          <div className="bg-[#232736] border border-[#2a2d3a] rounded-lg p-3 max-w-[200px] w-full max-h-[70%] overflow-y-auto">
            <div className="flex justify-between items-center mb-2">
              <span className="text-white text-sm font-bold">Visitors</span>
              <button
                onClick={() => setShowVisitorModal(false)}
                className="text-gray-400 hover:text-white text-sm px-1"
              >
                ✕
              </button>
            </div>
            {rendererRef.current?.getGhostList().map((ghost) => (
              <button
                key={ghost.id}
                onClick={() => {
                  rendererRef.current?.trackUser(ghost.id);
                  setViewMode('first');
                  setShowVisitorModal(false);
                }}
                className="w-full flex items-center gap-2 py-1.5 px-2 hover:bg-white/10 rounded text-left text-sm"
              >
                <span
                  className="inline-block w-3 h-3 rounded-sm border border-white/30"
                  style={{ backgroundColor: ghost.color }}
                />
                <span className="text-white truncate">{ghost.nickname}</span>
                {ghost.watered && <span className="text-blue-400 text-xs ml-auto">💧</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

export default FarmCanvas;
