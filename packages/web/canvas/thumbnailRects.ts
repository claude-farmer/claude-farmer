// Edge runtime용: Canvas2D를 흉내내는 shim recorder를 통해
// renderThumbnailFrame이 그리는 모든 fillRect를 사각형 리스트로 캡처한다.
// 결과는 Satori (next/og)에서 absolute positioned div로 렌더 가능하다.

import { prepareThumbnailScene, renderThumbnailFrame, type ThumbnailSceneOpts } from './thumbnailScene';

export interface ThumbRect {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  opacity: number;
}

interface GradientStub {
  __isGradient: true;
  stops: { offset: number; color: string }[];
}

function isGradient(v: unknown): v is GradientStub {
  return typeof v === 'object' && v !== null && (v as { __isGradient?: boolean }).__isGradient === true;
}

class CanvasRecorder {
  rects: ThumbRect[] = [];
  fillStyle: string | GradientStub = '#000000';
  globalAlpha = 1;
  imageSmoothingEnabled = false;

  clearRect(): void {
    this.rects.length = 0;
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    if (w <= 0 || h <= 0) return;
    if (isGradient(this.fillStyle)) {
      // 단순한 세로 그라디언트 슬라이스: h를 stop 개수만큼 슬라이싱
      const stops = this.fillStyle.stops;
      if (stops.length === 0) return;
      // 단순화: 1픽셀씩 lerp (h가 작을 때 OK, 24픽셀 정도)
      for (let i = 0; i < h; i++) {
        const t = h <= 1 ? 0 : i / (h - 1);
        const color = lerpStops(stops, t);
        this.rects.push({
          x: Math.round(x),
          y: Math.round(y + i),
          w: Math.round(w),
          h: 1,
          color,
          opacity: this.globalAlpha,
        });
      }
    } else {
      this.rects.push({
        x: Math.round(x),
        y: Math.round(y),
        w: Math.round(w),
        h: Math.round(h),
        color: this.fillStyle,
        opacity: this.globalAlpha,
      });
    }
  }

  createLinearGradient(): GradientStub {
    return { __isGradient: true, stops: [] };
  }
}

// createLinearGradient 반환값에 addColorStop 메서드를 동적 부착
const origCreate = CanvasRecorder.prototype.createLinearGradient;
CanvasRecorder.prototype.createLinearGradient = function () {
  const g = origCreate.call(this);
  (g as GradientStub & { addColorStop: (offset: number, color: string) => void }).addColorStop = function (offset, color) {
    this.stops.push({ offset, color });
  };
  return g;
};

function lerpStops(stops: { offset: number; color: string }[], t: number): string {
  if (stops.length === 0) return '#000000';
  if (t <= stops[0].offset) return stops[0].color;
  if (t >= stops[stops.length - 1].offset) return stops[stops.length - 1].color;
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (t >= a.offset && t <= b.offset) {
      const local = (t - a.offset) / (b.offset - a.offset);
      return mixHex(a.color, b.color, local);
    }
  }
  return stops[0].color;
}

function mixHex(a: string, b: string, t: number): string {
  const ra = parseHex(a);
  const rb = parseHex(b);
  const r = Math.round(ra[0] + (rb[0] - ra[0]) * t);
  const g = Math.round(ra[1] + (rb[1] - ra[1]) * t);
  const bl = Math.round(ra[2] + (rb[2] - ra[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

function parseHex(c: string): [number, number, number] {
  const m = c.match(/^#([0-9a-f]{6})/i);
  if (m) {
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  }
  return [0, 0, 0];
}

export function getThumbnailRects(opts: ThumbnailSceneOpts, frame = 16): ThumbRect[] {
  const recorder = new CanvasRecorder();
  const scene = prepareThumbnailScene(opts);
  renderThumbnailFrame(recorder as unknown as CanvasRenderingContext2D, scene, frame);
  return recorder.rects;
}
