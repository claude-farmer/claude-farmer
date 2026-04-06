import { PALETTE } from './palette';
import { CROP_SPRITES, drawSprite } from './sprites';
import { composeCharacterSprite, drawGhostCharacter, drawMiniCharacter } from './character';
import type { CropSlot, Footprint, CharacterAppearance } from '@claude-farmer/shared';
import { getTimeOfDay, isBoostTime, getFarmWeather, type TimeOfDay, type FarmWeather, GRID_SIZE, GRID_COLS } from '@claude-farmer/shared';
import { type CameraState, DEFAULT_CAMERA, lerpCamera, clampCamera } from './camera';

// 캔버스 설정: 256×192px 기본, 4× 스케일
const BASE_W = 256;
const BASE_H = 192;
const TILE = 16;
const SKY_TILES = 3;   // 하늘 3타일 높이
const GRID_OFFSET_X = 4 * TILE; // 그리드 시작 X (타일 4)
const GRID_OFFSET_Y = SKY_TILES * TILE + TILE; // 하늘 + 여백 1타일
const CELL_SIZE = 2 * TILE; // 각 칸 32px (16px 작물 + 여백)

export interface DecorationItem {
  itemId: string;
  count: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface FarmRenderState {
  grid: (CropSlot | null)[];
  characterWorking: boolean;
  footprints?: Footprint[];
  farmOwnerId?: string;
  decorations?: DecorationItem[];
  totalWaterReceived?: number;
  streakDays?: number;
  // 유저 정보 (하단 패널 + 말풍선용)
  ownerNickname?: string;
  ownerLevel?: number;
  ownerStatusText?: string;
  ownerStatusLink?: string;
  ownerTotalHarvests?: number;
  ownerUniqueItems?: number;
  ownerCharacter?: CharacterAppearance;
  ownerAvatarUrl?: string;
  visitorProfiles?: Map<string, { nickname: string; level?: number; statusText?: string; statusLink?: string; totalHarvests?: number; character?: CharacterAppearance; avatarUrl?: string }>;
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
    avatarUrl?: string;
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
  // 아바타 이미지 캐시
  private avatarCache = new Map<string, HTMLImageElement | null>();

  private addParticle(p: Particle) {
    if (this.particles.length < FarmRenderer.MAX_PARTICLES) {
      this.particles.push(p);
    }
  }

  // 아바타 이미지 로드 (비동기, 캐시)
  private getAvatar(url: string | undefined): HTMLImageElement | null {
    if (!url) return null;
    // 작은 사이즈 요청 (GitHub avatar ?s=32)
    const smallUrl = url.includes('?') ? `${url}&s=32` : `${url}?s=32`;
    const cached = this.avatarCache.get(smallUrl);
    if (cached !== undefined) return cached;
    // 로딩 중 표시를 위해 null 세팅
    this.avatarCache.set(smallUrl, null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => this.avatarCache.set(smallUrl, img);
    img.onerror = () => this.avatarCache.set(smallUrl, null);
    img.src = smallUrl;
    return null;
  }

  constructor(private canvas: HTMLCanvasElement) {
    canvas.width = BASE_W;
    canvas.height = BASE_H;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;

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
    ctx.imageSmoothingEnabled = false;

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
    if (state.decorations?.length) {
      this.drawItemDecorations(state.decorations, state.totalWaterReceived ?? 0);
    }
    if (state.streakDays && state.streakDays > 0) {
      this.drawBonfire(state.streakDays);
    }
    if (state.footprints?.length) {
      this.drawFootprints(state.footprints, state.farmOwnerId ?? '');
    }
    this.drawGrid(state.grid);
    this.drawGhosts();
    this.drawCharacter(state.characterWorking, boost);
    const weather = state.farmOwnerId ? getFarmWeather(state.farmOwnerId) : 'clear';
    this.drawWeatherEffects(tod, weather);
    this.drawWaterAnims();
    this.drawFloatingTexts();
    this.drawParticles();

    ctx.restore(); // 카메라 해제

    // HUD (화면 고정, 줌 영향 없음)
    if (boost) this.drawBoostBadge();
    this.drawScreenFlashes();
    this.drawLevelUpBanners();
    this.drawUserIconSidebar();
    // 하단 정보 패널은 HTML 오버레이로 대체 (drawBottomInfoPanel 미사용)

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

  // ── 아이템 장식 (수집품 + 선물) ──
  private drawItemDecorations(decorations: DecorationItem[], totalWater: number) {
    const ctx = this.ctx;
    const groundY = SKY_TILES * TILE;
    const farmRight = GRID_OFFSET_X + 4 * CELL_SIZE + 8;

    // 존(Zone) 기반 배치: 우측 진열대 + 좌측 정원 + 하단
    const shelfX = farmRight + 4;
    const slots = [
      // 우측 진열대 (눈에 띄는 위치, 레전더리/에픽 우선)
      { x: shelfX, y: groundY + 10 }, { x: shelfX + 18, y: groundY + 10 },
      { x: shelfX, y: groundY + 30 }, { x: shelfX + 18, y: groundY + 30 },
      { x: shelfX, y: groundY + 50 }, { x: shelfX + 18, y: groundY + 50 },
      // 좌측 정원
      { x: 4, y: groundY + 16 }, { x: 22, y: groundY + 16 },
      { x: 4, y: groundY + 40 }, { x: 22, y: groundY + 40 },
      { x: 4, y: groundY + 64 }, { x: 22, y: groundY + 64 },
      // 하단
      { x: 4, y: groundY + 88 }, { x: 22, y: groundY + 88 },
      { x: shelfX, y: groundY + 74 }, { x: shelfX + 18, y: groundY + 74 },
    ];

    // 우측 진열대 (나무 캐비닛 + 입체감)
    const shelfW = 42;
    const shelfH = 90;
    const shelfY = groundY + 4;
    // 뒤판
    ctx.fillStyle = '#5A4008';
    ctx.fillRect(shelfX - 2, shelfY, shelfW, shelfH);
    // 좌측 하이라이트 (깊이)
    ctx.fillStyle = '#A0724A';
    ctx.fillRect(shelfX - 2, shelfY, 2, shelfH);
    // 우측/하단 그림자
    ctx.fillStyle = '#3A2808';
    ctx.fillRect(shelfX + shelfW - 2, shelfY, 2, shelfH);
    ctx.fillRect(shelfX - 2, shelfY + shelfH - 2, shelfW, 2);
    // 선반판 (3단, 2px 두께 + 1px 하이라이트)
    for (let sy = 0; sy < 3; sy++) {
      const py = shelfY + 22 + sy * 22;
      ctx.fillStyle = '#8B6544';
      ctx.fillRect(shelfX - 2, py, shelfW, 2);
      ctx.fillStyle = '#A0724A';
      ctx.fillRect(shelfX - 1, py, shelfW - 2, 1);
    }
    // 다리
    ctx.fillStyle = '#6B4E0A';
    ctx.fillRect(shelfX - 1, shelfY + shelfH, 2, 3);
    ctx.fillRect(shelfX + shelfW - 3, shelfY + shelfH, 2, 3);
    // 차양 (상단 지붕)
    ctx.fillStyle = '#8B6544';
    ctx.fillRect(shelfX - 4, shelfY - 3, shelfW + 4, 3);
    ctx.fillStyle = '#A0724A';
    ctx.fillRect(shelfX - 3, shelfY - 3, shelfW + 2, 1);
    ctx.fillStyle = '#4A3508';
    ctx.fillRect(shelfX - 4, shelfY, shelfW + 4, 1); // 그림자


    // 레어리티 순으로 정렬 (legendary > epic > rare > common)
    const rarityOrder: Record<string, number> = { legendary: 0, epic: 1, rare: 2, common: 3 };
    const sorted = [...decorations].sort((a, b) => (rarityOrder[a.rarity] ?? 4) - (rarityOrder[b.rarity] ?? 4));

    // 좌측 돌 화단 테두리 (아이템 7개 이상일 때)
    if (sorted.length > 6) {
      ctx.fillStyle = '#8b929e';
      ctx.fillRect(1, groundY + 12, 42, 2);
      ctx.fillRect(1, groundY + 88, 42, 2);
      ctx.fillRect(1, groundY + 12, 2, 78);
      ctx.fillRect(41, groundY + 12, 2, 78);
      ctx.fillStyle = '#b0b8c4';
      ctx.fillRect(2, groundY + 13, 40, 1);
      ctx.fillRect(2, groundY + 13, 1, 76);
      ctx.fillStyle = '#6B5E3A';
      ctx.fillRect(3, groundY + 14, 38, 74);
    }

    // 아이템별 스프라이트 (10×10, 구체적 형태)
    const f = this.frame;
    const itemSprites: Record<string, { color: string; draw: (x: number, y: number) => void }> = {
      // Common (10×10)
      c01: { color: '#9ca3af', draw: (x, y) => { ctx.fillStyle='#9ca3af'; ctx.fillRect(x+2,y+4,6,4); ctx.fillRect(x+3,y+3,4,1); ctx.fillStyle='#d0d8e4'; ctx.fillRect(x+4,y+5,2,1); ctx.fillRect(x+3,y+4,1,1); } },
      c02: { color: '#8B6544', draw: (x, y) => { ctx.fillStyle='#8B6544'; ctx.fillRect(x+1,y+6,8,2); ctx.fillRect(x+6,y+4,2,2); ctx.fillRect(x+7,y+2,2,2); ctx.fillStyle='#5A9E32'; ctx.fillRect(x+7,y,3,2); ctx.fillRect(x+6,y+1,1,2); } },
      c03: { color: '#5A9E32', draw: (x, y) => { ctx.fillStyle='#5A9E32'; ctx.fillRect(x+2,y+3,2,7); ctx.fillRect(x+5,y+2,2,8); ctx.fillRect(x+8,y+4,2,6); ctx.fillStyle='#7BC74D'; ctx.fillRect(x+5,y+1,2,1); ctx.fillRect(x+2,y+2,2,1); } },
      c04: { color: '#FFB6C1', draw: (x, y) => { ctx.fillStyle='#FFB6C1'; ctx.fillRect(x+1,y+5,2,2); ctx.fillRect(x+3,y+6,2,2); ctx.fillRect(x+5,y+5,2,2); ctx.fillRect(x+7,y+6,2,2); ctx.fillStyle='#333'; ctx.fillRect(x+1,y+4,1,1); ctx.fillRect(x+2,y+3,1,1); } },
      c05: { color: '#5A9E32', draw: (x, y) => { ctx.fillStyle='#5A9E32'; ctx.fillRect(x+1,y+3,6,4); ctx.fillRect(x+7,y+1,2,3); ctx.fillStyle='#4A8828'; ctx.fillRect(x+2,y+2,2,1); ctx.fillStyle='#64B5F6'; ctx.fillRect(x+7,y+4,2,2); ctx.fillRect(x+6,y+6,1,1); } },
      c06: { color: '#A0724A', draw: (x, y) => { ctx.fillStyle='#A0724A'; ctx.fillRect(x,y+1,2,8); ctx.fillRect(x+4,y+1,2,8); ctx.fillRect(x+8,y+1,2,8); ctx.fillRect(x,y+3,10,2); ctx.fillRect(x,y+7,10,2); } },
      c07: { color: '#C4A97D', draw: (x, y) => { ctx.fillStyle='#C4A97D'; ctx.fillRect(x,y+2,10,6); ctx.fillStyle='#B8956E'; ctx.fillRect(x+3,y+2,1,6); ctx.fillRect(x+7,y+2,1,6); ctx.fillRect(x,y+5,10,1); } },
      c08: { color: '#6BBF3B', draw: (x, y) => { ctx.fillStyle='#6BBF3B'; ctx.fillRect(x+2,y+3,2,7); ctx.fillRect(x+4,y+1,2,9); ctx.fillRect(x+6,y+2,2,8); ctx.fillStyle='#8FD460'; ctx.fillRect(x+4,y,2,1); ctx.fillRect(x+1,y+5,1,2); ctx.fillRect(x+8,y+4,1,2); } },
      c09: { color: '#EF4444', draw: (x, y) => { ctx.fillStyle='#EF4444'; ctx.fillRect(x+2,y,6,4); ctx.fillStyle='#fff'; ctx.fillRect(x+4,y+1,2,1); ctx.fillRect(x+3,y+2,1,1); ctx.fillStyle='#F5E6D3'; ctx.fillRect(x+3,y+4,4,4); ctx.fillRect(x+4,y+8,2,2); } },
      c10: { color: '#FACC15', draw: (x, y) => { ctx.fillStyle='#FACC15'; ctx.fillRect(x+2,y+2,6,6); ctx.fillRect(x+4,y,2,2); ctx.fillStyle='#E8A040'; ctx.fillRect(x+1,y+4,2,3); ctx.fillStyle='#333'; ctx.fillRect(x+6,y+3,1,1); ctx.fillStyle='#FFE066'; ctx.fillRect(x+4,y+4,2,2); } },
      c11: { color: '#555', draw: (x, y) => { ctx.fillStyle='#444'; ctx.fillRect(x,y+7,10,2); ctx.fillRect(x+2,y+5,2,2); ctx.fillRect(x+5,y+3,2,4); ctx.fillRect(x+7,y+1,2,2); ctx.fillStyle='#EF4444'; ctx.fillRect(x+4,y+4,2,2); ctx.fillRect(x+3,y+1,2,2); } },
      c12: { color: '#FACC15', draw: (x, y) => { ctx.fillStyle='#FACC15'; ctx.fillRect(x,y,10,10); ctx.fillStyle='#D4A020'; ctx.fillRect(x,y,10,2); ctx.fillStyle='#8B6544'; ctx.fillRect(x+2,y+3,6,1); ctx.fillRect(x+2,y+5,4,1); ctx.fillRect(x+2,y+7,5,1); } },
      // Rare (10×10)
      r01: { color: '#E8A040', draw: (x, y) => { ctx.fillStyle='#E8A040'; ctx.fillRect(x+2,y+2,6,6); ctx.fillRect(x+2,y,2,2); ctx.fillRect(x+6,y,2,2); ctx.fillStyle='#333'; ctx.fillRect(x+3,y+4,2,1); ctx.fillRect(x+6,y+4,2,1); ctx.fillStyle='#FFB6C1'; ctx.fillRect(x+4,y+6,2,1); ctx.fillStyle='#E8A040'; ctx.fillRect(x+8,y+6,2,3); } },
      r02: { color: '#8B6544', draw: (x, y) => { ctx.fillStyle='#8B6544'; ctx.fillRect(x+2,y+2,6,6); ctx.fillRect(x,y+2,2,4); ctx.fillRect(x+8,y+2,2,4); ctx.fillStyle='#333'; ctx.fillRect(x+3,y+4,2,1); ctx.fillRect(x+6,y+4,2,1); ctx.fillStyle='#EF4444'; ctx.fillRect(x+4,y+7,2,2); } },
      r03: { color: '#FF6B81', draw: (x, y) => { const c=['#FF6B81','#FACC15','#a78bfa','#64B5F6']; for(let i=0;i<4;i++){ctx.fillStyle=c[i]; ctx.fillRect(x+(i%2)*5,y+Math.floor(i/2)*5,4,4);} ctx.fillStyle='#5A9E32'; ctx.fillRect(x+4,y+2,2,6); } },
      r04: { color: '#64B5F6', draw: (x, y) => { ctx.fillStyle='#64B5F6'; ctx.fillRect(x+1,y+3,8,5); ctx.fillStyle='#42A5F5'; ctx.fillRect(x+3,y+5,4,2); ctx.fillStyle='#90CAF9'; ctx.fillRect(x+2,y+3,2,1); ctx.fillStyle='#5A9E32'; ctx.fillRect(x,y+1,3,2); ctx.fillRect(x+8,y+4,2,2); } },
      r05: { color: '#A0724A', draw: (x, y) => { ctx.fillStyle='#A0724A'; ctx.fillRect(x,y+4,10,2); ctx.fillRect(x,y+6,2,4); ctx.fillRect(x+8,y+6,2,4); ctx.fillRect(x,y+2,2,2); ctx.fillRect(x+8,y+2,2,2); ctx.fillRect(x+2,y+3,6,1); } },
      r06: { color: '#EF4444', draw: (x, y) => { ctx.fillStyle='#EF4444'; ctx.fillRect(x+2,y,6,5); ctx.fillStyle='#C05050'; ctx.fillRect(x+2,y+4,6,1); ctx.fillStyle='#8B6544'; ctx.fillRect(x+4,y+5,2,5); ctx.fillStyle='#fff'; ctx.fillRect(x+4,y+2,2,1); } },
      r07: { color: '#FACC15', draw: (x, y) => { ctx.fillStyle='#888'; ctx.fillRect(x+4,y+3,2,7); ctx.fillStyle='#FACC15'; ctx.globalAlpha=0.6+Math.sin(f*0.08)*0.4; ctx.fillRect(x+2,y,6,3); ctx.globalAlpha=0.15; ctx.fillRect(x,y+3,10,4); ctx.globalAlpha=1; } },
      r08: { color: '#8B6544', draw: (x, y) => { ctx.fillStyle='#8B6544'; ctx.fillRect(x+4,y+4,2,6); ctx.fillRect(x+1,y+5,8,2); ctx.fillStyle='#F5E6D3'; ctx.fillRect(x+2,y,6,4); ctx.fillStyle='#333'; ctx.fillRect(x+3,y+2,1,1); ctx.fillRect(x+6,y+2,1,1); } },
      r09: { color: '#8B6544', draw: (x, y) => { ctx.fillStyle='#F5E6D3'; ctx.fillRect(x+1,y+3,7,5); ctx.fillStyle='#8B6544'; ctx.fillRect(x+8,y+4,2,2); ctx.fillRect(x+2,y+8,5,2); ctx.fillStyle='#fff'; ctx.globalAlpha=0.4+Math.sin(f*0.06)*0.3; ctx.fillRect(x+3,y+1,2,2); ctx.fillRect(x+5,y,2,1); ctx.globalAlpha=1; } },
      // Epic (10×10)
      e01: { color: '#a78bfa', draw: (x, y) => { ctx.fillStyle='#9ca3af'; ctx.fillRect(x+1,y+6,8,4); ctx.fillRect(x+3,y+4,4,2); ctx.fillStyle='#64B5F6'; ctx.globalAlpha=0.7+Math.sin(f*0.1)*0.3; ctx.fillRect(x+4,y+1,2,5); ctx.fillRect(x+3,y+3,1,1); ctx.fillRect(x+6,y+3,1,1); ctx.globalAlpha=1; } },
      e02: { color: '#a78bfa', draw: (x, y) => { ctx.fillStyle='#A0724A'; ctx.fillRect(x+4,y+4,2,6); ctx.fillRect(x+2,y+8,6,2); ctx.fillStyle='#F5E6D3'; const a=f*0.05; const r=3; for(let i=0;i<4;i++){const dx=Math.round(Math.cos(a+i*Math.PI/2)*r); const dy=Math.round(Math.sin(a+i*Math.PI/2)*r); ctx.fillRect(x+4+dx,y+3+dy,2,1);} } },
      e03: { color: '#5A9E32', draw: (x, y) => { ctx.fillStyle='#8B6544'; ctx.fillRect(x+4,y+6,2,4); ctx.fillStyle='#5A9E32'; ctx.fillRect(x+2,y+2,6,5); ctx.fillRect(x+1,y+3,1,2); ctx.fillRect(x+8,y+3,1,2); ctx.fillStyle='#EF4444'; ctx.fillRect(x+2,y+2,2,2); ctx.fillRect(x+6,y+3,2,2); } },
      e04: { color: '#fff', draw: (x, y) => { ctx.fillStyle='#fff'; ctx.fillRect(x+2,y+3,6,6); ctx.fillRect(x+2,y+1,2,2); ctx.fillRect(x+6,y+1,2,2); ctx.fillStyle='#FFB6C1'; ctx.fillRect(x+3,y+1,1,2); ctx.fillRect(x+7,y+1,1,2); ctx.fillStyle='#333'; ctx.fillRect(x+3,y+5,2,1); ctx.fillRect(x+6,y+5,2,1); ctx.fillStyle='#FFB6C1'; ctx.fillRect(x+4,y+7,2,1); } },
      e05: { color: '#FF6B81', draw: (x, y) => { const rc=['#EF4444','#E8A040','#FACC15','#5A9E32','#64B5F6','#a78bfa']; for(let i=0;i<6;i++){ctx.fillStyle=rc[i]; const ry=y+8-Math.round(Math.sqrt(Math.max(0,9-(i-2.5)*(i-2.5)))*2); ctx.fillRect(x+i+2,ry,1,y+9-ry);} } },
      e06: { color: '#60a5fa', draw: (x, y) => { ctx.fillStyle='#E8A040'; ctx.fillRect(x,y+4,10,6); ctx.fillStyle='#6B4E0A'; ctx.fillRect(x,y+8,10,2); ctx.fillRect(x+2,y+1,6,3); ctx.fillStyle='#fff'; ctx.fillRect(x+2,y+6,6,1); } },
      e07: { color: '#5A9E32', draw: (x, y) => { ctx.fillStyle='#8B6544'; ctx.fillRect(x+4,y+4,2,6); ctx.fillStyle='#5A9E32'; ctx.fillRect(x,y,4,4); ctx.fillRect(x+2,y+2,2,2); ctx.fillStyle='#EF4444'; ctx.fillRect(x+6,y,4,4); ctx.fillRect(x+6,y+2,2,2); } },
      // Legendary (10×10)
      l01: { color: '#fbbf24', draw: (x, y) => { ctx.fillStyle='#fbbf24'; ctx.fillRect(x+3,y,4,2); ctx.fillRect(x+1,y+2,8,4); ctx.fillRect(x+3,y+6,4,1); ctx.fillStyle='#92400e'; ctx.fillRect(x+4,y+3,2,2); ctx.fillStyle='#5A9E32'; ctx.fillRect(x+4,y+7,2,3); ctx.fillStyle='#fff'; ctx.globalAlpha=0.4+Math.sin(f*0.06)*0.4; ctx.fillRect(x+2,y+1,1,1); ctx.fillRect(x+7,y+1,1,1); ctx.globalAlpha=1; } },
      l02: { color: '#fff', draw: (x, y) => { ctx.fillStyle='#fff'; ctx.fillRect(x+2,y+2,6,7); ctx.fillRect(x+1,y+6,2,4); ctx.fillRect(x+7,y+6,2,4); ctx.fillStyle='#a78bfa'; ctx.fillRect(x+6,y,2,3); ctx.fillStyle='#FFB6C1'; ctx.fillRect(x+2,y+1,4,2); ctx.fillStyle='#333'; ctx.fillRect(x+3,y+4,2,1); } },
      l03: { color: '#a78bfa', draw: (x, y) => { ctx.fillStyle='#8B6544'; ctx.fillRect(x+4,y+6,2,4); const rc=['#EF4444','#FACC15','#5A9E32','#64B5F6','#a78bfa']; for(let i=0;i<5;i++){ctx.fillStyle=rc[(i+Math.floor(f*0.03))%5]; ctx.fillRect(x+i*2,y+2+Math.round(Math.abs(i-2)*0.5),2,3);} ctx.fillStyle=rc[(Math.floor(f*0.03)+2)%5]; ctx.fillRect(x+2,y,6,2); } },
      l04: { color: '#fbbf24', draw: (x, y) => { ctx.fillStyle='#fbbf24'; ctx.fillRect(x+3,y,3,4); ctx.fillRect(x+3,y+6,3,2); ctx.fillRect(x+2,y+8,3,2); ctx.fillStyle='#fff'; ctx.globalAlpha=0.3+Math.sin(f*0.09)*0.4; ctx.fillRect(x+6,y,1,1); ctx.fillRect(x+2,y+2,1,1); ctx.fillRect(x+6,y+7,1,1); ctx.globalAlpha=1; } },
    };

    const maxSlots = Math.min(sorted.length, slots.length);
    for (let i = 0; i < maxSlots; i++) {
      const item = sorted[i];
      const slot = slots[i];
      const sprite = itemSprites[item.itemId];
      if (!sprite) continue;

      ctx.save();

      // 선물 누적에 따른 효과 (10×10 크기에 맞춤)
      if (item.count >= 15) {
        ctx.fillStyle = '#fbbf24';
        ctx.globalAlpha = 0.4;
        ctx.fillRect(slot.x - 1, slot.y - 1, 12, 12);
        ctx.globalAlpha = 1;
      } else if (item.count >= 7) {
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.3 + Math.sin(this.frame * 0.08 + i) * 0.2;
        ctx.fillRect(slot.x - 1, slot.y - 2, 1, 1);
        ctx.fillRect(slot.x + 10, slot.y - 1, 1, 1);
        ctx.fillRect(slot.x + 5, slot.y + 11, 1, 1);
        ctx.globalAlpha = 1;
      } else if (item.count >= 3) {
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = sprite.color;
        ctx.fillRect(slot.x - 1, slot.y - 1, 12, 12);
        ctx.globalAlpha = 1;
      }

      sprite.draw(slot.x, slot.y);

      // 레전더리는 반짝임
      if (item.rarity === 'legendary') {
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.5 + Math.sin(this.frame * 0.1 + i * 2) * 0.5;
        ctx.fillRect(slot.x + (this.frame + i * 7) % 10, slot.y, 1, 1);
        ctx.fillRect(slot.x + 9 - (this.frame + i * 5) % 8, slot.y + 9, 1, 1);
        ctx.globalAlpha = 1;
      }

      ctx.restore();
    }

    // 총 받은 물에 따라 추가 꽃 밀도 (10+ = 추가 꽃 2개, 50+ = 추가 꽃 5개)
    if (totalWater >= 10) {
      const extraFlowers = totalWater >= 50 ? 5 : 2;
      const waterColors = ['#64B5F6', '#90CAF9', '#42A5F5', '#B3E5FC', '#81D4FA'];
      for (let i = 0; i < extraFlowers; i++) {
        const fx = (i * 37 + 13) % 48 + 2;
        const fy = groundY + (i * 23 + 17) % 90 + 15;
        ctx.fillStyle = '#5A9E32';
        ctx.fillRect(fx, fy + 1, 1, 2);
        ctx.fillStyle = waterColors[i % waterColors.length];
        ctx.fillRect(fx, fy, 1, 1);
        ctx.fillRect(fx - 1, fy, 1, 1);
        ctx.fillRect(fx + 1, fy, 1, 1);
      }
    }
  }

  // ── 모닥불 (연속 코딩) ──
  private drawBonfire(streakDays: number) {
    const ctx = this.ctx;
    const groundY = SKY_TILES * TILE;
    const farmRight = GRID_OFFSET_X + 4 * CELL_SIZE + 8;
    const bx = farmRight + 16;
    const by = groundY + 85;

    // 장작
    ctx.fillStyle = '#8B6544';
    ctx.fillRect(bx - 2, by + 3, 6, 2);
    ctx.fillRect(bx - 1, by + 2, 4, 1);

    if (streakDays >= 30) {
      // 파란 불꽃 (30일+)
      ctx.fillStyle = '#60a5fa';
      ctx.fillRect(bx, by - 3, 2, 5);
      ctx.fillRect(bx - 1, by - 1, 4, 3);
      ctx.fillStyle = '#93c5fd';
      ctx.fillRect(bx, by - 5, 2, 3);
      ctx.globalAlpha = 0.4 + Math.sin(this.frame * 0.12) * 0.3;
      ctx.fillStyle = '#bfdbfe';
      ctx.fillRect(bx - 1, by - 6, 4, 2);
      ctx.globalAlpha = 1;
      // 파란 파티클
      for (let i = 0; i < 3; i++) {
        const px = bx + Math.sin(this.frame * 0.05 + i * 2) * 4;
        const py = by - 7 - (this.frame * 0.3 + i * 5) % 10;
        ctx.fillStyle = '#93c5fd';
        ctx.globalAlpha = 0.6 - ((this.frame + i * 3) % 10) * 0.06;
        ctx.fillRect(px, py, 1, 1);
      }
      ctx.globalAlpha = 1;
    } else if (streakDays >= 14) {
      // 큰 불 (14일+)
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(bx, by - 2, 2, 4);
      ctx.fillRect(bx - 1, by, 4, 2);
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(bx, by - 4, 2, 3);
      ctx.globalAlpha = 0.5 + Math.sin(this.frame * 0.1) * 0.3;
      ctx.fillStyle = '#FDE68A';
      ctx.fillRect(bx - 1, by - 5, 4, 2);
      ctx.globalAlpha = 1;
    } else if (streakDays >= 7) {
      // 캠프파이어 (7일+) + 파티클
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(bx, by - 1, 2, 3);
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(bx, by - 3, 2, 2);
      // 불꽃 파티클
      const px = bx + Math.sin(this.frame * 0.08) * 2;
      const py = by - 4 - (this.frame % 8);
      ctx.fillStyle = '#FACC15';
      ctx.globalAlpha = 0.7 - (this.frame % 8) * 0.08;
      ctx.fillRect(px, py, 1, 1);
      ctx.globalAlpha = 1;
    } else if (streakDays >= 3) {
      // 작은 불 (3일+)
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(bx, by, 2, 2);
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(bx, by - 1, 1, 1);
    } else {
      // 불씨 (1일+)
      ctx.fillStyle = '#EF4444';
      ctx.globalAlpha = 0.5 + Math.sin(this.frame * 0.06) * 0.3;
      ctx.fillRect(bx, by + 1, 1, 1);
      ctx.fillRect(bx + 1, by, 1, 1);
      ctx.globalAlpha = 1;
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

        // 바람 잎 흔들림 (stage 2+)
        if (slot.stage >= 2) {
          const windPhase = Math.sin(this.frame * 0.04 + i * 1.7);
          if (windPhase > 0.6) {
            this.ctx.fillStyle = '#7BC74D';
            this.ctx.fillRect(x + 8 + 1, y + (slot.stage === 3 ? 3 : 6), 1, 1);
          }
        }

        // 수확 가능 스파클 (stage 3)
        if (slot.stage === 3 && (Math.sin(i * 3.1) + Math.sin(this.frame * 0.02) > 0.5)) {
          const sparklePhase = this.frame * 0.15 + i * 2.5;
          const sx = x + 8 + Math.round(Math.cos(sparklePhase) * 3);
          const sy = y + 6 + Math.round(Math.sin(sparklePhase) * 3);
          this.ctx.fillStyle = '#fff';
          this.ctx.fillRect(sx, sy, 1, 1);
        }

        // 수분 반짝 (낮 시간)
        if ((this.frame + i * 17) % 48 < 3) {
          this.ctx.fillStyle = 'rgba(255,255,255,0.5)';
          this.ctx.fillRect(x + 4 + (i % 3), y + 14, 1, 1);
        }
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

    // 눈 깜빡 (10초마다 2프레임)
    if (this.charMode === 'idle' && this.frame % 120 < 2) {
      const skinColor = this.currentState?.ownerCharacter?.type === 'human'
        ? '#FFD5B8' : '#8B6544';
      ctx.fillStyle = skinColor;
      if (this.charFacing === 'left') {
        ctx.fillRect(charX + TILE - 7, charY + 4, 1, 1);
        ctx.fillRect(charX + TILE - 9, charY + 4, 1, 1);
      } else {
        ctx.fillRect(charX + 6, charY + 4, 1, 1);
        ctx.fillRect(charX + 8, charY + 4, 1, 1);
      }
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
  private drawWeatherEffects(tod: TimeOfDay, weather: FarmWeather = 'clear') {
    const ctx = this.ctx;

    if (tod === 'morning') {
      // 골든아워 오버레이
      ctx.fillStyle = 'rgba(255,236,179,0.12)';
      ctx.fillRect(0, SKY_TILES * TILE, BASE_W, BASE_H - SKY_TILES * TILE);
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

      // 어두운 오버레이 (약화 — 아이템 가시성 유지)
      ctx.fillStyle = 'rgba(20,30,55,0.18)';
      ctx.fillRect(0, SKY_TILES * TILE, BASE_W, BASE_H - SKY_TILES * TILE);
    }

    if (tod === 'evening') {
      // 따뜻한 앰버 오버레이 (강화)
      ctx.fillStyle = 'rgba(255,111,0,0.15)';
      ctx.fillRect(0, 0, BASE_W, BASE_H);
    }

    // ── 마이크로 날씨 효과 (일일 결정론적) ──
    if (weather === 'rain') {
      // 빗방울 파티클 (12개, 대각선 낙하)
      ctx.fillStyle = 'rgba(100,181,246,0.6)';
      for (let i = 0; i < 12; i++) {
        const rx = (i * 23 + this.frame * 2) % BASE_W;
        const ry = ((i * 37 + this.frame * 3) % (BASE_H - SKY_TILES * TILE)) + SKY_TILES * TILE;
        ctx.fillRect(rx, ry, 1, 2);
      }
      // 웅덩이 (잔디 위 3개)
      ctx.fillStyle = 'rgba(100,181,246,0.2)';
      ctx.fillRect(15, SKY_TILES * TILE + 50, 6, 2);
      ctx.fillRect(210, SKY_TILES * TILE + 70, 5, 2);
      ctx.fillRect(30, SKY_TILES * TILE + 100, 7, 2);
    }

    if (weather === 'snow') {
      // 눈송이 (8개, 천천히 내림)
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 8; i++) {
        const sx = (i * 31 + Math.sin(this.frame * 0.02 + i) * 15) % BASE_W;
        const sy = ((i * 29 + this.frame) % (BASE_H - 10)) + 5;
        ctx.fillRect(Math.round(sx), Math.round(sy), 1, 1);
      }
      // 밝은 오버레이
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(0, 0, BASE_W, BASE_H);
    }

    if (weather === 'fog') {
      // 안개 오버레이 (반투명 흰색 띠)
      for (let i = 0; i < 3; i++) {
        const fy = SKY_TILES * TILE + 20 + i * 40;
        const alpha = 0.08 + Math.sin(this.frame * 0.01 + i * 2) * 0.04;
        ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
        ctx.fillRect(0, fy, BASE_W, 15);
      }
    }

    if (weather === 'aurora' && tod === 'night') {
      // 오로라 (하늘에 무지개빛 그라디언트 밴드)
      const skyH = SKY_TILES * TILE;
      const auroraColors = ['#4ade80', '#60a5fa', '#a78bfa', '#f472b6', '#fbbf24'];
      for (let i = 0; i < 5; i++) {
        const ay = 5 + i * 6 + Math.sin(this.frame * 0.015 + i) * 3;
        const alpha = 0.15 + Math.sin(this.frame * 0.02 + i * 1.5) * 0.1;
        ctx.fillStyle = auroraColors[i];
        ctx.globalAlpha = alpha;
        ctx.fillRect(0, Math.round(ay), BASE_W, 4);
      }
      ctx.globalAlpha = 1;
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
    // footprint은 API에서 character, avatar_url로 enrichment됨
    type EnrichedFP = Footprint & { character?: CharacterAppearance; avatar_url?: string };

    for (const fp of footprints as EnrichedFP[]) {
      const hoursAgo = (Date.now() - new Date(fp.visited_at).getTime()) / (1000 * 60 * 60);
      if (hoursAgo > 24) continue;

      const id = fp.github_id;
      activeIds.add(id);
      // visitorProfiles에서 또는 footprint에서 직접 character/avatar 가져오기
      const profileChar = this.currentState?.visitorProfiles?.get(id)?.character ?? fp.character;
      const profileAvatar = this.currentState?.visitorProfiles?.get(id)?.avatarUrl ?? fp.avatar_url;

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
          character: profileChar,
          avatarUrl: profileAvatar,
        });
      } else {
        // 기존 고스트: character/avatar 업데이트
        const ghost = this.ghosts.get(id)!;
        if (profileChar && !ghost.character) ghost.character = profileChar;
        if (profileAvatar && !ghost.avatarUrl) ghost.avatarUrl = profileAvatar;
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
        ctx.font = '5px monospace';
        const nameText = ghost.nickname.slice(0, 12);
        const tw = Math.min(ctx.measureText(nameText).width + 6, 60);
        ctx.fillRect(px - tw / 2 + 3, py - 10, tw, 8);
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText(nameText, px + 3, py - 4);
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
    const iconSize = 15; // 15×15 원형 아이콘
    const gap = 3;
    const maxVisible = 4; // 주인 제외 최대 방문자 수
    const sideX = 3;
    let y = 4;
    const radius = iconSize / 2;

    this.iconHitAreas = [];
    this.overflowHitArea = null;

    // ── 주인 아이콘 (항상 첫 번째) ──
    const meTracked = this.viewMode === 'first' && !this.trackedGhostId;
    const cx = sideX + radius;
    const cy = y + radius;
    // 원형 테두리
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = meTracked ? '#fbbf24' : 'rgba(255,255,255,0.3)';
    ctx.fill();
    // 원형 배경
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 1, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fill();
    // 원형 클리핑으로 아바타 그리기
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 1, 0, Math.PI * 2);
    ctx.clip();
    const ownerAvatar = this.getAvatar(this.currentState?.ownerAvatarUrl);
    if (ownerAvatar) {
      ctx.drawImage(ownerAvatar, sideX + 1, y + 1, iconSize - 2, iconSize - 2);
    } else {
      drawMiniCharacter(ctx, sideX + 4, y + 3, this.currentState?.ownerCharacter);
    }
    ctx.restore();
    this.iconHitAreas.push({ id: '__me__', x: sideX, y, w: iconSize, h: iconSize });
    y += iconSize + gap;

    // ── 방문자 아이콘 ──
    const ghosts = Array.from(this.ghosts.entries());
    const visibleCount = Math.min(ghosts.length, maxVisible);

    for (let i = 0; i < visibleCount; i++) {
      const [id, ghost] = ghosts[i];
      const isTracked = this.trackedGhostId === id;
      const gcx = sideX + radius;
      const gcy = y + radius;

      ctx.save();
      // 원형 테두리
      ctx.beginPath();
      ctx.arc(gcx, gcy, radius, 0, Math.PI * 2);
      ctx.fillStyle = isTracked ? '#fbbf24' : 'rgba(255,255,255,0.15)';
      ctx.fill();
      // 원형 배경
      ctx.beginPath();
      ctx.arc(gcx, gcy, radius - 1, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fill();
      // 원형 클리핑으로 아바타 그리기
      ctx.beginPath();
      ctx.arc(gcx, gcy, radius - 1, 0, Math.PI * 2);
      ctx.clip();
      const visitorAvatar = this.getAvatar(ghost.avatarUrl ?? this.currentState?.visitorProfiles?.get(id)?.avatarUrl);
      if (visitorAvatar) {
        ctx.drawImage(visitorAvatar, sideX + 1, y + 1, iconSize - 2, iconSize - 2);
      } else {
        drawMiniCharacter(ctx, sideX + 4, y + 3, ghost.character);
      }
      ctx.restore();
      // 물 줬으면 파란 점
      if (ghost.watered) {
        ctx.fillStyle = '#64B5F6';
        ctx.beginPath();
        ctx.arc(sideX + iconSize - 2, y + 2, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      this.iconHitAreas.push({ id, x: sideX, y, w: iconSize, h: iconSize });
      y += iconSize + gap;
    }

    // ── "+N" 오버플로 버튼 ──
    const remaining = ghosts.length - visibleCount;
    if (remaining > 0) {
      const btnW = iconSize;
      const btnH = 10;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(sideX, y, btnW, btnH);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(sideX, y, btnW, 1);
      ctx.fillStyle = '#9ca3af';
      ctx.font = '5px monospace';
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
    const panelW = 150;
    const panelH = farmId || statusLink ? 32 : 22;
    const panelX = (BASE_W - panelW) / 2;
    const panelY = BASE_H - panelH - 4;

    // 배경
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(panelX, panelY, panelW, panelH);
    // 픽셀 테두리
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(panelX, panelY, panelW, 1);
    ctx.fillRect(panelX, panelY + panelH - 1, panelW, 1);
    ctx.fillRect(panelX, panelY, 1, panelH);
    ctx.fillRect(panelX + panelW - 1, panelY, 1, panelH);

    // 1행: 닉네임 + Lv
    ctx.font = 'bold 6px monospace';
    ctx.fillStyle = '#FFFFFF';
    const displayName = nickname.length > 14 ? nickname.slice(0, 13) + '…' : nickname;
    ctx.fillText(displayName, panelX + 4, panelY + 9);
    ctx.font = '5px monospace';
    ctx.fillStyle = '#9ca3af';
    ctx.fillText(`Lv.${level}`, panelX + panelW - 28, panelY + 9);

    // 2행: 수확수
    ctx.fillStyle = '#e5e7eb';
    ctx.font = '5px monospace';
    ctx.fillText(`🌾${harvests}`, panelX + 4, panelY + 18);

    // 3행: 버튼 (방문자 추적 시만)
    if (farmId || statusLink) {
      let btnX = panelX + 4;
      const btnY = panelY + 22;
      const btnH = 8;

      if (farmId) {
        const btnW = 30;
        ctx.fillStyle = '#4DB6AC';
        ctx.fillRect(btnX, btnY, btnW, btnH);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 5px monospace';
        ctx.fillText('Farm', btnX + 4, btnY + 6);
        this.infoPanelButtons.push({
          type: 'farm', url: `/farm?visit=${farmId}`,
          x: btnX, y: btnY, w: btnW, h: btnH,
        });
        btnX += btnW + 4;
      }

      if (statusLink) {
        const btnW = 30;
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(btnX, btnY, btnW, btnH);
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 5px monospace';
        ctx.fillText('Link', btnX + 4, btnY + 6);
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
    ctx.font = '5px monospace';
    const textW = Math.min(ctx.measureText(displayText).width, 120);
    const padX = 5;
    const padY = 3;
    const bubbleW = Math.ceil(textW) + padX * 2;
    const bubbleH = 10 + padY;
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
    ctx.font = '5px monospace';
    ctx.fillText(displayText, bx + padX, by + padY + 5);
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

  // 고스트 추적 설정 (같은 유저 다시 클릭 시 해제 → 3인칭)
  trackUser(userId: string | null): 'first' | 'third' {
    if (userId === '__me__' || userId === null) {
      // 이미 내 캐릭터 추적 중이면 해제
      if (this.viewMode === 'first' && !this.trackedGhostId) {
        this.viewMode = 'third';
        this.trackedGhostId = null;
        this.targetCamera = { ...DEFAULT_CAMERA };
        return 'third';
      }
      this.trackedGhostId = null;
      this.viewMode = 'first';
    } else if (this.ghosts.has(userId)) {
      // 이미 이 고스트를 추적 중이면 해제
      if (this.trackedGhostId === userId) {
        this.trackedGhostId = null;
        this.viewMode = 'third';
        this.targetCamera = { ...DEFAULT_CAMERA };
        return 'third';
      }
      this.trackedGhostId = userId;
      this.viewMode = 'first';
    }
    return this.viewMode;
  }

  getTrackedGhostId(): string | null {
    return this.trackedGhostId;
  }

  // 하단 패널 데이터를 외부(HTML 오버레이)로 노출
  getInfoPanelData(): { nickname: string; level: number; harvests: number; farmId?: string; statusLink?: string; avatarUrl?: string } | null {
    if (this.viewMode !== 'first') return null;
    const state = this.currentState;
    if (!state) return null;

    if (!this.trackedGhostId) {
      const nickname = state.ownerNickname ?? '';
      if (!nickname) return null;
      return {
        nickname,
        level: state.ownerLevel ?? 1,
        harvests: state.ownerTotalHarvests ?? 0,
        statusLink: state.ownerStatusLink,
        avatarUrl: state.ownerAvatarUrl,
      };
    } else {
      const ghost = this.ghosts.get(this.trackedGhostId);
      const profile = state.visitorProfiles?.get(this.trackedGhostId);
      if (!ghost) return null;
      return {
        nickname: ghost.nickname,
        level: profile?.level ?? 0,
        harvests: profile?.totalHarvests ?? 0,
        farmId: this.trackedGhostId,
        statusLink: profile?.statusLink,
        avatarUrl: ghost.avatarUrl ?? profile?.avatarUrl,
      };
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
