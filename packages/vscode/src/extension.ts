import * as vscode from 'vscode';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { LocalState, CropType, GrowthStage, InventoryItem } from '@claude-farmer/shared';
import { CROPS, MAX_GROWTH_STAGE, GRID_SIZE, calculateLevel, isBoostTime } from '@claude-farmer/shared';
import { rollGacha } from '@claude-farmer/shared';
import { type Locale, detectLocale, getDict } from '@claude-farmer/shared';

const BASE_URL = 'https://claudefarmer.com';

// ── Output channel (debug) ──
let out: vscode.OutputChannel | undefined;
function log(msg: string) { out?.appendLine(`[${new Date().toISOString()}] ${msg}`); }

// ── Server sync ──
const SYNC_INTERVAL_MS = 30_000;
let lastSyncTime = 0;

async function syncToServer(state: LocalState): Promise<void> {
  const now = Date.now();
  if (now - lastSyncTime < SYNC_INTERVAL_MS) return;
  lastSyncTime = now;
  try {
    await fetch(`${BASE_URL}/api/farm/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        github_id: state.user.github_id,
        nickname: state.user.nickname,
        avatar_url: state.user.avatar_url,
        level: state.farm.level,
        total_harvests: state.farm.total_harvests,
        unique_items: new Set(state.inventory.map(i => i.id)).size,
        streak_days: state.activity.streak_days,
        today_input_chars: state.activity.today_input_chars,
        today_harvests: state.activity.today_harvests,
        today_water_given: state.activity.today_water_given,
        inventory: state.inventory,
        status_message: state.status_message,
        farm: state.farm,
      }),
    });
  } catch { /* silent */ }
}

// ── State management ──
const dataPath = join(homedir(), '.claude-farmer');
const statePath = join(dataPath, 'state.json');

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

async function loadState(): Promise<LocalState | null> {
  try {
    if (!existsSync(statePath)) return null;
    return JSON.parse(await readFile(statePath, 'utf-8')) as LocalState;
  } catch { return null; }
}

async function saveState(state: LocalState): Promise<void> {
  if (!existsSync(dataPath)) await mkdir(dataPath, { recursive: true });
  await writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8');
}

function createDefaultState(githubId: string, nickname: string, avatarUrl: string): LocalState {
  return {
    version: 1,
    user: { github_id: githubId, nickname, avatar_url: avatarUrl, created_at: new Date().toISOString() },
    farm: { level: 1, grid: new Array(GRID_SIZE).fill(null), total_harvests: 0 },
    inventory: [],
    status_message: null,
    bookmarks: [],
    activity: {
      today_input_chars: 0, today_harvests: 0,
      today_water_received: 0, today_water_given: 0,
      streak_days: 1, last_active_date: todayStr(),
    },
    last_synced: new Date().toISOString(),
  };
}

// ── Daily reset ──
function resetDailyIfNeeded(state: LocalState): void {
  const today = todayStr();
  if (state.activity.last_active_date === today) return;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const wasYesterday = state.activity.last_active_date === yesterday.toISOString().slice(0, 10);
  state.activity.streak_days = wasYesterday ? (state.activity.streak_days ?? 1) + 1 : 1;
  state.activity.today_input_chars = 0;
  state.activity.today_harvests = 0;
  state.activity.today_water_received = 0;
  state.activity.today_water_given = 0;
  state.activity.last_active_date = today;
}

// ── Game logic ──
function randomCrop(): CropType {
  return CROPS[Math.floor(Math.random() * CROPS.length)];
}

function harvestSlot(state: LocalState, idx: number): InventoryItem | null {
  const slot = state.farm.grid[idx];
  if (!slot) return null;
  const item = rollGacha(isBoostTime(), new Set(state.inventory.map(i => i.id)));
  const reward: InventoryItem = { id: item.id, name: item.name, rarity: item.rarity, obtained_at: new Date().toISOString() };
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
      const r = harvestSlot(state, i);
      if (r) rewards.push(r);
    }
  }
  return rewards;
}

function growCrops(state: LocalState): void {
  for (const slot of state.farm.grid) {
    if (slot && slot.stage < MAX_GROWTH_STAGE) {
      slot.stage = (slot.stage + 1) as GrowthStage;
    }
  }
}

function plantCrop(state: LocalState): { slotIndex: number; crop: CropType } | null {
  const boost = isBoostTime();
  const turnThreshold = boost ? 2 : 3;
  const farm = state.farm as typeof state.farm & { _plant_turn?: number };
  if (!farm._plant_turn) farm._plant_turn = 0;
  farm._plant_turn = (farm._plant_turn + 1) % turnThreshold;
  if (farm._plant_turn !== 0) return null;

  const empty = state.farm.grid.findIndex(s => s === null);
  let slotIndex = empty;
  if (slotIndex === -1) {
    let oldestTime = Infinity, oldest = -1;
    for (let i = 0; i < state.farm.grid.length; i++) {
      const s = state.farm.grid[i];
      if (s) { const t = new Date(s.planted_at).getTime(); if (t < oldestTime) { oldestTime = t; oldest = i; } }
    }
    if (oldest === -1) return null;
    harvestSlot(state, oldest);
    slotIndex = oldest;
  }
  const crop = randomCrop();
  state.farm.grid[slotIndex] = { slot: slotIndex, crop, stage: 0 as GrowthStage, planted_at: new Date().toISOString() };
  return { slotIndex, crop };
}

// ── Locale helper ──
function getExtensionLocale(): Locale {
  const s = vscode.workspace.getConfiguration('claudeFarmer').get<string>('language', 'auto');
  if (s === 'en' || s === 'ko') return s;
  return detectLocale(vscode.env.language);
}

// ── One-time session URL ──
async function getVscodeSessionUrl(githubId: string): Promise<string | null> {
  log(`getVscodeSessionUrl: start for ${githubId}`);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => { log('getVscodeSessionUrl: timeout — aborting'); controller.abort(); }, 5000);
    const res = await fetch(`${BASE_URL}/api/auth/vscode-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ github_id: githubId }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    log(`getVscodeSessionUrl: response ${res.status}`);
    if (!res.ok) return null;
    const data = await res.json() as { url?: string };
    log(`getVscodeSessionUrl: got url=${data.url}`);
    return data.url ? `${BASE_URL}${data.url}` : null;
  } catch (e) {
    log(`getVscodeSessionUrl: error — ${e}`);
    return null;
  }
}

// ── Shared HTML generators ──
function iframeHtml(src: string): string {
  return `<!DOCTYPE html>
<html style="margin:0;padding:0;width:100%;height:100%">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src *; script-src 'unsafe-inline'; style-src 'unsafe-inline';">
  <style>
    html,body{margin:0;padding:0;width:100%;height:100vh;overflow:hidden;background:#0d1117}
    iframe{width:100%;height:100%;border:none;display:block}
  </style>
</head>
<body>
  <iframe
    src="${src}"
    sandbox="allow-scripts allow-forms allow-same-origin allow-pointer-lock allow-popups"
  ></iframe>
  <script>
    const vscode = acquireVsCodeApi();
    window.addEventListener('message', e => {
      if (e.data?.type === 'cf-login') vscode.postMessage({ type: 'login' });
    });
  </script>
</body>
</html>`;
}

function loadingHtml(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
  <style>
    body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;
         background:#0d1117;color:#6b7280;font-family:-apple-system,BlinkMacSystemFont,sans-serif;
         flex-direction:column;gap:12px}
    .spinner{width:24px;height:24px;border:2px solid #374151;border-top-color:#fbbf24;
             border-radius:50%;animation:spin .8s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
    p{font-size:13px;margin:0;opacity:.5}
  </style>
</head>
<body>
  <div style="font-size:36px">🌱</div>
  <div class="spinner"></div>
  <p>Loading your farm…</p>
</body>
</html>`;
}

function loginHtml(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';">
  <style>
    *{box-sizing:border-box}
    body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;
         background:#0d1117;color:#e5e7eb;font-family:-apple-system,BlinkMacSystemFont,sans-serif;
         flex-direction:column;gap:20px;padding:24px;text-align:center}
    h2{font-size:22px;margin:0;color:#fff}
    p{opacity:.6;font-size:13px;margin:0;line-height:1.7;max-width:260px}
    button{background:#fbbf24;color:#000;border:none;padding:12px 28px;border-radius:8px;
           font-size:14px;font-weight:700;cursor:pointer;transition:background .15s}
    button:hover{background:#f59e0b}
    .note{font-size:11px;opacity:.35;max-width:260px}
  </style>
</head>
<body>
  <div style="font-size:52px">🌱</div>
  <h2>Claude Farmer</h2>
  <p>Your farm grows while you code.<br>Login to watch it.</p>
  <button onclick="login()">Login with GitHub</button>
  <p class="note">Opens GitHub OAuth in your browser.<br>Returns here automatically after login.</p>
  <script>
    const vscode = acquireVsCodeApi();
    function login() { vscode.postMessage({ type: 'login' }); }
  </script>
</body>
</html>`;
}

// ── Sidebar provider (shows farm directly) ──
class FarmSidebarProvider implements vscode.WebviewViewProvider {
  static current: FarmSidebarProvider | undefined;
  private view?: vscode.WebviewView;

  constructor(private readonly _context: vscode.ExtensionContext) {
    FarmSidebarProvider.current = this;
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.html = loadingHtml();
    view.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type === 'login') {
        vscode.env.openExternal(vscode.Uri.parse(`${BASE_URL}/api/auth/login?from=vscode`));
      }
    });
    this.initView();
  }

  private async initView(): Promise<void> {
    const state = await loadState();
    if (state) {
      await this.navigateToFarm(state.user.github_id);
    } else {
      if (this.view) this.view.webview.html = loginHtml();
    }
  }

  async navigateToFarm(githubId: string): Promise<void> {
    if (!this.view) return;
    const url = await getVscodeSessionUrl(githubId);
    this.view.webview.html = iframeHtml(url ?? `${BASE_URL}/@${githubId}`);
  }

  onLoginComplete(state: LocalState): void {
    this.navigateToFarm(state.user.github_id);
  }
}

// ── Activity handler ──
async function handleCodingActivity(charCount = 0): Promise<void> {
  const state = await loadState();
  if (!state) return;
  resetDailyIfNeeded(state);
  if (charCount > 0) state.activity.today_input_chars += charCount;
  plantCrop(state);
  growCrops(state);
  autoHarvest(state);
  await saveState(state);
  syncToServer(state);
}

// ── Extension entry point ──
export function activate(context: vscode.ExtensionContext): void {
  out = vscode.window.createOutputChannel('Claude Farmer');
  context.subscriptions.push(out);
  log('activate: extension activated');

  // 1. OAuth URI handler
  context.subscriptions.push(
    vscode.window.registerUriHandler({
      async handleUri(uri: vscode.Uri) {
        if (uri.path !== '/callback') return;
        const p = new URLSearchParams(uri.query);
        const githubId = p.get('github_id');
        const nickname = p.get('nickname');
        const avatarUrl = p.get('avatar_url') ?? '';
        if (!githubId || !nickname) return;

        const state = createDefaultState(githubId, nickname, avatarUrl);
        await saveState(state);
        lastSyncTime = 0;
        syncToServer(state);
        FarmSidebarProvider.current?.onLoginComplete(state);

        const d = getDict(getExtensionLocale());
        vscode.window.showInformationMessage(`🌱 ${nickname}, ${d.vscodeWelcome}!`);
      },
    })
  );

  // 2. Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeFarmer.openFarm', () =>
      vscode.commands.executeCommand('claudeFarmer.farmView.focus')
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeFarmer.login', () =>
      vscode.env.openExternal(vscode.Uri.parse(`${BASE_URL}/api/auth/login?from=vscode`))
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeFarmer.openWeb', () =>
      vscode.env.openExternal(vscode.Uri.parse(BASE_URL))
    )
  );

  // 3. Sidebar
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'claudeFarmer.farmView',
      new FarmSidebarProvider(context)
    )
  );

  // 4. Activity detection
  let activityCounter = 0;
  let lastActivityTime = 0;

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(e => {
      const now = Date.now();
      if (now - lastActivityTime < 2000) return;
      lastActivityTime = now;
      const chars = e.contentChanges.reduce((s, c) => s + c.text.length, 0);
      activityCounter += chars;
      if (activityCounter > 50) {
        const flushed = activityCounter;
        activityCounter = 0;
        handleCodingActivity(flushed);
      }
    })
  );
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(() => handleCodingActivity(0))
  );
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTerminal(() => handleCodingActivity(0))
  );

  // 5. Auto-focus sidebar on first install
  const key = 'claudeFarmer.hasShownPanel';
  if (!context.globalState.get(key)) {
    context.globalState.update(key, true);
    setTimeout(() => vscode.commands.executeCommand('claudeFarmer.farmView.focus'), 1500);
  }
}

export function deactivate(): void {}
