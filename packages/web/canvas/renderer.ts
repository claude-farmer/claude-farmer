import { PALETTE } from './palette';
import { CROP_SPRITES, drawSprite } from './sprites';
import { composeCharacterSprite, drawGhostCharacter, drawMiniCharacter } from './character';
import type { CropSlot, Footprint, CharacterAppearance } from '@claude-farmer/shared';
import { getTimeOfDay, isBoostTime, type TimeOfDay, GRID_SIZE, GRID_COLS } from '@claude-farmer/shared';
import { type CameraState, DEFAULT_CAMERA, lerpCamera, clampCamera } from './camera';

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
  // 유저 정보 (하단 패널 + 말풍선용)
  ownerNickname?: string;
  ownerLevel?: number;
  ownerStatusText?: string;
  ownerStatusLink?: string;
  ownerTotalHarvests?: number;
  ownerUniqueItems?: number;
  ownerCharacter?: CharacterAppearance;
  visitorProfiles?: Map<string, { nickname: string; level?: number; statusText?: string; statusLink?: string; totalHarvests?: number; character?: CharacterAppearance }>;
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

  // 카메라 시스템
  private camera: CameraState = { ...DEFAULT_CAMERA };
  private targetCamera: CameraState = { ...DEFAULT_CAMERA };

  // 캐릭터 이동 시스템
  private charPos = { x: GRID_OFFSET_X + 4 * CELL_SIZE + 12, y: GRID_OFFSET_Y + 2 * CELL_SIZE };
  private charTarget = { x: GRID_OFFSET_X + 4 * CELL_SIZE + 12, y: GRID_OFFSET_Y + 2 * CELL_SIZE };
  private charMode: 'idle' | 'walk' = 'idle';
  private charFacing: 'right' | 'left' = 'right';

  // 카메라 모드: 1인칭(캐릭터 추적) vs 3인칭(전체 뷰)
  private viewMode: 'first' | 'third' = 'third';
  private static readonly FIRST_PERSON_ZOOM = 2.5;

  // 고스트 캐릭터 (방문자)
  private ghosts: Map<string, {
    nickname: string;
    pos: { x: number; y: number };
    target: { x: number; y: number };
    facing: 'left' | 'right';
    mode: 'idle' | 'walk';
    idleTimer: number;
    opacity: number;
    watered: boolean;
    color: string; // 의상 색상 (유저별 다르게)
    character?: CharacterAppearance;
  }> = new Map();
  private trackedGhostId: string | null = null; // null이면 내 캐릭터 추적
  // 아이콘 사이드바 히트 영역
  private iconHitAreas: { id: string; x: number; y: number; w: number; h: number }[] = [];
  private overflowHitArea: { x: number; y: number; w: number; h: number; remaining: number } | null = null;
  // 하단 정보 패널 버튼 히트 영역
  private infoPanelButtons: { type: 'farm' | 'link'; url: string; x: number; y: number; w: number; h: number }[] = [];
  // +N 모달 요청 플래그
  private _showAllVisitorsRequested = false;
  // 현재 렌더 상태 (drawCharacter/drawGhosts에서 접근용)
  private currentState: FarmRenderState | null = null;

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
    this.currentState = state;

    ctx.clearRect(0, 0, BASE_W, BASE_H);

    // 고스트 캐릭터 동기화 + 업데이트
    if (state.footprints?.length) {
      this.syncGhosts(state.footprints, state.farmOwnerId ?? '');
    } else if (this.ghosts.size > 0) {
      this.ghosts.clear();
      this.trackedGhostId = null;
    }
    this.updateGhosts();

    // 1인칭 모드: 카메라가 추적 대상을 자동 추적
    if (this.viewMode === 'first') {
      const zoom = FarmRenderer.FIRST_PERSON_ZOOM;
      let trackX = this.charPos.x + TILE / 2;
      let trackY = this.charPos.y + TILE / 2;
      // 고스트 추적 중이면 해당 고스트 위치
      if (this.trackedGhostId) {
        const ghost = this.ghosts.get(this.trackedGhostId);
        if (ghost) {
          trackX = ghost.pos.x + 3;
          trackY = ghost.pos.y + 6;
        }
      }
      const camX = (BASE_W / 2) - trackX * zoom;
      const camY = (BASE_H / 2) - trackY * zoom;
      this.targetCamera = clampCamera({ x: camX, y: camY, zoom }, BASE_W, BASE_H);
    }

    // 카메라 보간
    this.camera = lerpCamera(this.camera, this.targetCamera);

    // 카메라 변환 적용 (월드 공간)
    ctx.save();
    ctx.translate(this.camera.x, this.camera.y);
    ctx.scale(this.camera.zoom, this.camera.zoom);

    this.drawSky(tod, boost);
    this.drawGround();
    if (state.footprints?.length) {
      this.drawFootprints(state.footprints, state.farmOwnerId ?? '');
    }
    this.drawGrid(state.grid);
    this.drawGhosts();
    this.drawCharacter(state.characterWorking, boost);
    this.drawWeatherEffects(tod);
    this.drawWaterAnims();
    this.drawFloatingTexts();
    this.drawParticles();

    ctx.restore(); // 카메라 해제

    // HUD (화면 고정, 줌 영향 없음)
    if (boost) this.drawBoostBadge();
    this.drawScreenFlashes();
    this.drawLevelUpBanners();
    this.drawUserIconSidebar();
    if (this.viewMode === 'first') this.drawBottomInfoPanel();

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
    // 둥근 픽셀 구름 (stepped-pixel oval)
    const h = size + 1;
    const w = size * 4;
    // 상단 둥근 범프 (2개의 둥근 봉우리)
    const bumpH = Math.ceil(size * 0.6);
    for (let dy = 0; dy < bumpH; dy++) {
      const bw1 = (bumpH - Math.abs(dy)) * 2;
      const bw2 = (bumpH - Math.abs(dy)) * 2;
      ctx.fillRect(Math.round(x - w * 0.2 - bw1 / 2), y + dy - bumpH, bw1, 1);
      ctx.fillRect(Math.round(x + w * 0.15 - bw2 / 2), y + dy - bumpH + 1, bw2, 1);
    }
    // 본체 (넓은 타원)
    for (let dy = 0; dy < h; dy++) {
      const ratio = 1 - Math.abs(dy - h * 0.3) / (h * 0.8);
      const rowW = Math.round(w * Math.max(0.4, ratio));
      ctx.fillRect(Math.round(x - rowW / 2), y + dy, rowW, 1);
    }
  }

  private drawCelestialBody(tod: TimeOfDay) {
    const ctx = this.ctx;
    if (tod === 'morning') {
      // 아침 해: 둥근 6×6 + 부드러운 광선
      const sx = 20, sy = 30;
      ctx.fillStyle = PALETTE.sunMorning;
      ctx.fillRect(sx + 1, sy, 4, 1);
      ctx.fillRect(sx, sy + 1, 6, 4);
      ctx.fillRect(sx + 1, sy + 5, 4, 1);
    } else if (tod === 'afternoon') {
      // 오후 해: 둥근 8×8 + 빛살
      const sx = BASE_W / 2 - 4, sy = 4;
      ctx.fillStyle = PALETTE.sunAfternoon;
      ctx.fillRect(sx + 2, sy, 4, 1);
      ctx.fillRect(sx + 1, sy + 1, 6, 1);
      ctx.fillRect(sx, sy + 2, 8, 4);
      ctx.fillRect(sx + 1, sy + 6, 6, 1);
      ctx.fillRect(sx + 2, sy + 7, 4, 1);
      // 빛살 (깜빡이는 십자)
      if (this.frame % 30 < 15) {
        ctx.fillRect(sx + 3, sy - 2, 2, 1);
        ctx.fillRect(sx + 3, sy + 9, 2, 1);
        ctx.fillRect(sx - 2, sy + 3, 1, 2);
        ctx.fillRect(sx + 9, sy + 3, 1, 2);
      }
    } else if (tod === 'evening') {
      // 저녁 해: 둥근 6×6
      const sx = BASE_W - 30, sy = 30;
      ctx.fillStyle = PALETTE.sunEvening;
      ctx.fillRect(sx + 1, sy, 4, 1);
      ctx.fillRect(sx, sy + 1, 6, 4);
      ctx.fillRect(sx + 1, sy + 5, 4, 1);
    } else {
      // 달: 둥근 초승달
      const mx = BASE_W - 25, my = 5;
      ctx.fillStyle = PALETTE.moon;
      ctx.fillRect(mx + 1, my, 3, 1);
      ctx.fillRect(mx, my + 1, 5, 1);
      ctx.fillRect(mx, my + 2, 5, 2);
      ctx.fillRect(mx, my + 4, 5, 1);
      ctx.fillRect(mx + 1, my + 5, 3, 1);
      // 그림자 (초승달 효과)
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(mx + 3, my + 1, 2, 4);
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

    // 잔디 위 장식: 작은 꽃, 돌
    this.drawGrassDecorations(groundY);

    // 농장 울타리 + 흙길
    this.drawFence();

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

  // ── 잔디 장식 ──
  private drawGrassDecorations(groundY: number) {
    const ctx = this.ctx;
    const farmLeft = GRID_OFFSET_X - 6;
    const farmRight = GRID_OFFSET_X + 4 * CELL_SIZE + 6;

    // 결정론적 꽃/돌 배치 (프레임마다 동일)
    const decorations = [
      // 왼쪽 풀밭 꽃
      { x: 12, y: groundY + 20, type: 'flower', color: '#FF6B81' },
      { x: 28, y: groundY + 40, type: 'flower', color: '#FACC15' },
      { x: 8, y: groundY + 70, type: 'flower', color: '#FF9A9E' },
      { x: 38, y: groundY + 55, type: 'flower', color: '#FFFFFF' },
      { x: 20, y: groundY + 90, type: 'flower', color: '#a78bfa' },
      { x: 45, y: groundY + 15, type: 'stone', color: '' },
      { x: 15, y: groundY + 105, type: 'stone', color: '' },
      // 오른쪽 풀밭 꽃
      { x: farmRight + 10, y: groundY + 25, type: 'flower', color: '#FACC15' },
      { x: farmRight + 30, y: groundY + 50, type: 'flower', color: '#FF6B81' },
      { x: farmRight + 18, y: groundY + 75, type: 'flower', color: '#FFFFFF' },
      { x: farmRight + 40, y: groundY + 35, type: 'flower', color: '#a78bfa' },
      { x: farmRight + 8, y: groundY + 100, type: 'flower', color: '#FF9A9E' },
      { x: farmRight + 35, y: groundY + 15, type: 'stone', color: '' },
      { x: farmRight + 22, y: groundY + 90, type: 'stone', color: '' },
    ];

    for (const d of decorations) {
      if (d.x >= farmLeft && d.x <= farmRight) continue; // 농장 영역 안이면 스킵

      if (d.type === 'flower') {
        // 꽃: 줄기 + 꽃잎 (둥글둥글)
        ctx.fillStyle = '#5A9E32';
        ctx.fillRect(d.x, d.y + 1, 1, 2); // 줄기
        ctx.fillStyle = d.color;
        ctx.fillRect(d.x, d.y, 1, 1); // 꽃잎 중앙
        ctx.fillRect(d.x - 1, d.y, 1, 1); // 좌
        ctx.fillRect(d.x + 1, d.y, 1, 1); // 우
        ctx.fillRect(d.x, d.y - 1, 1, 1); // 상

        // 일부 꽃에 흔들리는 애니메이션
        const sway = Math.sin(this.frame * 0.05 + d.x) > 0.7 ? 1 : 0;
        if (sway) {
          ctx.fillRect(d.x + 1, d.y - 1, 1, 1);
        }
      } else if (d.type === 'stone') {
        // 돌: 둥근 형태 (4×3 stepped-pixel oval)
        ctx.fillStyle = '#b0b8c4';
        ctx.fillRect(d.x + 1, d.y, 2, 1);     // 상단
        ctx.fillRect(d.x, d.y + 1, 4, 1);       // 중간
        ctx.fillRect(d.x + 1, d.y + 2, 2, 1);   // 하단
        ctx.fillStyle = '#8b929e';
        ctx.fillRect(d.x + 2, d.y + 1, 1, 1);   // 하이라이트
      }
    }

    // 잔디 터프트 (작은 풀 다발)
    const tufts = [
      { x: 5, y: groundY + 12 }, { x: 35, y: groundY + 35 },
      { x: 18, y: groundY + 80 }, { x: 42, y: groundY + 100 },
      { x: farmRight + 5, y: groundY + 18 }, { x: farmRight + 28, y: groundY + 60 },
      { x: farmRight + 42, y: groundY + 85 }, { x: farmRight + 15, y: groundY + 108 },
    ];
    for (const t of tufts) {
      if (t.x >= farmLeft && t.x <= farmRight) continue;
      ctx.fillStyle = '#6BBF3B';
      ctx.fillRect(t.x, t.y, 1, 2);
      ctx.fillRect(t.x + 1, t.y - 1, 1, 3);
      ctx.fillRect(t.x + 2, t.y, 1, 2);
    }

    // 나비 (1-2px, 느리게 이동)
    const butterflies = [
      { baseX: 25, baseY: groundY + 30, color: '#FFD54F' },
      { baseX: farmRight + 20, baseY: groundY + 45, color: '#FF9A9E' },
    ];
    for (const b of butterflies) {
      const bx = b.baseX + Math.sin(this.frame * 0.03 + b.baseX) * 10;
      const by = b.baseY + Math.cos(this.frame * 0.02 + b.baseY) * 5;
      ctx.fillStyle = b.color;
      // 날갯짓
      const wingOpen = this.frame % 16 < 8;
      if (wingOpen) {
        ctx.fillRect(bx - 1, by, 1, 1);
        ctx.fillRect(bx + 1, by, 1, 1);
      } else {
        ctx.fillRect(bx - 1, by - 1, 1, 1);
        ctx.fillRect(bx + 1, by - 1, 1, 1);
      }
      ctx.fillStyle = '#3E2723';
      ctx.fillRect(bx, by, 1, 1); // 몸통
    }
  }

  // ── 농장 울타리 ──
  private drawFence() {
    const ctx = this.ctx;
    const fenceX = GRID_OFFSET_X - 6;
    const fenceY = GRID_OFFSET_Y - 6;
    const fenceW = 4 * CELL_SIZE + 12;
    const fenceH = 4 * CELL_SIZE + 10;

    const postColor = PALETTE.fence;
    const railColor = PALETTE.treeTrunk;

    // 울타리 기둥 (모서리 + 중간)
    const posts: [number, number][] = [
      // 모서리
      [fenceX, fenceY], [fenceX + fenceW - 2, fenceY],
      [fenceX, fenceY + fenceH - 2], [fenceX + fenceW - 2, fenceY + fenceH - 2],
      // 상단/하단 중간
      [fenceX + fenceW / 2, fenceY], [fenceX + fenceW / 2, fenceY + fenceH - 2],
      // 좌/우 중간
      [fenceX, fenceY + fenceH / 2], [fenceX + fenceW - 2, fenceY + fenceH / 2],
    ];

    // 가로 레일 (상단, 하단)
    ctx.fillStyle = railColor;
    ctx.fillRect(fenceX + 1, fenceY + 1, fenceW - 2, 1); // 상단 레일
    ctx.fillRect(fenceX + 1, fenceY + 3, fenceW - 2, 1); // 상단 레일 하단
    ctx.fillRect(fenceX + 1, fenceY + fenceH - 2, fenceW - 2, 1); // 하단 레일
    ctx.fillRect(fenceX + 1, fenceY + fenceH - 4, fenceW - 2, 1); // 하단 레일 상단

    // 세로 레일 (좌, 우)
    ctx.fillRect(fenceX + 1, fenceY + 1, 1, fenceH - 2);
    ctx.fillRect(fenceX + 3, fenceY + 1, 1, fenceH - 2);
    ctx.fillRect(fenceX + fenceW - 2, fenceY + 1, 1, fenceH - 2);
    ctx.fillRect(fenceX + fenceW - 4, fenceY + 1, 1, fenceH - 2);

    // 기둥 (약간 더 두꺼운 2×5 사각형)
    ctx.fillStyle = postColor;
    for (const [px, py] of posts) {
      ctx.fillRect(px, py, 2, 5);
    }

    // 흙 진입로 (하단 중앙에 작은 흙길)
    const pathX = GRID_OFFSET_X + 2 * CELL_SIZE - 6;
    const pathY = fenceY + fenceH;
    ctx.fillStyle = PALETTE.path;
    ctx.fillRect(pathX, pathY, 12, 6);
    ctx.fillStyle = PALETTE.pathDark;
    ctx.fillRect(pathX + 2, pathY + 2, 2, 1);
    ctx.fillRect(pathX + 7, pathY + 4, 2, 1);
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
    const ownerSprite = composeCharacterSprite(this.currentState?.ownerCharacter);

    // 캐릭터 이동 보간
    if (this.charMode === 'walk') {
      const dx = this.charTarget.x - this.charPos.x;
      const dy = this.charTarget.y - this.charPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1.5) {
        this.charPos.x = this.charTarget.x;
        this.charPos.y = this.charTarget.y;
        this.charMode = 'idle';
      } else {
        const speed = 0.8;
        this.charPos.x += (dx / dist) * speed;
        this.charPos.y += (dy / dist) * speed;
        // 이동 방향에 따라 좌우 반전
        if (dx > 0.5) this.charFacing = 'right';
        else if (dx < -0.5) this.charFacing = 'left';
      }
    }

    const bouncePeriod = boost ? 24 : 40;
    const bounceY = this.frame % bouncePeriod < bouncePeriod / 2 ? 0 : -1;
    // 걸을 때 더 빠른 바운스
    const walkBounce = this.charMode === 'walk' ? (this.frame % 6 < 3 ? -1 : 0) : 0;
    const charX = Math.round(this.charPos.x);
    const charY = Math.round(this.charPos.y) + bounceY + walkBounce;

    // 부스트 잔영
    if (boost) {
      const afterimages = [
        { offset: 2, alpha: 0.1 },
        { offset: 1, alpha: 0.25 },
      ];
      for (const ai of afterimages) {
        ctx.globalAlpha = ai.alpha;
        if (this.charFacing === 'left') {
          ctx.save();
          ctx.translate(charX + TILE, charY + ai.offset);
          ctx.scale(-1, 1);
          drawSprite(ctx, ownerSprite, -ai.offset, 0, 1);
          ctx.restore();
        } else {
          drawSprite(ctx, ownerSprite, charX - ai.offset, charY + ai.offset, 1);
        }
        ctx.globalAlpha = ai.alpha * 0.3;
        ctx.fillStyle = '#a78bfa';
        ctx.fillRect(charX - ai.offset, charY + ai.offset, TILE, TILE);
      }
      ctx.globalAlpha = 1;
    }

    // 좌우 반전 처리
    if (this.charFacing === 'left') {
      ctx.save();
      ctx.translate(charX + TILE, charY);
      ctx.scale(-1, 1);
      drawSprite(ctx, ownerSprite, 0, 0, 1);
      ctx.restore();
    } else {
      drawSprite(ctx, ownerSprite, charX, charY, 1);
    }

    // 상태 메시지 말풍선 (주인 캐릭터)
    if (this.currentState?.ownerStatusText && !this.trackedGhostId) {
      this.drawPixelSpeechBubble(charX + TILE / 2, charY - 2, this.currentState.ownerStatusText);
    }

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

  // ── 고스트 캐릭터 시스템 ──

  // 의상 색상 생성 (github_id 기반 결정론적)
  private static ghostColor(id: string): string {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
    const colors = ['#E57373', '#81C784', '#64B5F6', '#FFB74D', '#BA68C8', '#4DB6AC', '#F06292', '#AED581'];
    return colors[Math.abs(h) % colors.length];
  }

  // footprints → 고스트 동기화 (새 방문자 추가, 사라진 방문자 제거)
  private syncGhosts(footprints: Footprint[], farmOwnerId: string) {
    const groundY = SKY_TILES * TILE;
    const activeIds = new Set<string>();

    for (const fp of footprints) {
      const hoursAgo = (Date.now() - new Date(fp.visited_at).getTime()) / (1000 * 60 * 60);
      if (hoursAgo > 24) continue;

      const id = fp.github_id;
      activeIds.add(id);

      if (!this.ghosts.has(id)) {
        // 새 고스트: 결정론적 초기 위치
        const pos = this.hashPosition(id, farmOwnerId, groundY, GRID_OFFSET_X - 2, GRID_OFFSET_X + 4 * CELL_SIZE + 2);
        this.ghosts.set(id, {
          nickname: fp.nickname,
          pos: { ...pos },
          target: { ...pos },
          facing: Math.abs(pos.x) % 2 === 0 ? 'right' : 'left',
          mode: 'idle',
          idleTimer: Math.floor(Math.random() * 80),
          opacity: Math.max(0.15, 1 - hoursAgo / 24) * 0.6,
          watered: fp.watered ?? false,
          color: FarmRenderer.ghostColor(id),
          character: this.currentState?.visitorProfiles?.get(id)?.character,
        });
      } else {
        // 기존 고스트: character 업데이트 (프로필 데이터가 나중에 로드될 수 있음)
        const ghost = this.ghosts.get(id)!;
        const newChar = this.currentState?.visitorProfiles?.get(id)?.character;
        if (newChar && !ghost.character) {
          ghost.character = newChar;
        }
      }
    }

    // 사라진 방문자 제거
    for (const id of this.ghosts.keys()) {
      if (!activeIds.has(id)) {
        this.ghosts.delete(id);
        if (this.trackedGhostId === id) this.trackedGhostId = null;
      }
    }
  }

  // 고스트 AI: 농장 주변을 천천히 돌아다님
  private updateGhosts() {
    const groundY = SKY_TILES * TILE;
    for (const [, ghost] of this.ghosts) {
      if (ghost.mode === 'walk') {
        const dx = ghost.target.x - ghost.pos.x;
        const dy = ghost.target.y - ghost.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) {
          ghost.pos.x = ghost.target.x;
          ghost.pos.y = ghost.target.y;
          ghost.mode = 'idle';
          ghost.idleTimer = 0;
        } else {
          const speed = 0.35; // 느린 걸음 (유령스러운 느낌)
          ghost.pos.x += (dx / dist) * speed;
          ghost.pos.y += (dy / dist) * speed;
          if (dx > 0.3) ghost.facing = 'right';
          else if (dx < -0.3) ghost.facing = 'left';
        }
      } else {
        ghost.idleTimer++;
        // 랜덤 간격으로 새 목적지
        if (ghost.idleTimer > 100 + Math.abs(ghost.pos.x * 7) % 120) {
          // 농장 영역 주변 풀밭으로 이동
          const nx = 8 + Math.abs(Math.sin(this.frame * 0.01 + ghost.pos.x) * 0.5 + 0.5) * (BASE_W - 20);
          const ny = groundY + 8 + Math.abs(Math.cos(this.frame * 0.01 + ghost.pos.y) * 0.5 + 0.5) * (BASE_H - groundY - 24);
          ghost.target = { x: nx, y: ny };
          ghost.mode = 'walk';
        }
      }
    }
  }

  // 고스트 렌더링 (반투명 캐릭터)
  private drawGhosts() {
    const ctx = this.ctx;
    for (const [id, ghost] of this.ghosts) {
      const px = Math.round(ghost.pos.x);
      const py = Math.round(ghost.pos.y);
      const bounce = ghost.mode === 'walk'
        ? (this.frame % 10 < 5 ? -1 : 0)
        : (this.frame % 50 < 25 ? 0 : -1);

      const isTracked = this.trackedGhostId === id;
      ctx.save();
      ctx.globalAlpha = isTracked ? Math.min(ghost.opacity * 1.5, 0.9) : ghost.opacity;

      // 의상 색 오버레이로 캐릭터 구분
      if (ghost.facing === 'left') {
        ctx.save();
        ctx.translate(px + 6, py + bounce);
        ctx.scale(-1, 1);
        drawGhostCharacter(ctx, 0, 0, ghost.character);
        ctx.restore();
      } else {
        drawGhostCharacter(ctx, px, py + bounce, ghost.character);
      }

      // 닉네임 표시 (추적 중이면 항상, 아니면 마우스 근처일 때)
      if (isTracked) {
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        const tw = Math.min(ghost.nickname.length * 3 + 6, 50);
        ctx.fillRect(px - tw / 2 + 3, py - 8, tw, 6);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '4px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(ghost.nickname.slice(0, 12), px + 3, py - 3);
      }

      // 추적 중인 고스트의 상태 메시지 말풍선
      if (isTracked) {
        const profile = this.currentState?.visitorProfiles?.get(id);
        if (profile?.statusText) {
          this.drawPixelSpeechBubble(px + 3, py - 4, profile.statusText);
        }
      }

      // 물 줬으면 물방울 아이콘
      if (ghost.watered) {
        ctx.globalAlpha = ghost.opacity;
        ctx.fillStyle = '#64B5F6';
        ctx.fillRect(px + 7, py - 3, 1, 2);
        ctx.fillRect(px + 6, py - 1, 3, 1);
      }

      ctx.restore();
    }
  }


  // ── 좌측 아이콘 사이드바 (HUD) ──
  private drawUserIconSidebar() {
    const ctx = this.ctx;
    const iconSize = 10; // 10×10 (8×8 스프라이트 + 1px 테두리)
    const gap = 2;
    const maxVisible = 4; // 주인 제외 최대 방문자 수
    const sideX = 2;
    let y = 3;

    this.iconHitAreas = [];
    this.overflowHitArea = null;

    // ── 주인 아이콘 (항상 첫 번째) ──
    const meTracked = this.viewMode === 'first' && !this.trackedGhostId;
    // 테두리
    ctx.fillStyle = meTracked ? '#fbbf24' : 'rgba(255,255,255,0.3)';
    ctx.fillRect(sideX, y, iconSize, iconSize);
    // 배경
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(sideX + 1, y + 1, iconSize - 2, iconSize - 2);
    // 미니 캐릭터 (주인)
    drawMiniCharacter(ctx, sideX + 2, y + 1, this.currentState?.ownerCharacter);
    this.iconHitAreas.push({ id: '__me__', x: sideX, y, w: iconSize, h: iconSize });
    y += iconSize + gap;

    // ── 방문자 아이콘 ──
    const ghosts = Array.from(this.ghosts.entries());
    const visibleCount = Math.min(ghosts.length, maxVisible);

    for (let i = 0; i < visibleCount; i++) {
      const [id, ghost] = ghosts[i];
      const isTracked = this.trackedGhostId === id;

      // 테두리
      ctx.fillStyle = isTracked ? '#fbbf24' : 'rgba(255,255,255,0.15)';
      ctx.fillRect(sideX, y, iconSize, iconSize);
      // 배경
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(sideX + 1, y + 1, iconSize - 2, iconSize - 2);
      // 미니 캐릭터
      drawMiniCharacter(ctx, sideX + 2, y + 1, ghost.character);
      // 물 줬으면 파란 점
      if (ghost.watered) {
        ctx.fillStyle = '#64B5F6';
        ctx.fillRect(sideX + iconSize - 3, y + 1, 2, 2);
      }

      this.iconHitAreas.push({ id, x: sideX, y, w: iconSize, h: iconSize });
      y += iconSize + gap;
    }

    // ── "+N" 오버플로 버튼 ──
    const remaining = ghosts.length - visibleCount;
    if (remaining > 0) {
      const btnW = iconSize;
      const btnH = 8;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(sideX, y, btnW, btnH);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(sideX, y, btnW, 1);
      ctx.fillStyle = '#9ca3af';
      ctx.font = '4px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`+${remaining}`, sideX + btnW / 2, y + 6);
      ctx.textAlign = 'start';
      this.overflowHitArea = { x: sideX, y, w: btnW, h: btnH, remaining };
    }
  }


  // ── 하단 유저 정보 패널 (1인칭 모드 전용) ──
  private drawBottomInfoPanel() {
    const ctx = this.ctx;
    const state = this.currentState;
    if (!state) return;

    this.infoPanelButtons = [];

    // 추적 대상 정보 수집
    let nickname = '';
    let level = 0;
    let harvests = 0;
    let statusLink: string | undefined;
    let farmId: string | undefined;

    if (!this.trackedGhostId) {
      // 내 정보
      nickname = state.ownerNickname ?? '';
      level = state.ownerLevel ?? 1;
      harvests = state.ownerTotalHarvests ?? 0;
      statusLink = state.ownerStatusLink;
    } else {
      // 고스트 정보
      const ghost = this.ghosts.get(this.trackedGhostId);
      const profile = state.visitorProfiles?.get(this.trackedGhostId);
      if (ghost) {
        nickname = ghost.nickname;
        level = profile?.level ?? 0;
        harvests = profile?.totalHarvests ?? 0;
        statusLink = profile?.statusLink;
        farmId = this.trackedGhostId;
      }
    }

    if (!nickname) return;

    // 패널 크기 계산
    const panelW = 120;
    const panelH = farmId || statusLink ? 24 : 16;
    const panelX = (BASE_W - panelW) / 2;
    const panelY = BASE_H - panelH - 4;

    // 배경
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(panelX, panelY, panelW, panelH);
    // 픽셀 테두리
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(panelX, panelY, panelW, 1);
    ctx.fillRect(panelX, panelY + panelH - 1, panelW, 1);
    ctx.fillRect(panelX, panelY, 1, panelH);
    ctx.fillRect(panelX + panelW - 1, panelY, 1, panelH);

    // 1행: 닉네임 + Lv
    ctx.font = '4px monospace';
    ctx.fillStyle = '#FFFFFF';
    const displayName = nickname.length > 14 ? nickname.slice(0, 13) + '…' : nickname;
    ctx.fillText(displayName, panelX + 3, panelY + 7);
    ctx.fillStyle = '#9ca3af';
    ctx.fillText(`Lv.${level}`, panelX + panelW - 20, panelY + 7);

    // 2행: 수확수
    ctx.fillStyle = '#e5e7eb';
    ctx.fillText(`🌾${harvests}`, panelX + 3, panelY + 14);

    // 3행: 버튼 (방문자 추적 시만)
    if (farmId || statusLink) {
      let btnX = panelX + 3;
      const btnY = panelY + 16;
      const btnH = 6;

      if (farmId) {
        const btnW = 24;
        ctx.fillStyle = '#4DB6AC';
        ctx.fillRect(btnX, btnY, btnW, btnH);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '3px monospace';
        ctx.fillText('Farm', btnX + 3, btnY + 5);
        this.infoPanelButtons.push({
          type: 'farm', url: `/farm?visit=${farmId}`,
          x: btnX, y: btnY, w: btnW, h: btnH,
        });
        btnX += btnW + 3;
      }

      if (statusLink) {
        const btnW = 24;
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(btnX, btnY, btnW, btnH);
        ctx.fillStyle = '#000000';
        ctx.font = '3px monospace';
        ctx.fillText('Link', btnX + 3, btnY + 5);
        this.infoPanelButtons.push({
          type: 'link', url: statusLink,
          x: btnX, y: btnY, w: btnW, h: btnH,
        });
      }
    }
  }

  // ── 픽셀아트 말풍선 ──
  private drawPixelSpeechBubble(x: number, y: number, text: string) {
    const ctx = this.ctx;
    const maxChars = 28;
    const displayText = text.length > maxChars ? text.slice(0, maxChars - 1) + '…' : text;

    // 텍스트 크기 계산
    ctx.font = '4px monospace';
    const textW = Math.min(ctx.measureText(displayText).width, 100);
    const padX = 4;
    const padY = 3;
    const bubbleW = Math.ceil(textW) + padX * 2;
    const bubbleH = 8 + padY;
    const bx = Math.round(x - bubbleW / 2);
    const by = y - bubbleH - 4;

    // 픽셀 테두리 패턴 (계단 모서리)
    const borderColor = '#5B4A3A';
    const bgColor = '#FFFBE6';

    // 배경 (안쪽)
    ctx.fillStyle = bgColor;
    ctx.fillRect(bx + 2, by, bubbleW - 4, bubbleH);
    ctx.fillRect(bx + 1, by + 1, bubbleW - 2, bubbleH - 2);
    ctx.fillRect(bx, by + 2, bubbleW, bubbleH - 4);

    // 테두리 (계단 모서리)
    ctx.fillStyle = borderColor;
    // 상단
    ctx.fillRect(bx + 2, by - 1, bubbleW - 4, 1);
    // 하단
    ctx.fillRect(bx + 2, by + bubbleH, bubbleW - 4, 1);
    // 좌측
    ctx.fillRect(bx - 1, by + 2, 1, bubbleH - 4);
    // 우측
    ctx.fillRect(bx + bubbleW, by + 2, 1, bubbleH - 4);
    // 모서리 계단
    ctx.fillRect(bx + 1, by, 1, 1);
    ctx.fillRect(bx, by + 1, 1, 1);
    ctx.fillRect(bx + bubbleW - 2, by, 1, 1);
    ctx.fillRect(bx + bubbleW - 1, by + 1, 1, 1);
    ctx.fillRect(bx + 1, by + bubbleH - 1, 1, 1);
    ctx.fillRect(bx, by + bubbleH - 2, 1, 1);
    ctx.fillRect(bx + bubbleW - 2, by + bubbleH - 1, 1, 1);
    ctx.fillRect(bx + bubbleW - 1, by + bubbleH - 2, 1, 1);

    // 꼬리 (하단 중앙)
    const tailX = Math.round(x);
    const tailY = by + bubbleH + 1;
    ctx.fillStyle = bgColor;
    ctx.fillRect(tailX - 1, tailY, 3, 1);
    ctx.fillRect(tailX, tailY + 1, 1, 1);
    ctx.fillStyle = borderColor;
    ctx.fillRect(tailX - 2, tailY, 1, 1);
    ctx.fillRect(tailX + 2, tailY, 1, 1);
    ctx.fillRect(tailX - 1, tailY + 1, 1, 1);
    ctx.fillRect(tailX + 1, tailY + 1, 1, 1);
    ctx.fillRect(tailX, tailY + 2, 1, 1);

    // 텍스트
    ctx.fillStyle = '#3E2723';
    ctx.font = '4px monospace';
    ctx.fillText(displayText, bx + padX, by + padY + 4);
  }

  // 유저 리스트 클릭 감지 (화면 좌표 기준, 줌 무관)
  hitTestUserList(screenX: number, screenY: number, canvasWidth: number, canvasHeight: number): { type: 'user' | 'overflow'; id?: string } | null {
    const scaleX = BASE_W / canvasWidth;
    const scaleY = BASE_H / canvasHeight;
    const cx = screenX * scaleX;
    const cy = screenY * scaleY;

    // 아이콘 체크
    for (const area of this.iconHitAreas) {
      if (cx >= area.x && cx <= area.x + area.w && cy >= area.y && cy <= area.y + area.h) {
        return { type: 'user', id: area.id };
      }
    }
    // 오버플로 체크
    if (this.overflowHitArea) {
      const o = this.overflowHitArea;
      if (cx >= o.x && cx <= o.x + o.w && cy >= o.y && cy <= o.y + o.h) {
        return { type: 'overflow' };
      }
    }
    return null;
  }

  // 하단 패널 버튼 클릭 감지
  hitTestInfoPanel(screenX: number, screenY: number, canvasWidth: number, canvasHeight: number): { type: 'farm' | 'link'; url: string } | null {
    const scaleX = BASE_W / canvasWidth;
    const scaleY = BASE_H / canvasHeight;
    const cx = screenX * scaleX;
    const cy = screenY * scaleY;

    for (const btn of this.infoPanelButtons) {
      if (cx >= btn.x && cx <= btn.x + btn.w && cy >= btn.y && cy <= btn.y + btn.h) {
        return { type: btn.type, url: btn.url };
      }
    }
    return null;
  }

  // +N 모달 요청 확인 + 리셋
  consumeShowAllVisitors(): boolean {
    if (this._showAllVisitorsRequested) {
      this._showAllVisitorsRequested = false;
      return true;
    }
    return false;
  }

  getGhostList(): { id: string; nickname: string; color: string; watered: boolean }[] {
    return Array.from(this.ghosts.entries()).map(([id, g]) => ({
      id, nickname: g.nickname, color: g.color, watered: g.watered,
    }));
  }

  // 고스트 추적 설정
  trackUser(userId: string | null) {
    if (userId === '__me__' || userId === null) {
      this.trackedGhostId = null;
      this.viewMode = 'first';
    } else if (this.ghosts.has(userId)) {
      this.trackedGhostId = userId;
      this.viewMode = 'first';
    }
  }

  getTrackedGhostId(): string | null {
    return this.trackedGhostId;
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

  // ── 카메라 API ──
  setTargetCamera(cam: CameraState) {
    this.targetCamera = clampCamera(cam, BASE_W, BASE_H);
  }

  getCamera(): CameraState {
    return { ...this.camera };
  }

  getTargetCamera(): CameraState {
    return { ...this.targetCamera };
  }

  resetCamera() {
    this.targetCamera = { ...DEFAULT_CAMERA };
  }

  // ── 시점 모드 API ──
  toggleViewMode(): 'first' | 'third' {
    if (this.viewMode === 'third') {
      this.viewMode = 'first';
      this.trackedGhostId = null; // 내 캐릭터 추적으로 시작
    } else {
      this.viewMode = 'third';
      this.trackedGhostId = null;
      this.targetCamera = { ...DEFAULT_CAMERA };
    }
    return this.viewMode;
  }

  getViewMode(): 'first' | 'third' {
    return this.viewMode;
  }

  setViewMode(mode: 'first' | 'third') {
    this.viewMode = mode;
    if (mode === 'third') {
      this.trackedGhostId = null;
      this.targetCamera = { ...DEFAULT_CAMERA };
    }
  }

  // ── 자동 줌 (작은 화면용) ──
  autoZoomForSmallScreen(containerWidth: number) {
    if (containerWidth >= 400) return; // 충분히 크면 기본 줌 유지
    // 1.5x 줌, 그리드 중앙에 맞춤
    const zoom = 1.5;
    const gridCenterX = GRID_OFFSET_X + 2 * CELL_SIZE;
    const gridCenterY = GRID_OFFSET_Y + 2 * CELL_SIZE;
    const camX = (BASE_W / 2) - gridCenterX * zoom;
    const camY = (BASE_H / 2) - gridCenterY * zoom;
    const cam = clampCamera({ x: camX, y: camY, zoom }, BASE_W, BASE_H);
    this.camera = { ...cam };
    this.targetCamera = { ...cam };
  }

  // ── 캐릭터 이동 API ──
  moveCharacterTo(worldX: number, worldY: number) {
    // 이동 범위 제한: 캔버스 영역 내
    const groundY = SKY_TILES * TILE;
    const clampedX = Math.max(0, Math.min(BASE_W - TILE, worldX - TILE / 2));
    const clampedY = Math.max(groundY, Math.min(BASE_H - TILE, worldY - TILE / 2));
    this.charTarget = { x: clampedX, y: clampedY };
    this.charMode = 'walk';
  }
}
