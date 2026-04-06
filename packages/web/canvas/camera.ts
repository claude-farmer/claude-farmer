// 카메라 시스템: 줌/팬/좌표 변환 유틸
export interface CameraState {
  x: number;  // 팬 오프셋 X (캔버스 공간)
  y: number;  // 팬 오프셋 Y (캔버스 공간)
  zoom: number;
}

export const MIN_ZOOM = 1.25;
export const MAX_ZOOM = 3.0;
export const ZOOM_STEP = 0.25;
export const LERP_SPEED = 0.15;

// Centered on farm grid at 1.5x zoom: pan to show grid centered
export const DEFAULT_CAMERA: CameraState = { x: -64, y: -48, zoom: 1.5 };

/** 줌을 0.25 단위로 스냅 (서브픽셀 아티팩트 방지) */
export function snapZoom(zoom: number): number {
  return Math.round(zoom / ZOOM_STEP) * ZOOM_STEP;
}

/** 팬 범위 제한: 캔버스 밖이 보이지 않도록 */
export function clampCamera(cam: CameraState, baseW: number, baseH: number): CameraState {
  const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, cam.zoom));
  // zoom=1이면 pan=0, zoom>1이면 범위 내 이동 가능
  const minX = -(baseW * (zoom - 1));
  const minY = -(baseH * (zoom - 1));
  return {
    x: Math.max(minX, Math.min(0, cam.x)),
    y: Math.max(minY, Math.min(0, cam.y)),
    zoom,
  };
}

/** 화면 좌표(캔버스 CSS 기준) → 월드 좌표(256×192 기준) */
export function screenToWorld(
  screenX: number,
  screenY: number,
  cam: CameraState,
  baseW: number,
  baseH: number,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  const scaleX = baseW / canvasWidth;
  const scaleY = baseH / canvasHeight;
  const canvasX = screenX * scaleX;
  const canvasY = screenY * scaleY;
  return {
    x: (canvasX - cam.x) / cam.zoom,
    y: (canvasY - cam.y) / cam.zoom,
  };
}

/** 커서 위치 기준 줌 (지도 방식: 커서 아래 월드 포인트 고정) */
export function zoomAtPoint(
  cam: CameraState,
  screenX: number,
  screenY: number,
  delta: number,
  baseW: number,
  baseH: number,
  canvasWidth: number,
  canvasHeight: number
): CameraState {
  const scaleX = baseW / canvasWidth;
  const scaleY = baseH / canvasHeight;
  const canvasX = screenX * scaleX;
  const canvasY = screenY * scaleY;

  // 줌 전 월드 좌표
  const worldX = (canvasX - cam.x) / cam.zoom;
  const worldY = (canvasY - cam.y) / cam.zoom;

  const newZoom = snapZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, cam.zoom + delta)));

  // 줌 후 동일한 월드 포인트가 같은 화면 위치에 오도록 팬 조정
  const newX = canvasX - worldX * newZoom;
  const newY = canvasY - worldY * newZoom;

  return clampCamera({ x: newX, y: newY, zoom: newZoom }, baseW, baseH);
}

/** 부드러운 카메라 보간 */
export function lerpCamera(current: CameraState, target: CameraState, speed: number = LERP_SPEED): CameraState {
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const dz = target.zoom - current.zoom;

  // 충분히 가까우면 스냅
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(dz) < 0.01) {
    return { ...target };
  }

  return {
    x: current.x + dx * speed,
    y: current.y + dy * speed,
    zoom: current.zoom + dz * speed,
  };
}
