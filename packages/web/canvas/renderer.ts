import { PALETTE } from './palette';
import { CHARACTER_SPRITE, CROP_SPRITES, drawSprite } from './sprites';
import type { CropSlot } from '@claude-farmer/shared';
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
}

export class FarmRenderer {
  private ctx: CanvasRenderingContext2D;
  private frame = 0;
  private animTimer = 0;
  private stars: { x: number; y: number; blink: boolean }[] = [];

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
    this.drawGrid(state.grid);
    this.drawCharacter(state.characterWorking);
    this.drawWeatherEffects(tod);

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

  getSize() {
    return { width: BASE_W, height: BASE_H };
  }
}
