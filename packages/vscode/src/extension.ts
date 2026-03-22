import * as vscode from 'vscode';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { LocalState, CropType, GrowthStage, InventoryItem } from '@claude-farmer/shared';
import { CROPS, MAX_GROWTH_STAGE, CROP_EMOJI, GRID_SIZE, calculateLevel } from '@claude-farmer/shared';
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
      grid: new Array(GRID_SIZE).fill(null),
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

  // URI handler for OAuth callback
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
            const d = getDict(getExtensionLocale());
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
      vscode.env.openExternal(vscode.Uri.parse('https://claudefarmer.com/api/auth/login?from=vscode'));
    })
  );

  // Re-render on language change
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
    setTimeout(() => vscode.commands.executeCommand('claudeFarmer.farmView.focus'), 1500);
  }

  // [6] Lowered threshold: 50 chars instead of 200, 2s debounce
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      const now = Date.now();
      if (now - lastActivityTime < 2000) return;
      lastActivityTime = now;
      const charCount = e.contentChanges.reduce((sum, c) => sum + c.text.length, 0);
      activityCounter += charCount;
      if (activityCounter > 50) {
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

  // File save = activity
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(() => {
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
        // [1] Open user's own farm page
        const id = this.state?.user?.github_id || '';
        const url = id
          ? `https://claudefarmer.com/farm?user=${encodeURIComponent(id)}`
          : 'https://claudefarmer.com/farm';
        vscode.env.openExternal(vscode.Uri.parse(url));
      } else if (msg.type === 'login') {
        vscode.env.openExternal(vscode.Uri.parse('https://claudefarmer.com/api/auth/login?from=vscode'));
      } else if (msg.type === 'ready') {
        await this.loadAndSend();
      } else if (msg.type === 'setStatus') {
        // [3] Status bubble editing
        if (this.state) {
          this.state.status_message = {
            text: msg.text,
            updated_at: new Date().toISOString(),
          };
          await saveState(this.state);
          this.sendState();
        }
      } else if (msg.type === 'setLang') {
        // [2] Language toggle
        await vscode.workspace.getConfiguration('claudeFarmer').update('language', msg.lang, true);
      } else if (msg.type === 'checkUpdate') {
        // [2] Update check
        vscode.env.openExternal(vscode.Uri.parse('https://marketplace.visualstudio.com/items?itemName=doribear.claude-farmer-vscode'));
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
    if (this.state) resetDailyIfNeeded(this.state);
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
          githubId: this.state.user.github_id,
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
      this.webviewView.webview.postMessage({ type: 'state', data: { initialized: false } });
    }
  }

  async onCodingActivity() {
    if (!this.state) {
      this.state = await loadState();
      if (!this.state) {
        if (this.webviewView) this.webviewView.webview.postMessage({ type: 'activity-demo' });
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
      const d = getDict(getExtensionLocale());
      const notifications: string[] = [];
      if (planted) {
        const emoji = CROP_EMOJI[planted.crop][0];
        notifications.push(`${emoji} ${d.vscodeNewSeed}`);
      }
      for (const reward of harvested) {
        const rarityEmoji = reward.rarity === 'legendary' ? '🌟' : reward.rarity === 'epic' ? '💎' : reward.rarity === 'rare' ? '💙' : '📦';
        notifications.push(`🌾 ${d.vscodeHarvestDone} ${rarityEmoji} ${reward.name} ${d.vscodeGot}!`);
      }
      // [6] Always send activity event for visual feedback
      this.webviewView.webview.postMessage({
        type: 'activity',
        notifications,
        planted: planted ? { crop: planted.crop, slot: planted.slotIndex } : null,
        harvested: harvested.length,
      });
    }
  }

  private getHtml(): string {
    const locale = getExtensionLocale();
    const d = getDict(locale);
    const dl = locale === 'ko' ? '일' : 'd';

    return `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body {
  background: var(--vscode-sideBar-background,#1a1d27);
  color: var(--vscode-sideBar-foreground,#e5e7eb);
  font-family: var(--vscode-font-family,-apple-system,system-ui,sans-serif);
  font-size: 12px; padding: 8px;
}
.header { display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; font-size:11px; opacity:.7; }
canvas { width:100%; image-rendering:pixelated; image-rendering:crisp-edges; border-radius:6px; border:1px solid var(--vscode-panel-border,#2a2d3a); }
.stats { display:grid; grid-template-columns:1fr 1fr; gap:4px; margin-top:8px; }
.stat { background:var(--vscode-input-background,#232736); border:1px solid var(--vscode-panel-border,#2a2d3a); border-radius:4px; padding:6px; text-align:center; }
.stat-label { opacity:.5; font-size:10px; }
.stat-value { font-weight:bold; font-size:14px; }
.status-section { margin-top:6px; }
.status-display { padding:6px 8px; background:var(--vscode-input-background,#232736); border:1px solid var(--vscode-panel-border,#2a2d3a); border-radius:4px; font-size:11px; cursor:pointer; opacity:.8; }
.status-display:hover { border-color:#fbbf24; }
.status-edit { display:flex; gap:4px; margin-top:4px; }
.status-edit input { flex:1; background:var(--vscode-input-background,#232736); border:1px solid var(--vscode-panel-border,#2a2d3a); border-radius:4px; padding:5px 8px; color:var(--vscode-input-foreground,#e5e7eb); font-size:11px; outline:none; }
.status-edit input:focus { border-color:#fbbf24; }
.status-edit button { background:#fbbf24; color:#000; border:none; border-radius:4px; padding:5px 10px; cursor:pointer; font-size:11px; font-weight:bold; }
.notif-area { margin-top:6px; min-height:24px; }
.notif-item { background:var(--vscode-input-background,#232736); border:1px solid #4ade80; border-radius:4px; padding:4px 8px; margin-bottom:3px; font-size:11px; animation:fadeIn .3s ease; }
@keyframes fadeIn { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
@keyframes fadeOut { from{opacity:1} to{opacity:0} }
.notif-item.out { animation:fadeOut .3s ease forwards; }
/* Progress bar */
.progress-section { margin-top:6px; }
.progress-bar { height:3px; background:var(--vscode-panel-border,#2a2d3a); border-radius:2px; overflow:hidden; }
.progress-fill { height:100%; background:#fbbf24; border-radius:2px; transition:width .5s ease; }
.progress-label { font-size:9px; opacity:.4; margin-top:2px; text-align:center; }
.actions { margin-top:8px; display:flex; flex-direction:column; gap:4px; }
.btn { background:var(--vscode-input-background,#232736); border:1px solid var(--vscode-panel-border,#2a2d3a); color:var(--vscode-sideBar-foreground,#e5e7eb); padding:8px; border-radius:4px; cursor:pointer; font-size:11px; text-align:center; }
.btn:hover { border-color:#fbbf24; }
.btn-primary { background:#fbbf24; color:#000; border-color:#fbbf24; font-weight:bold; }
.btn-primary:hover { background:#f59e0b; }
.btn-row { display:flex; gap:4px; }
.btn-row .btn { flex:1; }
.footer { margin-top:8px; display:flex; justify-content:space-between; align-items:center; font-size:10px; opacity:.4; }
.lang-toggle { display:flex; gap:4px; }
.lang-toggle button { background:none; border:none; color:var(--vscode-sideBar-foreground,#e5e7eb); cursor:pointer; font-size:10px; opacity:.6; }
.lang-toggle button:hover { opacity:1; }
.lang-toggle button.active { opacity:1; text-decoration:underline; }

/* Onboarding */
.onboarding { padding:4px 0; }
.onboarding h2 { font-size:16px; text-align:center; margin-bottom:12px; }
.onboarding-desc { font-size:12px; line-height:1.7; opacity:.85; margin-bottom:14px; text-align:center; }
.steps { margin:12px 0; }
.step { display:flex; gap:10px; margin-bottom:10px; align-items:flex-start; }
.step-num { background:#fbbf24; color:#000; font-weight:bold; width:20px; height:20px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; flex-shrink:0; }
.step-text { font-size:11.5px; line-height:1.5; opacity:.9; padding-top:1px; }
.divider { border:none; border-top:1px solid var(--vscode-panel-border,#2a2d3a); margin:14px 0; }
.how-it-works { margin:10px 0; }
.how-item { display:flex; gap:8px; margin-bottom:6px; font-size:11px; opacity:.8; line-height:1.4; }
.how-emoji { font-size:14px; flex-shrink:0; }
.login-section { margin-top:14px; text-align:center; }
.login-note { font-size:10px; opacity:.5; margin-top:6px; line-height:1.4; }
</style>
</head>
<body>

<!-- ── Farm View ── -->
<div id="app" style="display:none">
  <div class="header">
    <span id="nickname"></span>
    <span id="level"></span>
  </div>
  <canvas id="farm" width="256" height="192"></canvas>

  <!-- [6] Activity progress bar -->
  <div class="progress-section" id="progressSection" style="display:none">
    <div class="progress-bar"><div class="progress-fill" id="progressFill" style="width:0%"></div></div>
    <div class="progress-label" id="progressLabel"></div>
  </div>

  <div class="stats">
    <div class="stat"><div class="stat-label">🌾 ${d.vscodeHarvest}</div><div class="stat-value" id="harvests">0</div></div>
    <div class="stat"><div class="stat-label">📦 ${d.vscodeCollection}</div><div class="stat-value" id="collection">0/24</div></div>
    <div class="stat"><div class="stat-label">💧 ${d.vscodeWater}</div><div class="stat-value" id="water">0</div></div>
    <div class="stat"><div class="stat-label">🔥 ${d.vscodeStreak}</div><div class="stat-value" id="streak">0${dl}</div></div>
  </div>

  <!-- [3] Status bubble editing -->
  <div class="status-section">
    <div class="status-display" id="statusDisplay" onclick="toggleStatusEdit()"></div>
    <div class="status-edit" id="statusEdit" style="display:none">
      <input id="statusInput" placeholder="${locale === 'ko' ? '말풍선을 입력하세요...' : 'Type your status...'}" maxlength="50" onkeydown="if(event.key==='Enter')saveStatus()">
      <button onclick="saveStatus()">OK</button>
    </div>
  </div>

  <!-- [6] Notification area -->
  <div class="notif-area" id="notifArea"></div>

  <div class="actions">
    <button class="btn btn-primary" onclick="openFarm()">🌍 ${d.vscodeOpenFull}</button>
    <div class="btn-row">
      <button class="btn" onclick="checkUpdate()">🔄 ${locale === 'ko' ? '업데이트' : 'Update'}</button>
      <button class="btn" onclick="openWeb()">🌐 ${d.vscodeVisitWeb}</button>
    </div>
  </div>

  <!-- [2] Language toggle + version -->
  <div class="footer">
    <span>v0.2.0</span>
    <div class="lang-toggle">
      <button onclick="setLang('en')" class="${locale === 'en' ? 'active' : ''}">EN</button>
      <span>|</span>
      <button onclick="setLang('ko')" class="${locale === 'ko' ? 'active' : ''}">KO</button>
    </div>
  </div>
</div>

<!-- ── Onboarding ── -->
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
    <div class="step"><div class="step-num">1</div><div class="step-text">${d.vscodeStep1.replace(/\n/g, '<br>')}</div></div>
    <div class="step"><div class="step-num">2</div><div class="step-text">${d.vscodeStep2.replace(/\n/g, '<br>')}</div></div>
    <div class="step"><div class="step-num">3</div><div class="step-text">${d.vscodeStep3.replace(/\n/g, '<br>')} 🌿</div></div>
  </div>
  <div class="login-section">
    <button class="btn btn-primary" onclick="login()" style="width:100%;padding:10px;font-size:13px;">🔑 ${d.vscodeLoginBtn}</button>
    <p class="login-note">${d.vscodeLoginNote.replace(/\n/g, '<br>')}</p>
  </div>
  <hr class="divider">
  <div class="actions">
    <button class="btn" onclick="openWeb()">🌐 ${d.vscodeVisitWeb}</button>
  </div>
  <div class="footer" style="margin-top:10px">
    <span>v0.2.0</span>
    <div class="lang-toggle">
      <button onclick="setLang('en')" class="${locale === 'en' ? 'active' : ''}">EN</button>
      <span>|</span>
      <button onclick="setLang('ko')" class="${locale === 'ko' ? 'active' : ''}">KO</button>
    </div>
  </div>
</div>

<script>
const vscode = acquireVsCodeApi();
const canvas = document.getElementById('farm');
const ctx = canvas ? canvas.getContext('2d') : null;
const dl = '${dl}';
let frame = 0;
let farmState = null;
let initialized = false;
let statusMsg = null;
let editingStatus = false;

// [4] Character animation state
let charMode = 'idle'; // 'idle' | 'walk' | 'water'
let charX = 210, charY = 80;
let charTargetX = 210, charTargetY = 80;
let charDir = 1; // 1=right, -1=left
let idleTimer = 0;
let walkTimer = 0;
let waterAnimFrame = 0;
let lastActivityFrame = -999;
// [6] Growth flash effect
let growFlashFrames = [];
// Notification queue
let notifQueue = [];

const demoCanvas = document.getElementById('farmDemo');
const demoCtx = demoCanvas ? demoCanvas.getContext('2d') : null;
let demoCrops = [
  {stage:3,crop:'carrot'},{stage:2,crop:'tomato'},
  {stage:1,crop:'sunflower'},{stage:0,crop:'strawberry'},
  {stage:3,crop:'pumpkin'},{stage:1,crop:'radish'},
];

const cropColors = {
  carrot:'#FF8C00',tomato:'#EF4444',sunflower:'#FACC15',
  strawberry:'#FF6B81',pumpkin:'#F97316',radish:'#FBB6CE'
};

function renderFarm(c, cx, grid, isDemo) {
  frame++;
  cx.clearRect(0, 0, 256, 192);

  // Sky
  const hour = new Date().getHours();
  let skyTop, skyBot;
  if (hour>=6&&hour<11){skyTop='#FFF3E0';skyBot='#FFCCBC';}
  else if(hour>=11&&hour<17){skyTop='#B3E5FC';skyBot='#E1F5FE';}
  else if(hour>=17&&hour<21){skyTop='#F48FB1';skyBot='#FFE082';}
  else{skyTop='#0D1B2A';skyBot='#1B2838';}
  const grad=cx.createLinearGradient(0,0,0,48);
  grad.addColorStop(0,skyTop);grad.addColorStop(1,skyBot);
  cx.fillStyle=grad;cx.fillRect(0,0,256,48);

  // Stars at night
  if(hour>=21||hour<6){
    cx.fillStyle='#FFFFFF';
    for(let i=0;i<15;i++){
      if(frame%60<40||i%3!==0) cx.fillRect((i*17+5)%256,(i*11+3)%45,1,1);
    }
  }

  // Ground
  cx.fillStyle='#7BC74D';cx.fillRect(0,48,256,144);
  cx.fillStyle='#5A9E32';
  for(let x=0;x<256;x+=7)for(let y=48;y<192;y+=5)cx.fillRect(x+(y*3%5),y,1,1);

  // Soil
  cx.fillStyle='#8B6914';cx.fillRect(62,54,132,100);
  cx.fillStyle='#6B4E0A';
  for(let x=62;x<194;x+=4)for(let y=54;y<154;y+=4)cx.fillRect(x+(y*2%3),y+(x%2),1,1);

  // Grid lines
  cx.fillStyle='#6B4E0A';
  for(let i=0;i<=4;i++){cx.fillRect(64+i*32-1,54,1,100);cx.fillRect(62,56+i*24-1,132,1);}

  // Crops
  if(grid){
    for(let i=0;i<grid.length&&i<16;i++){
      const slot=grid[i]; if(!slot)continue;
      const row=Math.floor(i/4),col=i%4;
      const bx=72+col*32,by=60+row*24;
      const stage=slot.stage;
      const color=cropColors[slot.crop]||'#7BC74D';

      // [6] Growth flash
      let flashing = growFlashFrames.some(f=>f.slot===i&&frame-f.frame<15);

      cx.fillStyle='#7BC74D';
      const h=2+stage*3;
      cx.fillRect(bx+7,by+16-h,2,h);
      if(stage>=1){cx.fillStyle='#5A9E32';cx.fillRect(bx+5,by+16-h,3,2);cx.fillRect(bx+8,by+16-h+1,3,2);}
      if(stage>=2){cx.fillStyle=color;cx.fillRect(bx+5,by+16-h-1,2,2);}
      if(stage>=3){
        cx.fillStyle=color;cx.fillRect(bx+4,by+16-h-2,5,4);
        if(frame%30<15){cx.fillStyle='#FFFFFF';cx.fillRect(bx+3,by+16-h-3,1,1);cx.fillRect(bx+9,by+16-h-1,1,1);}
      }

      // [6] Flash effect on growth
      if(flashing){
        cx.fillStyle='rgba(255,255,255,'+(0.3+0.3*Math.sin(frame*0.5))+')';
        cx.fillRect(bx+2,by+4,12,14);
      }
    }
  }

  // [4] Character with animations
  if(!isDemo) {
    updateCharacter();
    drawCharacter(cx);
  } else {
    // Demo character - just bounce
    const bounce=frame%40<20?0:-1;
    drawCharPixels(cx, 210, 80+bounce, 1);
    // Demo zzz
    if(frame%120<80){
      cx.fillStyle='rgba(255,255,255,0.5)';
      cx.font='5px monospace';
      const zOff=Math.sin(frame*0.05)*2;
      cx.fillText('z',218,76+zOff);
      cx.fillText('z',221,73+zOff);
    }
  }
}

// [4] Character AI — walks to crops, waters, idles with zzz
function updateCharacter() {
  const sinceActivity = frame - lastActivityFrame;

  if (charMode === 'walk') {
    const dx = charTargetX - charX;
    const dy = charTargetY - charY;
    const dist = Math.sqrt(dx*dx+dy*dy);
    if (dist < 2) {
      charX = charTargetX; charY = charTargetY;
      if (waterAnimFrame > 0) { charMode = 'water'; }
      else { charMode = 'idle'; idleTimer = 0; }
    } else {
      const speed = 0.8;
      charX += (dx/dist)*speed;
      charY += (dy/dist)*speed;
      charDir = dx > 0 ? 1 : -1;
    }
    walkTimer++;
  } else if (charMode === 'water') {
    waterAnimFrame--;
    if (waterAnimFrame <= 0) { charMode = 'idle'; idleTimer = 0; }
  } else {
    // idle
    idleTimer++;
    // Randomly walk to a crop every ~300 frames if active recently
    if (sinceActivity < 300 && idleTimer > 80 + Math.random()*120 && farmState) {
      const occupiedSlots = [];
      for (let i=0;i<farmState.length;i++) if(farmState[i]) occupiedSlots.push(i);
      if (occupiedSlots.length > 0) {
        const slot = occupiedSlots[Math.floor(Math.random()*occupiedSlots.length)];
        const row=Math.floor(slot/4),col=slot%4;
        charTargetX = 72+col*32+Math.random()*8;
        charTargetY = 60+row*24;
        charMode = 'walk';
        walkTimer = 0;
        // Sometimes water
        if (Math.random() < 0.3) waterAnimFrame = 30;
      }
    }
    // Return to rest spot after long idle
    if (idleTimer > 400) {
      charTargetX = 210; charTargetY = 80;
      if (Math.abs(charX-210)>3 || Math.abs(charY-80)>3) {
        charMode = 'walk'; walkTimer = 0;
      }
    }
  }
}

function drawCharacter(cx) {
  const px = Math.round(charX), py = Math.round(charY);
  const sinceActivity = frame - lastActivityFrame;

  // [4] Status bubble on canvas
  if (statusMsg && sinceActivity > 200) {
    cx.fillStyle = 'rgba(0,0,0,0.6)';
    const tw = Math.min(statusMsg.length*4+8, 100);
    cx.fillRect(px-tw/2+3, py-14, tw, 9);
    cx.fillStyle = '#FFFFFF';
    cx.font = '5px monospace';
    cx.textAlign = 'center';
    cx.fillText(statusMsg.length>20?statusMsg.slice(0,20)+'…':statusMsg, px+3, py-7);
    cx.textAlign = 'start';
  }

  if (charMode === 'idle') {
    const bounce = frame%40<20?0:-1;
    drawCharPixels(cx, px, py+bounce, charDir);

    // [4] zzz when idle for long
    if (sinceActivity > 200) {
      const alpha = 0.3+0.2*Math.sin(frame*0.03);
      cx.globalAlpha = alpha;
      cx.fillStyle = '#FFFFFF';
      cx.font = '6px monospace';
      const zOff = Math.sin(frame*0.04)*2;
      cx.fillText('z', px+8, py-4+zOff);
      if(frame%90<60) cx.fillText('z', px+12, py-8+zOff*0.7);
      if(frame%90<30) cx.fillText('Z', px+15, py-12+zOff*0.5);
      cx.globalAlpha = 1;
    }
  } else if (charMode === 'walk') {
    // Walking animation - bobbing
    const bob = walkTimer%12<6?0:-1;
    drawCharPixels(cx, px, py+bob, charDir);
    // Footstep dots
    if(walkTimer%8===0){
      cx.fillStyle='rgba(90,158,50,0.5)';
      cx.fillRect(px+2,py+12,2,1);
    }
  } else if (charMode === 'water') {
    drawCharPixels(cx, px, py, charDir);
    // Water drops
    const wf = 30-waterAnimFrame;
    cx.fillStyle='#60A5FA';
    for(let i=0;i<3;i++){
      const wx=px+charDir*8+i*2;
      const wy=py+4+wf*0.3+Math.sin(wf*0.3+i)*2;
      cx.fillRect(wx,wy,1,2);
    }
  }
}

function drawCharPixels(cx, x, y, dir) {
  // Hat
  cx.fillStyle='#5C3A1E';
  cx.fillRect(x,y,6,3);
  // Face
  cx.fillStyle='#FFD5B8';
  cx.fillRect(x+1,y+3,4,3);
  // Eyes
  cx.fillStyle='#3E2723';
  if(dir>0){cx.fillRect(x+2,y+4,1,1);cx.fillRect(x+4,y+4,1,1);}
  else{cx.fillRect(x+1,y+4,1,1);cx.fillRect(x+3,y+4,1,1);}
  // Body
  cx.fillStyle='#6C9BD2';
  cx.fillRect(x,y+6,6,4);
  // Legs
  cx.fillStyle='#5B7A9E';
  cx.fillRect(x+1,y+10,2,2);
  cx.fillRect(x+3,y+10,2,2);
}

function updateUI(data) {
  if(!data||!data.initialized){
    document.getElementById('app').style.display='none';
    document.getElementById('onboardingView').style.display='block';
    initialized=false; return;
  }
  initialized=true;
  document.getElementById('app').style.display='block';
  document.getElementById('onboardingView').style.display='none';
  document.getElementById('nickname').textContent='🌱 @'+data.nickname;
  document.getElementById('level').textContent='Lv.'+data.level;
  document.getElementById('harvests').textContent=data.totalHarvests;
  document.getElementById('collection').textContent=data.uniqueItems+'/'+data.totalItems;
  document.getElementById('water').textContent=data.waterReceived;
  document.getElementById('streak').textContent=data.streakDays+dl;
  farmState=data.grid;
  statusMsg=data.statusMessage;

  // [3] Status display
  const sd=document.getElementById('statusDisplay');
  if(data.statusMessage){
    sd.textContent='💬 "'+data.statusMessage+'"';
    sd.style.display='block';
  } else {
    sd.textContent='💬 ${locale === 'ko' ? '말풍선을 설정해보세요' : 'Set a status message'}';
    sd.style.opacity='0.4';
    sd.style.display='block';
  }

  // [6] Progress bar for collection
  const pct=Math.round(data.uniqueItems/data.totalItems*100);
  const ps=document.getElementById('progressSection');
  const pf=document.getElementById('progressFill');
  const pl=document.getElementById('progressLabel');
  ps.style.display='block';
  pf.style.width=pct+'%';
  pl.textContent='${locale === 'ko' ? '도감 진행률' : 'Codex'} '+pct+'%';
}

// [3] Status editing
function toggleStatusEdit(){
  editingStatus=!editingStatus;
  const el=document.getElementById('statusEdit');
  el.style.display=editingStatus?'flex':'none';
  if(editingStatus){
    const inp=document.getElementById('statusInput');
    inp.value=statusMsg||'';
    inp.focus();
  }
}
function saveStatus(){
  const inp=document.getElementById('statusInput');
  const text=inp.value.trim();
  vscode.postMessage({type:'setStatus',text});
  editingStatus=false;
  document.getElementById('statusEdit').style.display='none';
}

// [6] Show notification with auto-dismiss
function showNotif(msg){
  const area=document.getElementById('notifArea');
  const el=document.createElement('div');
  el.className='notif-item';
  el.textContent=msg;
  area.appendChild(el);
  setTimeout(()=>{el.classList.add('out');setTimeout(()=>el.remove(),300);},3000);
}

// [2]
function setLang(l){vscode.postMessage({type:'setLang',lang:l});}
function checkUpdate(){vscode.postMessage({type:'checkUpdate'});}
function openWeb(){vscode.postMessage({type:'openWeb'});}
function openFarm(){vscode.postMessage({type:'openFarm'});}
function login(){vscode.postMessage({type:'login'});}

window.addEventListener('message',(e)=>{
  const msg=e.data;
  if(msg.type==='state'){
    updateUI(msg.data);
  } else if(msg.type==='activity'){
    // [4][6] Activity: character wakes up, growth flash
    lastActivityFrame=frame;
    if(charMode==='idle'){
      // Wake up and walk to a random crop
      if(farmState){
        const occupied=[];
        for(let i=0;i<farmState.length;i++)if(farmState[i])occupied.push(i);
        if(occupied.length>0){
          const slot=occupied[Math.floor(Math.random()*occupied.length)];
          const row=Math.floor(slot/4),col=slot%4;
          charTargetX=72+col*32+Math.random()*8;
          charTargetY=60+row*24;
          charMode='walk';walkTimer=0;
          if(Math.random()<0.5)waterAnimFrame=30;
        }
      }
    }
    // [6] Flash growth on all growing slots
    if(farmState){
      for(let i=0;i<farmState.length;i++){
        if(farmState[i]&&farmState[i].stage>0&&farmState[i].stage<3){
          growFlashFrames.push({slot:i,frame:frame});
        }
      }
    }
    // Show notifications
    if(msg.notifications){
      let delay=0;
      for(const n of msg.notifications){
        setTimeout(()=>showNotif(n),delay);
        delay+=1500;
      }
    }
  } else if(msg.type==='activity-demo'){
    for(const c of demoCrops){if(c.stage<3){c.stage++;break;}}
    if(demoCrops.length<8&&Math.random()<0.4){
      const types=['carrot','tomato','sunflower','strawberry','pumpkin','radish'];
      demoCrops.push({stage:0,crop:types[Math.floor(Math.random()*types.length)]});
    }
  }
});

// Clean up old flash frames
setInterval(()=>{growFlashFrames=growFlashFrames.filter(f=>frame-f.frame<20);},1000);

// Render loop
setInterval(()=>{
  if(initialized&&ctx&&farmState){
    renderFarm(canvas,ctx,farmState,false);
  } else if(!initialized&&demoCtx){
    renderFarm(demoCanvas,demoCtx,demoCrops,true);
  }
},80);

vscode.postMessage({type:'ready'});
</script>
</body>
</html>`;
  }
}
