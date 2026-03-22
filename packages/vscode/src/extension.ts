import * as vscode from 'vscode';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { LocalState, CropType, GrowthStage, InventoryItem } from '@claude-farmer/shared';
import { CROPS, MAX_GROWTH_STAGE, CROP_EMOJI, calculateLevel } from '@claude-farmer/shared';
import { rollGacha, TOTAL_ITEMS } from '@claude-farmer/shared';
import { type Locale, detectLocale, getDict } from '@claude-farmer/shared';

// ── State management ──
const DATA_DIR = '.claude-farmer';
const STATE_FILE = 'state.json';
const dataPath = join(homedir(), DATA_DIR);
const statePath = join(dataPath, STATE_FILE);

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

async function loadState(): Promise<LocalState | null> {
  try {
    if (!existsSync(statePath)) return null;
    const raw = await readFile(statePath, 'utf-8');
    return JSON.parse(raw) as LocalState;
  } catch {
    return null;
  }
}

async function saveState(state: LocalState): Promise<void> {
  if (!existsSync(dataPath)) {
    await mkdir(dataPath, { recursive: true });
  }
  await writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8');
}

function createDefaultState(githubId: string, nickname: string, avatarUrl: string): LocalState {
  return {
    version: 1,
    user: {
      github_id: githubId,
      nickname,
      avatar_url: avatarUrl,
      created_at: new Date().toISOString(),
    },
    farm: {
      level: 1,
      grid: new Array(16).fill(null),
      total_harvests: 0,
    },
    inventory: [],
    status_message: null,
    bookmarks: [],
    activity: {
      today_input_chars: 0,
      today_harvests: 0,
      today_water_received: 0,
      today_water_given: 0,
      streak_days: 1,
      last_active_date: todayStr(),
    },
    last_synced: new Date().toISOString(),
  };
}

function resetDailyIfNeeded(state: LocalState): void {
  const today = todayStr();
  if (state.activity.last_active_date !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    state.activity.streak_days =
      state.activity.last_active_date === yesterdayStr
        ? state.activity.streak_days + 1
        : 1;
    state.activity.today_input_chars = 0;
    state.activity.today_harvests = 0;
    state.activity.today_water_received = 0;
    state.activity.today_water_given = 0;
    state.activity.last_active_date = today;
  }
}

// ── Game loop logic ──
function randomCrop(): CropType {
  return CROPS[Math.floor(Math.random() * CROPS.length)];
}

function plantCrop(state: LocalState): { slotIndex: number; crop: CropType } | null {
  let slotIndex = state.farm.grid.findIndex(s => s === null);
  if (slotIndex === -1) {
    let oldest = -1;
    let oldestTime = Infinity;
    for (let i = 0; i < state.farm.grid.length; i++) {
      const slot = state.farm.grid[i];
      if (slot) {
        const t = new Date(slot.planted_at).getTime();
        if (t < oldestTime) { oldestTime = t; oldest = i; }
      }
    }
    if (oldest === -1) return null;
    harvestSlot(state, oldest);
    slotIndex = oldest;
  }
  const crop = randomCrop();
  state.farm.grid[slotIndex] = {
    slot: slotIndex, crop, stage: 0 as GrowthStage,
    planted_at: new Date().toISOString(),
  };
  return { slotIndex, crop };
}

function growCrops(state: LocalState): number {
  let grown = 0;
  for (const slot of state.farm.grid) {
    if (slot && slot.stage < MAX_GROWTH_STAGE) {
      slot.stage = (slot.stage + 1) as GrowthStage;
      grown++;
    }
  }
  return grown;
}

function harvestSlot(state: LocalState, idx: number): InventoryItem | null {
  const slot = state.farm.grid[idx];
  if (!slot) return null;
  const item = rollGacha();
  const reward: InventoryItem = {
    id: item.id, name: item.name, rarity: item.rarity,
    obtained_at: new Date().toISOString(),
  };
  state.inventory.push(reward);
  state.farm.total_harvests++;
  state.activity.today_harvests++;
  state.farm.level = calculateLevel(state.farm.total_harvests);
  state.farm.grid[idx] = null;
  return reward;
}

function autoHarvest(state: LocalState): InventoryItem[] {
  const rewards: InventoryItem[] = [];
  for (let i = 0; i < state.farm.grid.length; i++) {
    const slot = state.farm.grid[i];
    if (slot && slot.stage >= MAX_GROWTH_STAGE) {
      const reward = harvestSlot(state, i);
      if (reward) rewards.push(reward);
    }
  }
  return rewards;
}

// ── Locale helper ──
function getExtensionLocale(): Locale {
  const setting = vscode.workspace.getConfiguration('claudeFarmer').get<string>('language', 'auto');
  if (setting === 'en' || setting === 'ko') return setting;
  return detectLocale(vscode.env.language);
}

// ── Extension ──
let activityCounter = 0;
let lastActivityTime = 0;

export function activate(context: vscode.ExtensionContext) {
  const provider = new FarmViewProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('claudeFarmer.farmView', provider)
  );

  // URI handler for OAuth callback: vscode://doribear.claude-farmer-vscode/callback?...
  context.subscriptions.push(
    vscode.window.registerUriHandler({
      async handleUri(uri: vscode.Uri) {
        if (uri.path === '/callback') {
          const params = new URLSearchParams(uri.query);
          const githubId = params.get('github_id');
          const nickname = params.get('nickname');
          const avatarUrl = params.get('avatar_url');

          if (githubId && nickname) {
            const state = createDefaultState(githubId, nickname, avatarUrl || '');
            await saveState(state);
            provider.onLoginComplete(state);
            const locale = getExtensionLocale();
            const d = getDict(locale);
            vscode.window.showInformationMessage(`🌱 Claude Farmer: ${nickname}, ${d.vscodeWelcome}!`);
          }
        }
      },
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('claudeFarmer.openFarm', () => {
      vscode.commands.executeCommand('claudeFarmer.farmView.focus');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('claudeFarmer.openWeb', () => {
      vscode.env.openExternal(vscode.Uri.parse('https://claudefarmer.com'));
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('claudeFarmer.login', () => {
      vscode.env.openExternal(
        vscode.Uri.parse('https://claudefarmer.com/api/auth/login?from=vscode')
      );
    })
  );

  // Re-render webview when language setting changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('claudeFarmer.language')) {
        provider.onLocaleChange();
      }
    })
  );

  // Auto-open sidebar on first install
  const hasShownKey = 'claudeFarmer.hasShownSidebar';
  if (!context.globalState.get(hasShownKey)) {
    context.globalState.update(hasShownKey, true);
    setTimeout(() => {
      vscode.commands.executeCommand('claudeFarmer.farmView.focus');
    }, 1500);
  }

  // Editor activity detection
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      const now = Date.now();
      if (now - lastActivityTime < 3000) return;
      lastActivityTime = now;
      const charCount = e.contentChanges.reduce((sum, c) => sum + c.text.length, 0);
      activityCounter += charCount;
      if (activityCounter > 200) {
        activityCounter = 0;
        provider.onCodingActivity();
      }
    })
  );

  // Terminal activity
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTerminal(() => {
      provider.onCodingActivity();
    })
  );
}

export function deactivate() {}

class FarmViewProvider implements vscode.WebviewViewProvider {
  private webviewView?: vscode.WebviewView;
  private state: LocalState | null = null;

  constructor(private readonly extensionUri: vscode.Uri) {}

  async resolveWebviewView(webviewView: vscode.WebviewView) {
    this.webviewView = webviewView;
    webviewView.webview.options = { enableScripts: true };

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type === 'openWeb') {
        vscode.env.openExternal(vscode.Uri.parse('https://claudefarmer.com'));
      } else if (msg.type === 'openFarm') {
        vscode.env.openExternal(vscode.Uri.parse('https://claudefarmer.com/farm'));
      } else if (msg.type === 'login') {
        vscode.env.openExternal(
          vscode.Uri.parse('https://claudefarmer.com/api/auth/login?from=vscode')
        );
      } else if (msg.type === 'ready') {
        await this.loadAndSend();
      }
    });

    webviewView.webview.html = this.getHtml();
  }

  onLoginComplete(state: LocalState) {
    this.state = state;
    this.sendState();
  }

  onLocaleChange() {
    if (this.webviewView) {
      this.webviewView.webview.html = this.getHtml();
    }
  }

  private async loadAndSend() {
    this.state = await loadState();
    if (this.state) {
      resetDailyIfNeeded(this.state);
    }
    this.sendState();
  }

  private sendState() {
    if (!this.webviewView) return;
    if (this.state) {
      const uniqueItems = new Set(this.state.inventory.map(i => i.id)).size;
      this.webviewView.webview.postMessage({
        type: 'state',
        data: {
          initialized: true,
          nickname: this.state.user.nickname,
          level: this.state.farm.level,
          grid: this.state.farm.grid,
          totalHarvests: this.state.farm.total_harvests,
          uniqueItems,
          totalItems: TOTAL_ITEMS,
          waterReceived: this.state.activity.today_water_received,
          streakDays: this.state.activity.streak_days,
          statusMessage: this.state.status_message?.text || null,
        },
      });
    } else {
      this.webviewView.webview.postMessage({
        type: 'state',
        data: { initialized: false },
      });
    }
  }

  async onCodingActivity() {
    if (!this.state) {
      this.state = await loadState();
      if (!this.state) {
        if (this.webviewView) {
          this.webviewView.webview.postMessage({ type: 'activity-demo' });
        }
        return;
      }
    }

    resetDailyIfNeeded(this.state);
    const planted = plantCrop(this.state);
    growCrops(this.state);
    const harvested = autoHarvest(this.state);
    await saveState(this.state);
    this.sendState();

    if (this.webviewView) {
      const locale = getExtensionLocale();
      const d = getDict(locale);
      const notifications: string[] = [];
      if (planted) {
        const emoji = CROP_EMOJI[planted.crop][0];
        notifications.push(`${emoji} ${d.vscodeNewSeed}`);
      }
      for (const reward of harvested) {
        const rarityEmoji = reward.rarity === 'legendary' ? '🌟' : reward.rarity === 'epic' ? '💎' : reward.rarity === 'rare' ? '💙' : '📦';
        notifications.push(`🌾 ${d.vscodeHarvestDone} ${rarityEmoji} ${reward.name} ${d.vscodeGot}!`);
      }
      if (notifications.length > 0) {
        this.webviewView.webview.postMessage({
          type: 'notifications',
          messages: notifications,
        });
      }
    }
  }

  private getHtml(): string {
    const locale = getExtensionLocale();
    const d = getDict(locale);
    const daysLabel = locale === 'ko' ? '일' : 'd';

    return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: var(--vscode-sideBar-background, #1a1d27);
      color: var(--vscode-sideBar-foreground, #e5e7eb);
      font-family: var(--vscode-font-family, -apple-system, system-ui, sans-serif);
      font-size: 12px;
      padding: 8px;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
      font-size: 11px;
      opacity: 0.7;
    }
    canvas {
      width: 100%;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
      border-radius: 6px;
      border: 1px solid var(--vscode-panel-border, #2a2d3a);
    }
    .stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
      margin-top: 8px;
    }
    .stat {
      background: var(--vscode-input-background, #232736);
      border: 1px solid var(--vscode-panel-border, #2a2d3a);
      border-radius: 4px;
      padding: 6px;
      text-align: center;
    }
    .stat-label { opacity: 0.5; font-size: 10px; }
    .stat-value { font-weight: bold; font-size: 14px; }
    .status-msg {
      margin-top: 6px;
      padding: 6px 8px;
      background: var(--vscode-input-background, #232736);
      border: 1px solid var(--vscode-panel-border, #2a2d3a);
      border-radius: 4px;
      font-size: 11px;
      opacity: 0.8;
    }
    .notification {
      background: var(--vscode-input-background, #232736);
      border: 1px solid #4ade80;
      border-radius: 4px;
      padding: 6px 8px;
      margin-top: 6px;
      font-size: 11px;
      opacity: 0;
      transition: opacity 0.3s;
    }
    .notification.show { opacity: 1; }
    .actions {
      margin-top: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .btn {
      background: var(--vscode-input-background, #232736);
      border: 1px solid var(--vscode-panel-border, #2a2d3a);
      color: var(--vscode-sideBar-foreground, #e5e7eb);
      padding: 8px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
      text-align: center;
    }
    .btn:hover { border-color: #fbbf24; }
    .btn-primary {
      background: #fbbf24;
      color: #000;
      border-color: #fbbf24;
      font-weight: bold;
    }
    .btn-primary:hover { background: #f59e0b; }

    /* ── Onboarding ── */
    .onboarding { padding: 4px 0; }
    .onboarding h2 { font-size: 16px; text-align: center; margin-bottom: 12px; }
    .onboarding-desc {
      font-size: 12px; line-height: 1.7; opacity: 0.85;
      margin-bottom: 14px; text-align: center;
    }
    .steps { margin: 12px 0; }
    .step { display: flex; gap: 10px; margin-bottom: 10px; align-items: flex-start; }
    .step-num {
      background: #fbbf24; color: #000; font-weight: bold;
      width: 20px; height: 20px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; flex-shrink: 0;
    }
    .step-text { font-size: 11.5px; line-height: 1.5; opacity: 0.9; padding-top: 1px; }
    .step-text strong { color: #fbbf24; }
    .divider { border: none; border-top: 1px solid var(--vscode-panel-border, #2a2d3a); margin: 14px 0; }
    .how-it-works { margin: 10px 0; }
    .how-item { display: flex; gap: 8px; margin-bottom: 6px; font-size: 11px; opacity: 0.8; line-height: 1.4; }
    .how-emoji { font-size: 14px; flex-shrink: 0; }
    .login-section { margin-top: 14px; text-align: center; }
    .login-note { font-size: 10px; opacity: 0.5; margin-top: 6px; line-height: 1.4; }
    .lang-hint { font-size: 10px; opacity: 0.4; margin-top: 10px; text-align: center; }
  </style>
</head>
<body>
  <!-- ── Farm View (logged in) ── -->
  <div id="app" style="display:none">
    <div class="header">
      <span id="nickname"></span>
      <span id="level"></span>
    </div>
    <canvas id="farm" width="256" height="192"></canvas>

    <div class="stats">
      <div class="stat">
        <div class="stat-label">🌾 ${d.vscodeHarvest}</div>
        <div class="stat-value" id="harvests">0</div>
      </div>
      <div class="stat">
        <div class="stat-label">📦 ${d.vscodeCollection}</div>
        <div class="stat-value" id="collection">0/24</div>
      </div>
      <div class="stat">
        <div class="stat-label">💧 ${d.vscodeWater}</div>
        <div class="stat-value" id="water">0</div>
      </div>
      <div class="stat">
        <div class="stat-label">🔥 ${d.vscodeStreak}</div>
        <div class="stat-value" id="streak">0${daysLabel}</div>
      </div>
    </div>

    <div id="statusMsg" class="status-msg" style="display:none"></div>
    <div class="notification" id="notif"></div>

    <div class="actions">
      <button class="btn btn-primary" onclick="openFarm()">🌍 ${d.vscodeOpenFull}</button>
    </div>
    <p class="lang-hint">${d.vscodeLangSetting}</p>
  </div>

  <!-- ── Onboarding (not logged in) ── -->
  <div id="onboardingView" class="onboarding" style="display:none">
    <canvas id="farmDemo" width="256" height="192" style="width:100%;image-rendering:pixelated;image-rendering:crisp-edges;border-radius:6px;border:1px solid var(--vscode-panel-border,#2a2d3a);"></canvas>

    <h2>🌱 ${d.vscodeOnboardTitle}</h2>
    <p class="onboarding-desc">${d.vscodeOnboardDesc.replace(/\n/g, '<br>')}</p>

    <hr class="divider">

    <div class="how-it-works">
      <div class="how-item"><span class="how-emoji">🌰</span><span>${d.vscodeHowSeed}</span></div>
      <div class="how-item"><span class="how-emoji">🌱</span><span>${d.vscodeHowGrow}</span></div>
      <div class="how-item"><span class="how-emoji">🥕</span><span>${d.vscodeHowHarvest}</span></div>
      <div class="how-item"><span class="how-emoji">📦</span><span>${d.vscodeHowCollect}</span></div>
      <div class="how-item"><span class="how-emoji">💧</span><span>${d.vscodeHowWater}</span></div>
    </div>

    <hr class="divider">

    <p style="font-size:12px;font-weight:bold;margin-bottom:10px;">${d.vscodeGetStarted}</p>
    <div class="steps">
      <div class="step">
        <div class="step-num">1</div>
        <div class="step-text">${d.vscodeStep1.replace(/\n/g, '<br>')}</div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-text">${d.vscodeStep2.replace(/\n/g, '<br>')}</div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-text">${d.vscodeStep3.replace(/\n/g, '<br>')} 🌿</div>
      </div>
    </div>

    <div class="login-section">
      <button class="btn btn-primary" onclick="login()" style="width:100%;padding:10px;font-size:13px;">
        🔑 ${d.vscodeLoginBtn}
      </button>
      <p class="login-note">${d.vscodeLoginNote.replace(/\n/g, '<br>')}</p>
    </div>

    <hr class="divider">

    <div class="actions">
      <button class="btn" onclick="openWeb()">🌐 ${d.vscodeVisitWeb}</button>
    </div>

    <p class="lang-hint">${d.vscodeLangSetting}</p>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const canvas = document.getElementById('farm');
    const ctx = canvas.getContext('2d');
    const daysLabel = '${daysLabel}';
    let frame = 0;
    let farmState = null;
    let notifTimer = null;
    let initialized = false;

    const demoCanvas = document.getElementById('farmDemo');
    const demoCtx = demoCanvas ? demoCanvas.getContext('2d') : null;
    let demoCrops = [
      { stage: 3, crop: 'carrot' }, { stage: 2, crop: 'tomato' },
      { stage: 1, crop: 'sunflower' }, { stage: 0, crop: 'strawberry' },
      { stage: 3, crop: 'pumpkin' }, { stage: 1, crop: 'radish' },
    ];

    const cropColors = {
      carrot: '#FF8C00', tomato: '#EF4444', sunflower: '#FACC15',
      strawberry: '#FF6B81', pumpkin: '#F97316', radish: '#FBB6CE'
    };

    function renderFarm(c, cx, grid) {
      frame++;
      cx.clearRect(0, 0, 256, 192);

      const hour = new Date().getHours();
      let skyTop, skyBot;
      if (hour >= 6 && hour < 11) { skyTop = '#FFF3E0'; skyBot = '#FFCCBC'; }
      else if (hour >= 11 && hour < 17) { skyTop = '#B3E5FC'; skyBot = '#E1F5FE'; }
      else if (hour >= 17 && hour < 21) { skyTop = '#F48FB1'; skyBot = '#FFE082'; }
      else { skyTop = '#0D1B2A'; skyBot = '#1B2838'; }

      const grad = cx.createLinearGradient(0, 0, 0, 48);
      grad.addColorStop(0, skyTop);
      grad.addColorStop(1, skyBot);
      cx.fillStyle = grad;
      cx.fillRect(0, 0, 256, 48);

      if (hour >= 21 || hour < 6) {
        cx.fillStyle = '#FFFFFF';
        for (let i = 0; i < 15; i++) {
          if (frame % 60 < 40 || i % 3 !== 0)
            cx.fillRect((i * 17 + 5) % 256, (i * 11 + 3) % 45, 1, 1);
        }
      }

      cx.fillStyle = '#7BC74D';
      cx.fillRect(0, 48, 256, 144);
      cx.fillStyle = '#5A9E32';
      for (let x = 0; x < 256; x += 7) {
        for (let y = 48; y < 192; y += 5) {
          cx.fillRect(x + (y * 3 % 5), y, 1, 1);
        }
      }

      cx.fillStyle = '#8B6914';
      cx.fillRect(62, 54, 132, 100);
      cx.fillStyle = '#6B4E0A';
      for (let x = 62; x < 194; x += 4) {
        for (let y = 54; y < 154; y += 4) {
          cx.fillRect(x + (y * 2 % 3), y + (x % 2), 1, 1);
        }
      }

      cx.fillStyle = '#6B4E0A';
      for (let i = 0; i <= 4; i++) {
        cx.fillRect(64 + i * 32 - 1, 54, 1, 100);
        cx.fillRect(62, 56 + i * 24 - 1, 132, 1);
      }

      if (grid) {
        for (let i = 0; i < grid.length && i < 16; i++) {
          const slot = grid[i];
          if (!slot) continue;
          const row = Math.floor(i / 4);
          const col = i % 4;
          const bx = 72 + col * 32;
          const by = 60 + row * 24;
          const stage = slot.stage;
          const color = cropColors[slot.crop] || '#7BC74D';

          cx.fillStyle = '#7BC74D';
          const h = 2 + stage * 3;
          cx.fillRect(bx + 7, by + 16 - h, 2, h);

          if (stage >= 1) {
            cx.fillStyle = '#5A9E32';
            cx.fillRect(bx + 5, by + 16 - h, 3, 2);
            cx.fillRect(bx + 8, by + 16 - h + 1, 3, 2);
          }
          if (stage >= 2) {
            cx.fillStyle = color;
            cx.fillRect(bx + 5, by + 16 - h - 1, 2, 2);
          }
          if (stage >= 3) {
            cx.fillStyle = color;
            cx.fillRect(bx + 4, by + 16 - h - 2, 5, 4);
            if (frame % 30 < 15) {
              cx.fillStyle = '#FFFFFF';
              cx.fillRect(bx + 3, by + 16 - h - 3, 1, 1);
              cx.fillRect(bx + 9, by + 16 - h - 1, 1, 1);
            }
          }
        }
      }

      const bounce = frame % 40 < 20 ? 0 : -1;
      const charX = 210;
      const charY = 80 + bounce;
      cx.fillStyle = '#5C3A1E';
      cx.fillRect(charX, charY, 6, 3);
      cx.fillStyle = '#FFD5B8';
      cx.fillRect(charX + 1, charY + 3, 4, 3);
      cx.fillStyle = '#3E2723';
      cx.fillRect(charX + 1, charY + 4, 1, 1);
      cx.fillRect(charX + 4, charY + 4, 1, 1);
      cx.fillStyle = '#6C9BD2';
      cx.fillRect(charX, charY + 6, 6, 4);
      cx.fillStyle = '#5B7A9E';
      cx.fillRect(charX + 1, charY + 10, 2, 2);
      cx.fillRect(charX + 3, charY + 10, 2, 2);
    }

    function updateUI(data) {
      if (!data || !data.initialized) {
        document.getElementById('app').style.display = 'none';
        document.getElementById('onboardingView').style.display = 'block';
        initialized = false;
        return;
      }

      initialized = true;
      document.getElementById('app').style.display = 'block';
      document.getElementById('onboardingView').style.display = 'none';

      document.getElementById('nickname').textContent = '🌱 @' + data.nickname;
      document.getElementById('level').textContent = 'Lv.' + data.level;
      document.getElementById('harvests').textContent = data.totalHarvests;
      document.getElementById('collection').textContent = data.uniqueItems + '/' + data.totalItems;
      document.getElementById('water').textContent = data.waterReceived;
      document.getElementById('streak').textContent = data.streakDays + daysLabel;

      farmState = data.grid;

      if (data.statusMessage) {
        const el = document.getElementById('statusMsg');
        el.textContent = '💬 "' + data.statusMessage + '"';
        el.style.display = 'block';
      } else {
        document.getElementById('statusMsg').style.display = 'none';
      }
    }

    function showNotification(msg) {
      const el = document.getElementById('notif');
      el.textContent = msg;
      el.classList.add('show');
      if (notifTimer) clearTimeout(notifTimer);
      notifTimer = setTimeout(() => el.classList.remove('show'), 3000);
    }

    function openWeb() { vscode.postMessage({ type: 'openWeb' }); }
    function openFarm() { vscode.postMessage({ type: 'openFarm' }); }
    function login() { vscode.postMessage({ type: 'login' }); }

    window.addEventListener('message', (e) => {
      const msg = e.data;
      if (msg.type === 'state') {
        updateUI(msg.data);
      } else if (msg.type === 'notifications') {
        let delay = 0;
        for (const n of msg.messages) {
          setTimeout(() => showNotification(n), delay);
          delay += 2000;
        }
      } else if (msg.type === 'activity-demo') {
        for (const c of demoCrops) {
          if (c.stage < 3) { c.stage++; break; }
        }
        if (demoCrops.length < 8 && Math.random() < 0.4) {
          const types = ['carrot','tomato','sunflower','strawberry','pumpkin','radish'];
          demoCrops.push({ stage: 0, crop: types[Math.floor(Math.random() * types.length)] });
        }
      }
    });

    setInterval(() => {
      if (initialized && farmState) {
        renderFarm(canvas, ctx, farmState);
      } else if (!initialized && demoCtx) {
        renderFarm(demoCanvas, demoCtx, demoCrops);
      }
    }, 80);

    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
  }
}
