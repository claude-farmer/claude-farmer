import { PALETTE } from './palette';
import { CHARACTER_SPRITE, CROP_SPRITES, drawSprite } from './sprites';
import type { CropSlot, Footprint } from '@claude-farmer/shared';
import { getTimeOfDay, isBoostTime, type TimeOfDay, GRID_SIZE, GRID_COLS } from '@claude-farmer/shared';

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

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  startFrame: number;
  duration: number;
}

interface ScreenFlash {
  color: string;
  startFrame: number;
  duration: number;
}

interface ShakeEffect {
  slotIndex: number;
  startFrame: number;
  duration: number;
}

interface LevelUpBanner {
  level: number;
  startFrame: number;
  duration: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  maxLife: number;
}

export class FarmRenderer {
  private ctx: CanvasRenderingContext2D;
  private frame = 0;
  private animTimer = 0;
  private stars: { x: number; y: number; blink: boolean }[] = [];
  private waterAnims: WaterAnim[] = [];
  private floatingTexts: FloatingText[] = [];
  private screenFlashes: ScreenFlash[] = [];
  private shakeEffects: ShakeEffect[] = [];
  private levelUpBanners: LevelUpBanner[] = [];
  private particles: Particle[] = [];
  private static readonly MAX_PARTICLES = 100;
  // 발자국 위치 캐시 (hover 감지용)
  private footprintPositions: { x: number; y: number; fp: Footprint }[] = [];

  private addParticle(p: Particle) {
    if (this.particles.length < FarmRenderer.MAX_PARTICLES) {
      this.particles.push(p);
    }
  }

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
    const boost = isBoostTime(hour);

    ctx.clearRect(0, 0, BASE_W, BASE_H);

    this.drawSky(tod, boost);
    this.drawGround();
    if (state.footprints?.length) {
      this.drawFootprints(state.footprints, state.farmOwnerId ?? '');
    }
    this.drawGrid(state.grid);
    this.drawCharacter(state.characterWorking, boost);
    this.drawWeatherEffects(tod);
    if (boost) this.drawBoostBadge();
    this.drawWaterAnims();
    this.drawFloatingTexts();
    this.drawParticles();
    this.drawScreenFlashes();
    this.drawLevelUpBanners();

    this.frame++;
  }

  // ── 하늘 ──
  private drawSky(tod: TimeOfDay, boost = false) {
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
    const blinkSpeed = isBoostTime() ? 30 : 60;
    for (const star of this.stars) {
      if (star.blink && this.frame % blinkSpeed < blinkSpeed / 2) continue;
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
    // 만료된 shakeEffects 정리
    this.shakeEffects = this.shakeEffects.filter(
      s => this.frame - s.startFrame < s.duration
    );

    for (let i = 0; i < GRID_SIZE; i++) {
      const slot = grid[i];
      if (!slot) continue;

      const row = Math.floor(i / GRID_COLS);
      const col = i % GRID_COLS;
      let x = GRID_OFFSET_X + col * CELL_SIZE + (CELL_SIZE - TILE) / 2;
      let y = GRID_OFFSET_Y + row * CELL_SIZE + (CELL_SIZE - TILE) / 2;

      // shake 적용
      const shake = this.shakeEffects.find(s => s.slotIndex === i);
      if (shake) {
        const progress = (this.frame - shake.startFrame) / shake.duration;
        const intensity = Math.max(0, 1 - progress) * 2;
        x += Math.sin(this.frame * 3) * intensity;
        y += Math.cos(this.frame * 5) * intensity * 0.5;
      }

      const sprites = CROP_SPRITES[slot.crop];
      if (sprites && sprites[slot.stage]) {
        drawSprite(this.ctx, sprites[slot.stage], x, y, 1);
      }
    }
  }

  // ── 캐릭터 ──
  private drawCharacter(working: boolean, boost = false) {
    const ctx = this.ctx;
    const charX = GRID_OFFSET_X + 4 * CELL_SIZE + 12;
    const bouncePeriod = boost ? 24 : 40; // 부스트 시 더 빠른 바운스
    const bounceY = this.frame % bouncePeriod < bouncePeriod / 2 ? 0 : -1;
    const charY = GRID_OFFSET_Y + 2 * CELL_SIZE + bounceY;

    // 부스트 잔영
    if (boost) {
      const afterimages = [
        { offset: 2, alpha: 0.1 },
        { offset: 1, alpha: 0.25 },
      ];
      for (const ai of afterimages) {
        ctx.globalAlpha = ai.alpha;
        // 보라 틴트 오버레이
        drawSprite(ctx, CHARACTER_SPRITE, charX - ai.offset, charY + ai.offset, 1);
        ctx.globalAlpha = ai.alpha * 0.3;
        ctx.fillStyle = '#a78bfa';
        ctx.fillRect(charX - ai.offset, charY + ai.offset, TILE, TILE);
      }
      ctx.globalAlpha = 1;
    }

    drawSprite(ctx, CHARACTER_SPRITE, charX, charY, 1);

    // 작업중 표시
    if (working) {
      if (boost) {
        // 부스트: 🔥 표현 (빨간+노란 깜빡이는 점)
        const flicker = this.frame % 12 < 6;
        ctx.fillStyle = flicker ? '#fbbf24' : '#ef4444';
        ctx.fillRect(charX + 5, charY - 5, 2, 2);
        ctx.fillStyle = flicker ? '#ef4444' : '#fbbf24';
        ctx.fillRect(charX + 6, charY - 7, 1, 2);
      } else {
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#FFFFFF';
        const dotCount = (this.frame % 60) / 20 | 0;
        for (let i = 0; i <= dotCount; i++) {
          ctx.fillRect(charX + 4 + i * 3, charY - 4, 1, 1);
        }
      }
    }
  }

  // ── 부스트 배지 ──
  private drawBoostBadge() {
    const ctx = this.ctx;
    const pulse = 0.85 + Math.sin(this.frame * 0.1) * 0.15;
    ctx.globalAlpha = pulse;
    // 배경
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(BASE_W - 42, 2, 40, 8);
    // 텍스트 (픽셀 폰트 시뮬레이션: 작은 사각형)
    ctx.fillStyle = '#000000';
    // "BOOST" 를 작은 점으로 표현하기엔 너무 작으므로, 심볼로 대체
    ctx.fillRect(BASE_W - 40, 4, 1, 4); // 🔥 심볼
    ctx.fillRect(BASE_W - 38, 3, 1, 5);
    ctx.fillRect(BASE_W - 36, 4, 1, 4);
    // ×2 표시
    ctx.fillRect(BASE_W - 14, 4, 2, 1);
    ctx.fillRect(BASE_W - 14, 6, 2, 1);
    ctx.fillRect(BASE_W - 12, 5, 1, 1);
    ctx.fillRect(BASE_W - 15, 5, 1, 1);
    ctx.fillRect(BASE_W - 9, 3, 1, 6); // "2"
    ctx.fillRect(BASE_W - 8, 3, 2, 1);
    ctx.fillRect(BASE_W - 8, 5, 2, 1);
    ctx.fillRect(BASE_W - 8, 8, 2, 1);
    ctx.fillRect(BASE_W - 6, 4, 1, 1);
    ctx.fillRect(BASE_W - 8, 7, 1, 1);
    ctx.globalAlpha = 1;
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
      // 반딧불 (부스트 시 2배)
      const fireflyCount = isBoostTime() ? 8 : 3;
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
    const row = Math.floor(slotIndex / GRID_COLS);
    const col = slotIndex % GRID_COLS;
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
    const row = Math.floor(slotIndex / GRID_COLS);
    const col = slotIndex % GRID_COLS;
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

      const row = Math.floor(anim.slotIndex / GRID_COLS);
      const col = anim.slotIndex % GRID_COLS;
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

  // ── 플로팅 텍스트 ──
  private drawFloatingTexts() {
    const ctx = this.ctx;
    this.floatingTexts = this.floatingTexts.filter(ft => {
      const elapsed = this.frame - ft.startFrame;
      if (elapsed >= ft.duration) return false;

      const progress = elapsed / ft.duration;
      const alpha = 1 - progress;
      const offsetY = progress * 12;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = ft.color;

      // 픽셀 폰트로 텍스트 그리기 (간단한 +1, +2 등)
      const chars = ft.text.split('');
      let cx = ft.x;
      for (const ch of chars) {
        this.drawPixelChar(cx, ft.y - offsetY, ch, ft.color);
        cx += 4;
      }

      ctx.globalAlpha = 1;
      return true;
    });
  }

  private drawPixelChar(x: number, y: number, ch: string, color: string) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    if (ch === '+') {
      ctx.fillRect(x + 1, y, 1, 3);
      ctx.fillRect(x, y + 1, 3, 1);
    } else if (ch === '1') {
      ctx.fillRect(x + 1, y, 1, 4);
      ctx.fillRect(x, y + 3, 3, 1);
    } else if (ch === '2') {
      ctx.fillRect(x, y, 3, 1);
      ctx.fillRect(x + 2, y + 1, 1, 1);
      ctx.fillRect(x, y + 2, 3, 1);
      ctx.fillRect(x, y + 3, 1, 1);
      ctx.fillRect(x, y + 4, 3, 1);
    }
  }

  // ── 파티클 시스템 ──
  private drawParticles() {
    const ctx = this.ctx;
    this.particles = this.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy -= 0.02; // 약간 위로 떠오름
      p.life--;

      if (p.life <= 0) return false;

      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
      ctx.globalAlpha = 1;
      return true;
    });
  }

  // ── 화면 플래시 ──
  private drawScreenFlashes() {
    const ctx = this.ctx;
    this.screenFlashes = this.screenFlashes.filter(sf => {
      const elapsed = this.frame - sf.startFrame;
      if (elapsed >= sf.duration) return false;

      const progress = elapsed / sf.duration;
      const alpha = (1 - progress) * 0.5;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = sf.color;
      ctx.fillRect(0, 0, BASE_W, BASE_H);
      ctx.globalAlpha = 1;
      return true;
    });
  }

  // ── 레벨업 배너 ──
  private drawLevelUpBanners() {
    const ctx = this.ctx;
    this.levelUpBanners = this.levelUpBanners.filter(lb => {
      const elapsed = this.frame - lb.startFrame;
      if (elapsed >= lb.duration) return false;

      const progress = elapsed / lb.duration;

      // 등장 → 유지 → 페이드아웃
      let alpha: number;
      let scale: number;
      if (progress < 0.15) {
        alpha = progress / 0.15;
        scale = 0.5 + (progress / 0.15) * 0.5;
      } else if (progress < 0.7) {
        alpha = 1;
        scale = 1;
      } else {
        alpha = 1 - (progress - 0.7) / 0.3;
        scale = 1;
      }

      const centerX = BASE_W / 2;
      const centerY = BASE_H / 2 - 10;

      ctx.globalAlpha = alpha;

      // 배경 박스
      const boxW = 60 * scale;
      const boxH = 16 * scale;
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(centerX - boxW / 2, centerY - boxH / 2, boxW, boxH);

      // 테두리
      ctx.fillStyle = '#000000';
      ctx.fillRect(centerX - boxW / 2, centerY - boxH / 2, boxW, 1);
      ctx.fillRect(centerX - boxW / 2, centerY + boxH / 2 - 1, boxW, 1);
      ctx.fillRect(centerX - boxW / 2, centerY - boxH / 2, 1, boxH);
      ctx.fillRect(centerX + boxW / 2 - 1, centerY - boxH / 2, 1, boxH);

      // Level up text (간단한 점 표시)
      ctx.fillStyle = '#000000';
      // ★ 심볼
      ctx.fillRect(centerX - 20, centerY - 2, 2, 2);
      ctx.fillRect(centerX - 19, centerY - 3, 1, 1);
      ctx.fillRect(centerX - 19, centerY + 1, 1, 1);

      // "Lv" + 숫자
      ctx.fillRect(centerX - 8, centerY - 3, 1, 7);
      ctx.fillRect(centerX - 7, centerY + 3, 3, 1);
      // 레벨 숫자 (간단히 큰 점)
      ctx.fillRect(centerX + 5, centerY - 2, 3, 5);

      // 꽃가루 파티클 추가
      if (elapsed % 3 === 0 && progress < 0.7) {
        for (let i = 0; i < 2; i++) {
          this.addParticle({
            x: centerX + (Math.random() - 0.5) * 80,
            y: centerY + (Math.random() - 0.5) * 40,
            vx: (Math.random() - 0.5) * 0.8,
            vy: -Math.random() * 0.5,
            color: ['#fbbf24', '#f472b6', '#a78bfa', '#4ade80'][Math.floor(Math.random() * 4)],
            life: 20,
            maxLife: 20,
          });
        }
      }

      ctx.globalAlpha = 1;
      return true;
    });
  }

  // ── Public trigger methods ──

  // 성장 +1 (또는 부스트 +2)
  triggerGrowthEffect(slotIndex: number, boost = false) {
    const row = Math.floor(slotIndex / GRID_COLS);
    const col = slotIndex % GRID_COLS;
    const x = GRID_OFFSET_X + col * CELL_SIZE + CELL_SIZE / 2 - 4;
    const y = GRID_OFFSET_Y + row * CELL_SIZE;

    this.floatingTexts.push({
      x, y,
      text: boost ? '+2' : '+1',
      color: boost ? '#fbbf24' : '#4ade80',
      startFrame: this.frame,
      duration: 20,
    });

    // 작물 흔들림
    this.shakeEffects.push({
      slotIndex,
      startFrame: this.frame,
      duration: 8,
    });
  }

  // 심기 이펙트 (흙 파티클)
  triggerPlantEffect(slotIndex: number) {
    const row = Math.floor(slotIndex / GRID_COLS);
    const col = slotIndex % GRID_COLS;
    const cx = GRID_OFFSET_X + col * CELL_SIZE + CELL_SIZE / 2;
    const cy = GRID_OFFSET_Y + row * CELL_SIZE + CELL_SIZE / 2;

    for (let i = 0; i < 3; i++) {
      this.addParticle({
        x: cx,
        y: cy,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -Math.random() * 1.5,
        color: '#8B6914',
        life: 12,
        maxLife: 12,
      });
    }
  }

  // 레벨업 배너
  triggerLevelUp(level: number) {
    this.levelUpBanners.push({
      level,
      startFrame: this.frame,
      duration: 50, // ~4초 at 12fps
    });
  }

  // Legendary 수확 플래시 + 대형 파티클
  triggerLegendaryHarvest(slotIndex: number) {
    const row = Math.floor(slotIndex / GRID_COLS);
    const col = slotIndex % GRID_COLS;
    const cx = GRID_OFFSET_X + col * CELL_SIZE + CELL_SIZE / 2;
    const cy = GRID_OFFSET_Y + row * CELL_SIZE + CELL_SIZE / 2;

    // 금색 화면 플래시
    this.screenFlashes.push({
      color: '#fbbf24',
      startFrame: this.frame,
      duration: 8,
    });

    // 큰 별 파티클 12개
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      this.addParticle({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * 1.5,
        vy: Math.sin(angle) * 1.5 - 0.3,
        color: ['#fbbf24', '#FFF176', '#fbbf24'][i % 3],
        life: 25,
        maxLife: 25,
      });
    }
  }

  // 일반 수확 이펙트 (등급별 색상 파티클)
  triggerHarvestParticles(slotIndex: number, rarityColor: string) {
    const row = Math.floor(slotIndex / GRID_COLS);
    const col = slotIndex % GRID_COLS;
    const cx = GRID_OFFSET_X + col * CELL_SIZE + CELL_SIZE / 2;
    const cy = GRID_OFFSET_Y + row * CELL_SIZE + CELL_SIZE / 2;

    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      this.addParticle({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * 0.8,
        vy: Math.sin(angle) * 0.8 - 0.3,
        color: rarityColor,
        life: 18,
        maxLife: 18,
      });
    }

    // 등급 텍스트
    this.floatingTexts.push({
      x: cx - 4, y: cy - 4,
      text: '+1',
      color: rarityColor,
      startFrame: this.frame,
      duration: 18,
    });
  }

  // 물 받을 때 이펙트 (+닉네임 표시)
  triggerWaterReceivedEffect(slotIndex: number, nickname?: string) {
    this.triggerWaterAnim(slotIndex);

    const row = Math.floor(slotIndex / GRID_COLS);
    const col = slotIndex % GRID_COLS;
    const x = GRID_OFFSET_X + col * CELL_SIZE + CELL_SIZE / 2 - 4;
    const y = GRID_OFFSET_Y + row * CELL_SIZE - 2;

    this.floatingTexts.push({
      x, y,
      text: '+1',
      color: '#64B5F6',
      startFrame: this.frame,
      duration: 20,
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
