import { PALETTE } from './palette';
import { CHARACTER_SPRITE, CROP_SPRITES, drawSprite } from './sprites';
import type { CropSlot, Footprint } from '@claude-farmer/shared';
import { getTimeOfDay, type TimeOfDay } from '@claude-farmer/shared';

// 캔버스 설정: 256×192px 기본, 4× 스케일
const BASE_W = 256;
const BASE_H = 192;
const TILE = 16;
const SKY_TILES = 3;   // 하늘 3타일 높이
const GRID_OFFSET_X = 4 * TILE; // 그리드 시작 X (타일 4)
const GRID_OFFSET_Y = SKY_TILES * TILE + TILE; // 하늘 + 여백 1타일
const CELL_SIZE = 2 * TILE; // 각 칸 32px (16px 작물 + 여백)

export interface FarmRenderState {
  grid: (CropSlot | null)[];
  characterWorking: boolean;
  footprints?: Footprint[];
  farmOwnerId?: string;
}

interface WaterAnim {
  slotIndex: number;
  startFrame: number;
  duration: number; // frames
}

export class FarmRenderer {
  private ctx: CanvasRenderingContext2D;
  private frame = 0;
  private animTimer = 0;
  private stars: { x: number; y: number; blink: boolean }[] = [];
  private waterAnims: WaterAnim[] = [];
  // 발자국 위치 캐시 (hover 감지용)
  private footprintPositions: { x: number; y: number; fp: Footprint }[] = [];

  constructor(private canvas: HTMLCanvasElement) {
    canvas.width = BASE_W;
    canvas.height = BASE_H;
    this.ctx = canvas.getContext('2d')!;

    // 별 위치 생성
    for (let i = 0; i < 25; i++) {
      this.stars.push({
        x: Math.random() * BASE_W,
        y: Math.random() * (SKY_TILES * TILE),
        blink: i < 4,
      });
    }
  }

  render(state: FarmRenderState) {
    const ctx = this.ctx;
    const hour = new Date().getHours();
    const tod = getTimeOfDay(hour);

    ctx.clearRect(0, 0, BASE_W, BASE_H);

    this.drawSky(tod);
    this.drawGround();
    if (state.footprints?.length) {
      this.drawFootprints(state.footprints, state.farmOwnerId ?? '');
    }
    this.drawGrid(state.grid);
    this.drawCharacter(state.characterWorking);
    this.drawWeatherEffects(tod);
    this.drawWaterAnims();

    this.frame++;
  }

  // ── 하늘 ──
  private drawSky(tod: TimeOfDay) {
    const ctx = this.ctx;
    const skyH = SKY_TILES * TILE;
    const colors = PALETTE.sky[tod];

    const grad = ctx.createLinearGradient(0, 0, 0, skyH);
    if (colors.length === 2) {
      grad.addColorStop(0, colors[0]);
      grad.addColorStop(1, colors[1]);
    } else {
      colors.forEach((c, i) => grad.addColorStop(i / (colors.length - 1), c));
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, BASE_W, skyH);

    // 구름
    if (tod !== 'night') {
      this.drawClouds(tod);
    }

    // 태양/달
    this.drawCelestialBody(tod);

    // 별 (밤)
    if (tod === 'night') {
      this.drawStars();
    }
  }

  private drawClouds(tod: TimeOfDay) {
    const ctx = this.ctx;
    const color = tod === 'evening' ? PALETTE.cloudOrange : PALETTE.cloudWhite;
    const offset = (this.frame * 0.3) % (BASE_W + 40);

    ctx.fillStyle = color;
    // 구름 1
    const cx1 = (BASE_W - offset + 60) % (BASE_W + 40) - 20;
    this.drawPixelCloud(cx1, 8, 3);
    // 구름 2
    const cx2 = (BASE_W - offset + 160) % (BASE_W + 40) - 20;
    this.drawPixelCloud(cx2, 20, 2);
  }

  private drawPixelCloud(x: number, y: number, size: number) {
    const ctx = this.ctx;
    // 간단한 픽셀 구름
    for (let dy = 0; dy < size; dy++) {
      const w = size * 3 - Math.abs(dy - size / 2) * 2;
      ctx.fillRect(Math.round(x - w / 2), y + dy, w, 1);
    }
  }

  private drawCelestialBody(tod: TimeOfDay) {
    const ctx = this.ctx;
    if (tod === 'morning') {
      ctx.fillStyle = PALETTE.sunMorning;
      ctx.fillRect(20, 30, 6, 6);
    } else if (tod === 'afternoon') {
      ctx.fillStyle = PALETTE.sunAfternoon;
      ctx.fillRect(BASE_W / 2 - 3, 5, 6, 6);
      // 빛살
      if (this.frame % 30 < 15) {
        ctx.fillRect(BASE_W / 2 - 1, 2, 2, 1);
        ctx.fillRect(BASE_W / 2 - 1, 12, 2, 1);
        ctx.fillRect(BASE_W / 2 - 5, 7, 1, 2);
        ctx.fillRect(BASE_W / 2 + 4, 7, 1, 2);
      }
    } else if (tod === 'evening') {
      ctx.fillStyle = PALETTE.sunEvening;
      ctx.fillRect(BASE_W - 30, 30, 6, 6);
    } else {
      // 달
      ctx.fillStyle = PALETTE.moon;
      ctx.fillRect(BASE_W - 25, 6, 4, 4);
      ctx.fillRect(BASE_W - 24, 5, 2, 1);
      ctx.fillRect(BASE_W - 24, 10, 2, 1);
    }
  }

  private drawStars() {
    const ctx = this.ctx;
    for (const star of this.stars) {
      if (star.blink && this.frame % 60 < 30) continue;
      ctx.fillStyle = PALETTE.star;
      ctx.fillRect(Math.round(star.x), Math.round(star.y), 1, 1);
    }
  }

  // ── 땅 ──
  private drawGround() {
    const ctx = this.ctx;
    const groundY = SKY_TILES * TILE;

    // 풀 베이스
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(0, groundY, BASE_W, BASE_H - groundY);

    // 풀 패턴
    ctx.fillStyle = PALETTE.grassDark;
    for (let x = 0; x < BASE_W; x += 7) {
      for (let y = groundY; y < BASE_H; y += 5) {
        ctx.fillRect(x + ((y * 3) % 5), y, 1, 1);
      }
    }

    // 작물 영역 흙
    const farmX = GRID_OFFSET_X - 2;
    const farmY = GRID_OFFSET_Y - 2;
    const farmW = 4 * CELL_SIZE + 4;
    const farmH = 4 * CELL_SIZE + 4;

    ctx.fillStyle = PALETTE.dirt;
    ctx.fillRect(farmX, farmY, farmW, farmH);

    // 흙 패턴
    ctx.fillStyle = PALETTE.dirtDark;
    for (let x = farmX; x < farmX + farmW; x += 4) {
      for (let y = farmY; y < farmY + farmH; y += 4) {
        ctx.fillRect(x + ((y * 2) % 3), y + (x % 2), 1, 1);
      }
    }

    // 격자선
    ctx.fillStyle = PALETTE.dirtDark;
    for (let i = 0; i <= 4; i++) {
      // 세로선
      ctx.fillRect(GRID_OFFSET_X + i * CELL_SIZE - 1, farmY, 1, farmH);
      // 가로선
      ctx.fillRect(farmX, GRID_OFFSET_Y + i * CELL_SIZE - 1, farmW, 1);
    }
  }

  // ── 작물 그리드 ──
  private drawGrid(grid: (CropSlot | null)[]) {
    for (let i = 0; i < 16; i++) {
      const slot = grid[i];
      if (!slot) continue;

      const row = Math.floor(i / 4);
      const col = i % 4;
      const x = GRID_OFFSET_X + col * CELL_SIZE + (CELL_SIZE - TILE) / 2;
      const y = GRID_OFFSET_Y + row * CELL_SIZE + (CELL_SIZE - TILE) / 2;

      const sprites = CROP_SPRITES[slot.crop];
      if (sprites && sprites[slot.stage]) {
        drawSprite(this.ctx, sprites[slot.stage], x, y, 1);
      }
    }
  }

  // ── 캐릭터 ──
  private drawCharacter(working: boolean) {
    const charX = GRID_OFFSET_X + 4 * CELL_SIZE + 12;
    const bounceY = this.frame % 40 < 20 ? 0 : -1;
    const charY = GRID_OFFSET_Y + 2 * CELL_SIZE + bounceY;

    drawSprite(this.ctx, CHARACTER_SPRITE, charX, charY, 1);

    // 작업중이면 머리 위에 표시
    if (working) {
      this.ctx.fillStyle = '#FFFFFF';
      const dotCount = (this.frame % 60) / 20 | 0;
      for (let i = 0; i <= dotCount; i++) {
        this.ctx.fillRect(charX + 4 + i * 3, charY - 4, 1, 1);
      }
    }
  }

  // ── 날씨 이펙트 ──
  private drawWeatherEffects(tod: TimeOfDay) {
    const ctx = this.ctx;

    if (tod === 'morning') {
      // 이슬 반짝임
      if (this.frame % 60 < 10) {
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillRect(GRID_OFFSET_X + 10, GRID_OFFSET_Y + 5, 1, 1);
        ctx.fillRect(GRID_OFFSET_X + 45, GRID_OFFSET_Y + 20, 1, 1);
        ctx.fillRect(GRID_OFFSET_X + 80, GRID_OFFSET_Y + 12, 1, 1);
      }
    }

    if (tod === 'night') {
      // 반딧불
      const fireflyCount = 3;
      for (let i = 0; i < fireflyCount; i++) {
        const phase = (this.frame + i * 40) % 120;
        if (phase < 60) {
          const alpha = Math.sin((phase / 60) * Math.PI);
          ctx.fillStyle = `rgba(197,225,165,${alpha.toFixed(2)})`;
          const fx = 20 + Math.sin((this.frame + i * 100) * 0.02) * 40 + i * 70;
          const fy = SKY_TILES * TILE + 20 + Math.cos((this.frame + i * 80) * 0.015) * 30;
          ctx.fillRect(Math.round(fx), Math.round(fy), 1, 1);
        }
      }

      // 어두운 오버레이
      ctx.fillStyle = 'rgba(13,27,42,0.25)';
      ctx.fillRect(0, SKY_TILES * TILE, BASE_W, BASE_H - SKY_TILES * TILE);
    }

    if (tod === 'evening') {
      // 따뜻한 오버레이
      ctx.fillStyle = 'rgba(255,152,0,0.08)';
      ctx.fillRect(0, 0, BASE_W, BASE_H);
    }
  }

  // ── 발자국 ──
  private drawFootprints(footprints: Footprint[], farmOwnerId: string) {
    const ctx = this.ctx;
    const groundY = SKY_TILES * TILE;
    // 발자국 배치 가능 영역: 풀밭 좌우 여백 (작물 영역 밖)
    const farmLeft = GRID_OFFSET_X - 2;
    const farmRight = GRID_OFFSET_X + 4 * CELL_SIZE + 2;

    this.footprintPositions = [];
    for (const fp of footprints) {
      const hoursAgo = (Date.now() - new Date(fp.visited_at).getTime()) / (1000 * 60 * 60);
      if (hoursAgo > 24) continue;

      const opacity = Math.max(0, 1 - hoursAgo / 24) * 0.4;
      const pos = this.hashPosition(fp.github_id, farmOwnerId, groundY, farmLeft, farmRight);
      this.footprintPositions.push({ x: pos.x, y: pos.y, fp });

      ctx.globalAlpha = opacity;

      // 발자국 스프라이트 (2×2px 쌍)
      ctx.fillStyle = '#A0724A';
      ctx.fillRect(pos.x, pos.y, 2, 2);
      ctx.fillRect(pos.x + 3, pos.y + 1, 2, 2);

      // 물 줬으면 물방울 잔상
      if (fp.watered) {
        ctx.fillStyle = '#64B5F6';
        ctx.globalAlpha = Math.min(opacity * 1.5, 0.6);
        ctx.fillRect(pos.x + 1, pos.y - 2, 1, 1);
      }

      ctx.globalAlpha = 1;
    }
  }

  // 결정론적 위치 생성: hash(visitor_id + farm_id) → 풀밭 영역 좌표
  private hashPosition(
    visitorId: string,
    farmOwnerId: string,
    groundY: number,
    farmLeft: number,
    farmRight: number
  ): { x: number; y: number } {
    const str = visitorId + farmOwnerId;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    const absHash = Math.abs(hash);

    // 좌측 또는 우측 풀밭에 배치
    const side = absHash % 2;
    let x: number;
    if (side === 0) {
      // 왼쪽 (0 ~ farmLeft-4)
      x = (absHash >> 1) % Math.max(1, farmLeft - 4);
    } else {
      // 오른쪽 (farmRight+2 ~ BASE_W-4)
      const rightW = BASE_W - farmRight - 6;
      x = farmRight + 2 + ((absHash >> 1) % Math.max(1, rightW));
    }
    const y = groundY + 4 + ((absHash >> 8) % (BASE_H - groundY - 8));

    return { x, y };
  }

  // ── 수확 이펙트 ──
  drawHarvestEffect(slotIndex: number, color: string) {
    const ctx = this.ctx;
    const row = Math.floor(slotIndex / 4);
    const col = slotIndex % 4;
    const cx = GRID_OFFSET_X + col * CELL_SIZE + CELL_SIZE / 2;
    const cy = GRID_OFFSET_Y + row * CELL_SIZE + CELL_SIZE / 2;

    // 별 파티클
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const dist = 4 + Math.random() * 4;
      const px = cx + Math.cos(angle) * dist;
      const py = cy + Math.sin(angle) * dist;
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
    }
  }

  // ── 물 주기 이펙트 ──
  drawWaterEffect(slotIndex: number) {
    const ctx = this.ctx;
    const row = Math.floor(slotIndex / 4);
    const col = slotIndex % 4;
    const cx = GRID_OFFSET_X + col * CELL_SIZE + CELL_SIZE / 2;
    const cy = GRID_OFFSET_Y + row * CELL_SIZE;

    ctx.fillStyle = '#64B5F6';
    for (let i = 0; i < 4; i++) {
      const dx = (i - 1.5) * 3;
      ctx.fillRect(Math.round(cx + dx), cy + 2 + i * 2, 1, 2);
    }
  }

  // ── 물 주기 드롭 애니메이션 (큐 기반) ──
  triggerWaterAnim(slotIndex: number) {
    this.waterAnims.push({ slotIndex, startFrame: this.frame, duration: 30 });
  }

  private drawWaterAnims() {
    const ctx = this.ctx;
    this.waterAnims = this.waterAnims.filter(anim => {
      const elapsed = this.frame - anim.startFrame;
      if (elapsed >= anim.duration) return false;

      const row = Math.floor(anim.slotIndex / 4);
      const col = anim.slotIndex % 4;
      const cx = GRID_OFFSET_X + col * CELL_SIZE + CELL_SIZE / 2;
      const startY = GRID_OFFSET_Y + row * CELL_SIZE - 4;
      const progress = elapsed / anim.duration;

      // 3개 물방울이 위에서 아래로 떨어짐
      ctx.fillStyle = '#64B5F6';
      for (let i = 0; i < 3; i++) {
        const dropProgress = Math.min(1, progress + i * 0.1);
        const alpha = 1 - dropProgress;
        ctx.globalAlpha = alpha;
        const dx = (i - 1) * 4;
        const dy = dropProgress * 12;
        ctx.fillRect(Math.round(cx + dx), Math.round(startY + dy), 1, 2);
      }
      ctx.globalAlpha = 1;

      // 착지 시 스플래시
      if (progress > 0.7) {
        const splashAlpha = 1 - (progress - 0.7) / 0.3;
        ctx.globalAlpha = splashAlpha * 0.6;
        ctx.fillStyle = '#90CAF9';
        const splashY = startY + 12;
        for (let i = 0; i < 4; i++) {
          const angle = (i / 4) * Math.PI * 2 + progress * 2;
          const dist = (progress - 0.7) / 0.3 * 5;
          ctx.fillRect(
            Math.round(cx + Math.cos(angle) * dist),
            Math.round(splashY + Math.sin(angle) * dist * 0.5),
            1, 1
          );
        }
        ctx.globalAlpha = 1;
      }

      return true;
    });
  }

  // ── 발자국 hover 툴팁 ──
  getFootprintAt(canvasX: number, canvasY: number): Footprint | null {
    // canvasX, canvasY는 base 해상도(256×192) 기준
    const hitRadius = 4;
    for (const { x, y, fp } of this.footprintPositions) {
      if (Math.abs(canvasX - x) <= hitRadius && Math.abs(canvasY - y) <= hitRadius) {
        return fp;
      }
    }
    return null;
  }

  getSize() {
    return { width: BASE_W, height: BASE_H };
  }
}
