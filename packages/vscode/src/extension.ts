import * as vscode from 'vscode';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { LocalState, CropType, GrowthStage, InventoryItem } from '@claude-farmer/shared';
import { CROPS, MAX_GROWTH_STAGE, CROP_EMOJI, GRID_SIZE, GRID_COLS, calculateLevel, isBoostTime } from '@claude-farmer/shared';
import { rollGacha, TOTAL_ITEMS } from '@claude-farmer/shared';
import { type Locale, detectLocale, getDict } from '@claude-farmer/shared';

// ── Server sync ──
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5분 간격
let lastSyncTime = 0;

async function syncToServer(state: LocalState): Promise<void> {
  const now = Date.now();
  if (now - lastSyncTime < SYNC_INTERVAL_MS) return;
  lastSyncTime = now;
  try {
    await fetch('https://claudefarmer.com/api/farm/sync', {
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
  } catch {
    // 네트워크 실패 시 silent fail
  }
}

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
  const ownedIds = new Set(state.inventory.map(i => i.id));
  const item = rollGacha(isBoostTime(), ownedIds);
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
            lastSyncTime = 0; // 즉시 동기화
            syncToServer(state);
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

    // Track webview disposal to avoid stale references
    webviewView.onDidDispose(() => {
      this.webviewView = undefined;
    });

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type === 'openWeb') {
        vscode.env.openExternal(vscode.Uri.parse('https://claudefarmer.com'));
      } else if (msg.type === 'openFarm') {
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
        if (this.state && typeof msg.text === 'string') {
          const text = msg.text.slice(0, 200);
          const link = typeof msg.link === 'string' && /^https?:\/\//i.test(msg.link) ? msg.link.slice(0, 500) : undefined;
          this.state.status_message = text
            ? { text, link, updated_at: new Date().toISOString() }
            : null;
          await saveState(this.state);
          this.sendState();
          try {
            await fetch('https://claudefarmer.com/api/farm/status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                github_id: this.state.user.github_id,
                status_message: this.state.status_message,
              }),
            });
          } catch { /* silent */ }
        }
      } else if (msg.type === 'setLang') {
        if (msg.lang === 'en' || msg.lang === 'ko' || msg.lang === 'auto') {
          await vscode.workspace.getConfiguration('claudeFarmer').update('language', msg.lang, true);
        }
      } else if (msg.type === 'checkUpdate') {
        vscode.env.openExternal(vscode.Uri.parse('https://marketplace.visualstudio.com/items?itemName=doribear.claude-farmer-vscode'));
      } else if (msg.type === 'explore') {
        // 랜덤 농장 탐험
        try {
          const exclude = this.state?.user?.github_id || '';
          const res = await fetch(`https://claudefarmer.com/api/explore?exclude=${exclude}&count=5`);
          const profiles = res.ok ? await res.json() : [];
          this.postMessage({ type: 'exploreResult', profiles });
        } catch { this.postMessage({ type: 'exploreResult', profiles: [] }); }
      } else if (msg.type === 'search') {
        // 유저 검색
        try {
          const res = await fetch(`https://claudefarmer.com/api/explore/search?q=${encodeURIComponent(msg.query)}`);
          const profiles = res.ok ? await res.json() : [];
          this.postMessage({ type: 'searchResult', profiles });
        } catch { this.postMessage({ type: 'searchResult', profiles: [] }); }
      } else if (msg.type === 'fetchFarm') {
        // 다른 유저 농장 조회
        try {
          const res = await fetch(`https://claudefarmer.com/api/farm/${msg.targetId}`);
          const profile = res.ok ? await res.json() : null;
          this.postMessage({ type: 'farmResult', profile });
        } catch { this.postMessage({ type: 'farmResult', profile: null }); }
      } else if (msg.type === 'visitFarm') {
        // 농장 방문 기록
        if (this.state) {
          try {
            await fetch(`https://claudefarmer.com/api/farm/${msg.targetId}/visit`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ from: this.state.user.github_id }),
            });
          } catch { /* silent */ }
        }
      } else if (msg.type === 'water') {
        // 물 주기
        if (this.state) {
          try {
            const res = await fetch('https://claudefarmer.com/api/water', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ from: this.state.user.github_id, to: msg.targetId }),
            });
            const data = res.ok ? await res.json() : { ok: false };
            this.postMessage({ type: 'waterResult', ...data });
          } catch { this.postMessage({ type: 'waterResult', ok: false }); }
        }
      } else if (msg.type === 'getBookmarks') {
        // 북마크 목록 조회
        if (this.state) {
          try {
            const res = await fetch(`https://claudefarmer.com/api/bookmarks`, {
              headers: { 'Cookie': `cf_session=${JSON.stringify({ github_id: this.state.user.github_id })}` },
            });
            // 쿠키 인증 안되므로 로컬 북마크 + 서버 프로필 조회 방식
            const bookmarkIds = this.state.bookmarks || [];
            const profiles: unknown[] = [];
            for (const id of bookmarkIds) {
              try {
                const r = await fetch(`https://claudefarmer.com/api/farm/${id}`);
                if (r.ok) {
                  const p = await r.json();
                  profiles.push({ ...p, github_id: id });
                }
              } catch { /* skip */ }
            }
            this.postMessage({ type: 'bookmarksResult', profiles, bookmarkIds });
          } catch { this.postMessage({ type: 'bookmarksResult', profiles: [], bookmarkIds: [] }); }
        }
      } else if (msg.type === 'toggleBookmark') {
        // 북마크 추가/삭제 (로컬 state에 저장)
        if (this.state) {
          const ids = this.state.bookmarks || [];
          const idx = ids.indexOf(msg.targetId);
          if (idx >= 0) {
            ids.splice(idx, 1);
          } else {
            ids.push(msg.targetId);
          }
          this.state.bookmarks = ids;
          await saveState(this.state);
          // 서버에도 동기화 시도
          try {
            await fetch('https://claudefarmer.com/api/bookmarks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                github_id: this.state.user.github_id,
                target_id: msg.targetId,
                action: idx >= 0 ? 'remove' : 'add',
              }),
            });
          } catch { /* silent */ }
          this.postMessage({ type: 'bookmarkToggled', bookmarkIds: this.state.bookmarks });
        }
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
      syncToServer(this.state);
    }
    this.sendState();
  }

  private postMessage(msg: unknown) {
    if (this.webviewView) {
      this.webviewView.webview.postMessage(msg);
    }
  }

  private async sendState() {
    if (!this.webviewView) return;
    if (this.state) {
      const uniqueItems = new Set(this.state.inventory.map(i => i.id)).size;

      // 방문자 데이터 가져오기 (고스트 캐릭터용)
      let visitors: { github_id: string; nickname: string; visited_at: string; watered?: boolean }[] = [];
      try {
        const res = await fetch(`https://claudefarmer.com/api/farm/${this.state.user.github_id}`);
        if (res.ok) {
          const data = await res.json();
          visitors = data.footprints || [];
        }
      } catch { /* 네트워크 에러 시 빈 배열 유지 */ }

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
          statusLink: this.state.status_message?.link || null,
          character: this.state.user.character || null,
          bookmarkIds: this.state.bookmarks || [],
          visitors,
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
    syncToServer(this.state);
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
  font-size: clamp(10px, 3vw, 12px); padding: 6px;
}
.header { display:flex; align-items:center; justify-content:space-between; margin-bottom:4px; font-size:clamp(9px, 2.8vw, 11px); opacity:.7; }
canvas { width:100%; image-rendering:pixelated; image-rendering:crisp-edges; border-radius:6px; border:1px solid var(--vscode-panel-border,#2a2d3a); }
.stats { display:grid; grid-template-columns:1fr 1fr; gap:3px; margin-top:6px; }
.stat { background:var(--vscode-input-background,#232736); border:1px solid var(--vscode-panel-border,#2a2d3a); border-radius:4px; padding:4px; text-align:center; }
.stat-label { opacity:.5; font-size:clamp(8px, 2.5vw, 10px); }
.stat-value { font-weight:bold; font-size:clamp(11px, 3.5vw, 14px); }
.status-section { margin-top:4px; }
.status-display { padding:4px 6px; background:var(--vscode-input-background,#232736); border:1px solid var(--vscode-panel-border,#2a2d3a); border-radius:4px; font-size:clamp(9px, 2.8vw, 11px); cursor:pointer; opacity:.8; }
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
.progress-section { margin-top:6px; }
.progress-bar { height:3px; background:var(--vscode-panel-border,#2a2d3a); border-radius:2px; overflow:hidden; }
.progress-fill { height:100%; background:#fbbf24; border-radius:2px; transition:width .5s ease; }
.progress-label { font-size:9px; opacity:.4; margin-top:2px; text-align:center; }
.actions { margin-top:8px; display:flex; flex-direction:column; gap:4px; }
.btn { background:var(--vscode-input-background,#232736); border:1px solid var(--vscode-panel-border,#2a2d3a); color:var(--vscode-sideBar-foreground,#e5e7eb); padding:6px; border-radius:4px; cursor:pointer; font-size:clamp(9px, 3vw, 11px); text-align:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.btn:hover { border-color:#fbbf24; }
.btn-primary { background:#fbbf24; color:#000; border-color:#fbbf24; font-weight:bold; }
.btn-primary:hover { background:#f59e0b; }
.btn-row { display:flex; gap:3px; }
.btn-row .btn { flex:1; min-width:0; }
.footer { margin-top:8px; display:flex; justify-content:space-between; align-items:center; font-size:10px; opacity:.4; }
.lang-toggle { display:flex; gap:4px; }
.lang-toggle button { background:none; border:none; color:var(--vscode-sideBar-foreground,#e5e7eb); cursor:pointer; font-size:10px; opacity:.6; }
.lang-toggle button:hover { opacity:1; }
.lang-toggle button.active { opacity:1; text-decoration:underline; }

/* Tab bar */
.tab-bar { display:flex; gap:0; margin-bottom:8px; border-bottom:1px solid var(--vscode-panel-border,#2a2d3a); }
.tab-btn { flex:1; background:none; border:none; color:var(--vscode-sideBar-foreground,#e5e7eb); padding:6px 2px; cursor:pointer; font-size:clamp(10px, 3vw, 12px); font-weight:bold; opacity:.5; border-bottom:2px solid transparent; transition:all .2s; }
.tab-btn:hover { opacity:.8; }
.tab-btn.active { opacity:1; border-bottom-color:#fbbf24; }

/* Explore view */
.explore-section { margin-bottom:10px; }
.explore-section h3 { font-size:11px; font-weight:bold; opacity:.5; margin-bottom:6px; }
.search-row { display:flex; gap:4px; margin-bottom:8px; }
.search-row input { flex:1; background:var(--vscode-input-background,#232736); border:1px solid var(--vscode-panel-border,#2a2d3a); border-radius:4px; padding:6px 8px; color:var(--vscode-input-foreground,#e5e7eb); font-size:11px; outline:none; }
.search-row input:focus { border-color:#fbbf24; }
.search-row button { background:#fbbf24; color:#000; border:none; border-radius:4px; padding:6px 10px; cursor:pointer; font-size:11px; font-weight:bold; white-space:nowrap; }
.profile-card { background:var(--vscode-input-background,#232736); border:1px solid var(--vscode-panel-border,#2a2d3a); border-radius:4px; padding:6px; margin-bottom:3px; cursor:pointer; transition:border-color .2s; }
.profile-card:hover { border-color:#fbbf24; }
.profile-name { font-weight:bold; font-size:clamp(10px, 3vw, 12px); }
.profile-level { font-size:10px; opacity:.5; margin-left:4px; }
.profile-status { font-size:10px; opacity:.6; margin-top:2px; }
.profile-harvests { font-size:10px; opacity:.4; float:right; }
.empty-msg { text-align:center; opacity:.4; font-size:11px; padding:12px; white-space:pre-line; }

/* Visit view */
.visit-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
.visit-back { background:none; border:none; color:var(--vscode-sideBar-foreground,#e5e7eb); cursor:pointer; font-size:11px; opacity:.7; padding:4px 0; }
.visit-back:hover { opacity:1; }
.visit-info { text-align:center; margin:6px 0; }
.visit-nickname { font-size:14px; font-weight:bold; }
.visit-level { font-size:11px; opacity:.5; }
.visit-status { font-size:11px; opacity:.6; margin-top:4px; }
.visit-actions { display:flex; gap:4px; margin-top:8px; }
.visit-actions .btn { flex:1; }

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

<!-- ── Main App (logged in) ── -->
<div id="app" style="display:none">
  <!-- Tab bar -->
  <div class="tab-bar">
    <button class="tab-btn active" id="tabFarm" onclick="switchTab('farm')">🌱 ${d.vscodeTabFarm}</button>
    <button class="tab-btn" id="tabExplore" onclick="switchTab('explore')">🌍 ${d.vscodeTabExplore}</button>
  </div>

  <!-- ── Farm Tab ── -->
  <div id="farmTab">
    <div class="header">
      <span id="nickname"></span>
      <span id="level"></span>
    </div>
    <div style="position:relative;">
      <canvas id="farm" width="256" height="192" style="touch-action:none;cursor:grab;"></canvas>
      <button id="viewModeBtn" onclick="toggleViewMode()" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.6);color:white;border:1px solid rgba(255,255,255,0.2);border-radius:6px;padding:6px 10px;font-size:16px;cursor:pointer;min-width:36px;min-height:36px;display:flex;align-items:center;justify-content:center;">👁</button>
    </div>
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
    <div class="status-section">
      <div class="status-display" id="statusDisplay" onclick="toggleStatusEdit()"></div>
      <div class="status-edit" id="statusEdit" style="display:none">
        <input id="statusInput" placeholder="${locale === 'ko' ? '말풍선을 입력하세요...' : 'Type your status...'}" maxlength="200" onkeydown="if(event.key==='Enter')saveStatus()">
        <input id="linkInput" placeholder="🔗 https://..." maxlength="500" style="margin-top:4px;font-size:11px;opacity:0.7" onkeydown="if(event.key==='Enter')saveStatus()">
        <button onclick="saveStatus()">OK</button>
      </div>
    </div>
    <div class="notif-area" id="notifArea"></div>
    <div class="actions">
      <div class="btn-row">
        <button class="btn" onclick="checkUpdate()">🔄 ${locale === 'ko' ? '업데이트' : 'Update'}</button>
        <button class="btn" onclick="openWeb()">🌐 ${d.vscodeVisitWeb}</button>
      </div>
    </div>
    <div class="footer">
      <span>v0.3.1</span>
      <div class="lang-toggle">
        <button onclick="setLang('en')" class="${locale === 'en' ? 'active' : ''}">EN</button>
        <span>|</span>
        <button onclick="setLang('ko')" class="${locale === 'ko' ? 'active' : ''}">KO</button>
      </div>
    </div>
  </div>

  <!-- ── Explore Tab ── -->
  <div id="exploreTab" style="display:none">
    <!-- Bookmarks -->
    <div class="explore-section">
      <h3>⭐ ${d.vscodeMyNeighbors}</h3>
      <div id="bookmarksList">
        <div class="empty-msg">${d.vscodeNoNeighbors.replace(/\n/g, '<br>')}</div>
      </div>
    </div>

    <!-- Search -->
    <div class="explore-section">
      <div class="search-row">
        <input id="searchInput" placeholder="${d.vscodeSearchPlaceholder}" onkeydown="if(event.key==='Enter')doSearch()">
        <button onclick="doSearch()">🔍 ${d.vscodeSearchBtn}</button>
      </div>
      <div id="searchResultsSection" style="display:none">
        <h3>🔍 ${d.vscodeSearchResults}</h3>
        <div id="searchResultsList"></div>
      </div>
    </div>

    <!-- Random Visit -->
    <button class="btn btn-primary" onclick="doExplore()" id="exploreBtn" style="width:100%;margin-bottom:8px;">
      🎲 ${d.vscodeRandomVisit}
    </button>
    <div id="randomSection" style="display:none">
      <div class="explore-section">
        <h3>🎲 ${d.vscodeDiscoveredFarms}</h3>
        <div id="randomList"></div>
      </div>
    </div>
  </div>

  <!-- ── Farm Visit View ── -->
  <div id="visitView" style="display:none">
    <div class="visit-header">
      <button class="visit-back" onclick="closeVisit()">← ${d.vscodeVisitBack}</button>
    </div>
    <canvas id="visitCanvas" width="256" height="192" style="touch-action:none;cursor:grab;"></canvas>
    <div class="visit-info">
      <div><span class="visit-nickname" id="visitNickname"></span> <span class="visit-level" id="visitLevel"></span></div>
      <div class="visit-status" id="visitStatus"></div>
      <div style="font-size:10px;opacity:.4;margin-top:2px;">🌾 <span id="visitHarvests">0</span></div>
    </div>
    <div class="visit-actions">
      <button class="btn btn-primary" id="waterBtn" onclick="doWater()">💧 ${d.vscodeVisitWater}</button>
      <button class="btn" id="bookmarkBtn" onclick="doToggleBookmark()">⭐ ${d.vscodeVisitBookmark}</button>
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
    <span>v0.3.1</span>
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
const visitCanvas = document.getElementById('visitCanvas');
const visitCtx = visitCanvas ? visitCanvas.getContext('2d') : null;
const dl = '${dl}';
let frame = 0;
let farmState = null;
let initialized = false;
let statusMsg = null;
let statusLink = null;
let editingStatus = false;
let currentTab = 'farm';
let myGithubId = '';
let bookmarkIds = [];
let myCharacter = null; // owner's CharacterAppearance

// Character palette data
const CHAR_HAIR_COLORS = ${JSON.stringify({
  brown: { base: '#5C3A1E', highlight: '#7A5230' },
  black: { base: '#2C1810', highlight: '#3E2723' },
  blonde: { base: '#D4A543', highlight: '#E8C468' },
  red: { base: '#A0522D', highlight: '#CD853F' },
  pink: { base: '#E8A0BF', highlight: '#F0C0D0' },
  blue: { base: '#4A6FA5', highlight: '#6B8FBF' },
  white: { base: '#D0D0D0', highlight: '#EEEEEE' },
  green: { base: '#5A9E5A', highlight: '#7BC77B' },
})};
const CHAR_SKIN_TONES = ${JSON.stringify({
  light: { base: '#FFD5B8', shadow: '#E8B796' },
  medium: { base: '#D4A574', shadow: '#B8886A' },
  dark: { base: '#8B6544', shadow: '#6B4E30' },
  pale: { base: '#FFF0E0', shadow: '#F0D8C0' },
})};
const CHAR_CLOTHES_COLORS = ${JSON.stringify({
  blue: { base: '#6C9BD2', shadow: '#4A7FB5' },
  red: { base: '#E57373', shadow: '#C05050' },
  green: { base: '#81C784', shadow: '#5A9E5A' },
  purple: { base: '#BA68C8', shadow: '#9040A0' },
  orange: { base: '#FFB74D', shadow: '#E09530' },
  pink: { base: '#F06292', shadow: '#D04070' },
  teal: { base: '#4DB6AC', shadow: '#309088' },
  yellow: { base: '#FFD54F', shadow: '#E0B830' },
})};
const ANIMAL_PALS = ${JSON.stringify({
  bear: { base: '#8B6544', shadow: '#6B4E30', accent: '#D4A574', nose: '#2C1810' },
  rabbit: { base: '#F5E6D3', shadow: '#E0CDB8', accent: '#FFB6C1', nose: '#FF9A9E' },
  tiger: { base: '#E8A040', shadow: '#C08030', accent: '#2C1810', nose: '#2C1810' },
  wolf: { base: '#8899AA', shadow: '#667788', accent: '#C0C8D0', nose: '#2C1810' },
  frog: { base: '#5A9E32', shadow: '#488028', accent: '#7BC74D', nose: '#488028' },
  husky: { base: '#7A8899', shadow: '#5A6877', accent: '#FFFFFF', nose: '#2C1810' },
  bichon: { base: '#FAFAFA', shadow: '#E8E0D8', accent: '#F0E8E0', nose: '#2C1810' },
  corgi: { base: '#D4A040', shadow: '#B08030', accent: '#FAFAFA', nose: '#2C1810' },
})};

// Visit state
let visitingId = null;
let visitGrid = null;
let visitProfile = null;
let waterRemaining = 3;

// Character animation state
let charMode = 'idle';
let charX = 210, charY = 80;
let charTargetX = 210, charTargetY = 80;
let charDir = 1;
let idleTimer = 0;
let walkTimer = 0;
let waterAnimFrame = 0;
let lastActivityFrame = -999;
let growFlashFrames = [];

// View mode (1st/3rd person)
let viewMode = 'third'; // 'first' | 'third'
const FP_ZOOM = 2.5;
let trackedGhostId = null;
const ghosts = new Map(); // id → { nickname, pos, target, facing, mode, idleTimer, opacity, color }
const ghostColors = ['#E57373','#81C784','#64B5F6','#FFB74D','#BA68C8','#4DB6AC','#F06292','#AED581'];
function ghostColor(id) { let h=0; for(let i=0;i<id.length;i++) h=((h<<5)-h+id.charCodeAt(i))|0; return ghostColors[Math.abs(h)%ghostColors.length]; }
let userListHitAreas = [];

// Camera state (zoom/pan) — per-canvas
const CAM_MIN_ZOOM = 1.0, CAM_MAX_ZOOM = 3.0, CAM_ZOOM_STEP = 0.25, CAM_LERP = 0.15;
function makeCam() { return { x:0, y:0, zoom:1, tx:0, ty:0, tz:1 }; }
const farmCam = makeCam();
const visitCam = makeCam();
let activeCam = farmCam;

function clampCam(c) {
  c.tz = Math.max(CAM_MIN_ZOOM, Math.min(CAM_MAX_ZOOM, Math.round(c.tz / CAM_ZOOM_STEP) * CAM_ZOOM_STEP));
  const minX = -(256 * (c.tz - 1));
  const minY = -(192 * (c.tz - 1));
  c.tx = Math.max(minX, Math.min(0, c.tx));
  c.ty = Math.max(minY, Math.min(0, c.ty));
}

function lerpCam(c) {
  const dx = c.tx - c.x, dy = c.ty - c.y, dz = c.tz - c.zoom;
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(dz) < 0.01) {
    c.x = c.tx; c.y = c.ty; c.zoom = c.tz;
  } else {
    c.x += dx * CAM_LERP; c.y += dy * CAM_LERP; c.zoom += dz * CAM_LERP;
  }
}

function screenToWorldVS(sx, sy, cvs, cam) {
  const rect = cvs.getBoundingClientRect();
  const scX = 256 / rect.width, scY = 192 / rect.height;
  return { x: (sx * scX - cam.x) / cam.zoom, y: (sy * scY - cam.y) / cam.zoom };
}

function zoomAtPointVS(sx, sy, delta, cvs, cam) {
  const rect = cvs.getBoundingClientRect();
  const scX = 256 / rect.width, scY = 192 / rect.height;
  const cx = sx * scX, cy = sy * scY;
  const wx = (cx - cam.x) / cam.zoom, wy = (cy - cam.y) / cam.zoom;
  cam.tz += delta;
  clampCam(cam);
  cam.tx = cx - wx * cam.tz;
  cam.ty = cy - wy * cam.tz;
  clampCam(cam);
}

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

// ── Tab switching ──
function switchTab(tab) {
  currentTab = tab;
  document.getElementById('farmTab').style.display = tab === 'farm' ? 'block' : 'none';
  document.getElementById('exploreTab').style.display = tab === 'explore' ? 'block' : 'none';
  document.getElementById('visitView').style.display = 'none';
  document.getElementById('tabFarm').className = 'tab-btn' + (tab === 'farm' ? ' active' : '');
  document.getElementById('tabExplore').className = 'tab-btn' + (tab === 'explore' ? ' active' : '');
  visitingId = null;
  if (tab === 'explore') {
    vscode.postMessage({ type: 'getBookmarks' });
  }
}

// ── Profile card HTML ──
function profileCardHtml(p) {
  const status = p.status_message && p.status_message.text
    ? '<div class="profile-status">💬 "' + escHtml(p.status_message.text) + '"</div>' : '';
  return '<div class="profile-card" onclick="openVisit(\\'' + escHtml(p.github_id) + '\\')">'
    + '<span class="profile-harvests">🌾 ' + (p.total_harvests||0) + '</span>'
    + '<span class="profile-name">🧑‍💻 ' + escHtml(p.nickname) + '</span>'
    + '<span class="profile-level">Lv.' + (p.level||1) + '</span>'
    + status + '</div>';
}

function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function renderProfileList(containerId, profiles) {
  const el = document.getElementById(containerId);
  if (!profiles || profiles.length === 0) {
    el.innerHTML = '<div class="empty-msg">${d.vscodeSearchNoResults}</div>';
  } else {
    el.innerHTML = profiles.filter(p => p.github_id !== myGithubId).map(profileCardHtml).join('');
  }
}

// ── Search ──
function doSearch() {
  const q = document.getElementById('searchInput').value.trim();
  if (q.length < 2) return;
  vscode.postMessage({ type: 'search', query: q });
}

// ── Random explore ──
function doExplore() {
  document.getElementById('exploreBtn').textContent = '🔄 ${d.vscodeSearching}';
  vscode.postMessage({ type: 'explore' });
}

// ── Farm Visit ──
function openVisit(targetId) {
  visitingId = targetId;
  visitGrid = null;
  visitProfile = null;
  waterRemaining = 3;
  document.getElementById('farmTab').style.display = 'none';
  document.getElementById('exploreTab').style.display = 'none';
  document.getElementById('visitView').style.display = 'block';
  document.getElementById('visitNickname').textContent = '...';
  document.getElementById('visitLevel').textContent = '';
  document.getElementById('visitStatus').textContent = '';
  document.getElementById('visitHarvests').textContent = '0';
  updateBookmarkBtn();
  vscode.postMessage({ type: 'visitFarm', targetId });
  vscode.postMessage({ type: 'fetchFarm', targetId });
}

function closeVisit() {
  visitingId = null;
  visitGrid = null;
  document.getElementById('visitView').style.display = 'none';
  document.getElementById('exploreTab').style.display = 'block';
  document.getElementById('tabExplore').className = 'tab-btn active';
  document.getElementById('tabFarm').className = 'tab-btn';
  currentTab = 'explore';
}

function doWater() {
  if (!visitingId || waterRemaining <= 0) return;
  vscode.postMessage({ type: 'water', targetId: visitingId });
}

function doToggleBookmark() {
  if (!visitingId) return;
  vscode.postMessage({ type: 'toggleBookmark', targetId: visitingId });
}

function updateBookmarkBtn() {
  const btn = document.getElementById('bookmarkBtn');
  const isBookmarked = bookmarkIds.includes(visitingId);
  btn.textContent = isBookmarked ? '⭐ ${d.vscodeVisitBookmarked}' : '☆ ${d.vscodeVisitBookmark}';
  btn.className = isBookmarked ? 'btn btn-primary' : 'btn';
}

function updateWaterBtn() {
  const btn = document.getElementById('waterBtn');
  if (waterRemaining <= 0) {
    btn.textContent = '💧 ${d.vscodeVisitWaterDone}';
    btn.disabled = true;
    btn.style.opacity = '0.5';
  } else {
    btn.textContent = '💧 ${d.vscodeVisitWater} (' + waterRemaining + '${d.vscodeVisitWaterRemaining})';
    btn.disabled = false;
    btn.style.opacity = '1';
  }
}

// ── Render farm (shared between own + visit) ──
function renderFarm(c, cx, grid, isDemo, cam) {
  frame++;
  cx.clearRect(0, 0, 256, 192);

  // 1인칭 모드: 캐릭터/고스트 추적
  if (cam && !isDemo && viewMode === 'first') {
    let tx = charX + 3, ty = charY + 6;
    if (trackedGhostId) {
      const g = ghosts.get(trackedGhostId);
      if (g) { tx = g.pos.x + 3; ty = g.pos.y + 6; }
    }
    cam.tz = FP_ZOOM;
    cam.tx = 128 - tx * FP_ZOOM;
    cam.ty = 96 - ty * FP_ZOOM;
    clampCam(cam);
  }

  // Camera transform
  if (cam) { lerpCam(cam); }
  const _cam = cam || { x:0, y:0, zoom:1 };
  cx.save();
  cx.translate(_cam.x, _cam.y);
  cx.scale(_cam.zoom, _cam.zoom);

  const hour = new Date().getHours();
  let skyTop, skyBot;
  if (hour>=6&&hour<11){skyTop='#FFF3E0';skyBot='#FFCCBC';}
  else if(hour>=11&&hour<17){skyTop='#B3E5FC';skyBot='#E1F5FE';}
  else if(hour>=17&&hour<21){skyTop='#F48FB1';skyBot='#FFE082';}
  else{skyTop='#0D1B2A';skyBot='#1B2838';}
  const grad=cx.createLinearGradient(0,0,0,48);
  grad.addColorStop(0,skyTop);grad.addColorStop(1,skyBot);
  cx.fillStyle=grad;cx.fillRect(0,0,256,48);

  if(hour>=21||hour<6){
    cx.fillStyle='#FFFFFF';
    for(let i=0;i<15;i++){
      if(frame%60<40||i%3!==0) cx.fillRect((i*17+5)%256,(i*11+3)%45,1,1);
    }
  }

  cx.fillStyle='#7BC74D';cx.fillRect(0,48,256,144);
  cx.fillStyle='#5A9E32';
  for(let x=0;x<256;x+=7)for(let y=48;y<192;y+=5)cx.fillRect(x+(y*3%5),y,1,1);

  // 잔디 장식: 꽃, 돌
  const flowerData=[
    {x:12,y:68,c:'#FF6B81'},{x:28,y:88,c:'#FACC15'},{x:8,y:118,c:'#FF9A9E'},
    {x:38,y:103,c:'#FFFFFF'},{x:20,y:138,c:'#a78bfa'},
    {x:205,y:73,c:'#FACC15'},{x:225,y:98,c:'#FF6B81'},{x:213,y:123,c:'#FFFFFF'},
    {x:235,y:83,c:'#a78bfa'},{x:203,y:148,c:'#FF9A9E'}
  ];
  for(const f of flowerData){
    cx.fillStyle='#5A9E32';cx.fillRect(f.x,f.y+1,1,2);
    cx.fillStyle=f.c;cx.fillRect(f.x-1,f.y,1,1);cx.fillRect(f.x,f.y,1,1);cx.fillRect(f.x+1,f.y,1,1);
    if(Math.sin(frame*0.05+f.x)>0.7) cx.fillRect(f.x+1,f.y-1,1,1);
  }
  const stoneData=[{x:45,y:63},{x:15,y:153},{x:230,y:63},{x:217,y:138}];
  for(const s of stoneData){
    cx.fillStyle='#9ca3af';cx.fillRect(s.x,s.y,3,2);
    cx.fillStyle='#6b7280';cx.fillRect(s.x+1,s.y+1,1,1);
  }

  // 울타리
  const fX=58,fY=52,fW=140,fH=104;
  cx.fillStyle='#A0724A';
  cx.fillRect(fX+1,fY+1,fW-2,1);cx.fillRect(fX+1,fY+3,fW-2,1);
  cx.fillRect(fX+1,fY+fH-2,fW-2,1);cx.fillRect(fX+1,fY+fH-4,fW-2,1);
  cx.fillRect(fX+1,fY+1,1,fH-2);cx.fillRect(fX+3,fY+1,1,fH-2);
  cx.fillRect(fX+fW-2,fY+1,1,fH-2);cx.fillRect(fX+fW-4,fY+1,1,fH-2);
  cx.fillStyle='#8B6914';
  const fPosts=[[fX,fY],[fX+fW-2,fY],[fX,fY+fH-2],[fX+fW-2,fY+fH-2],
    [fX+fW/2,fY],[fX+fW/2,fY+fH-2],[fX,fY+fH/2],[fX+fW-2,fY+fH/2]];
  for(const[px,py] of fPosts) cx.fillRect(px,py,2,5);
  // 흙길
  cx.fillStyle='#C4A97D';cx.fillRect(122,fY+fH,12,6);
  cx.fillStyle='#B8956E';cx.fillRect(124,fY+fH+2,2,1);cx.fillRect(129,fY+fH+4,2,1);

  cx.fillStyle='#8B6914';cx.fillRect(62,54,132,100);
  cx.fillStyle='#6B4E0A';
  for(let x=62;x<194;x+=4)for(let y=54;y<154;y+=4)cx.fillRect(x+(y*2%3),y+(x%2),1,1);

  cx.fillStyle='#6B4E0A';
  for(let i=0;i<=4;i++){cx.fillRect(64+i*32-1,54,1,100);cx.fillRect(62,56+i*24-1,132,1);}

  if(grid){
    for(let i=0;i<grid.length&&i<${GRID_SIZE};i++){
      const slot=grid[i]; if(!slot)continue;
      const row=Math.floor(i/${GRID_COLS}),col=i%${GRID_COLS};
      const bx=72+col*32,by=60+row*24;
      const stage=slot.stage;
      const color=cropColors[slot.crop]||'#7BC74D';

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

      if(flashing){
        cx.fillStyle='rgba(255,255,255,'+(0.3+0.3*Math.sin(frame*0.5))+')';
        cx.fillRect(bx+2,by+4,12,14);
      }
    }
  }

  if(!isDemo) {
    updateGhosts();
    drawGhosts(cx);
    updateCharacter();
    drawCharacter(cx);
  } else {
    const bounce=frame%40<20?0:-1;
    drawCharPixels(cx, 210, 80+bounce, 1, null);
    if(frame%120<80){
      cx.fillStyle='rgba(255,255,255,0.5)';
      cx.font='5px monospace';
      const zOff=Math.sin(frame*0.05)*2;
      cx.fillText('z',218,76+zOff);
      cx.fillText('z',221,73+zOff);
    }
  }

  cx.restore(); // End camera transform

  // HUD (zoom-independent)
  if (!isDemo) {
    drawUserIconSidebar(cx);
    drawBottomInfoPanelVS(cx);
  }
}

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
    idleTimer++;
    if (sinceActivity < 300 && idleTimer > 80 + Math.random()*120 && farmState) {
      const occupiedSlots = [];
      for (let i=0;i<farmState.length;i++) if(farmState[i]) occupiedSlots.push(i);
      if (occupiedSlots.length > 0) {
        const slot = occupiedSlots[Math.floor(Math.random()*occupiedSlots.length)];
        const row=Math.floor(slot/${GRID_COLS}),col=slot%${GRID_COLS};
        charTargetX = 72+col*32+Math.random()*8;
        charTargetY = 60+row*24;
        charMode = 'walk';
        walkTimer = 0;
        if (Math.random() < 0.3) waterAnimFrame = 30;
      }
    }
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

  if (statusMsg && sinceActivity > 200) {
    drawPixelSpeechBubbleVS(cx, px+3, py-2, statusMsg);
  }

  if (charMode === 'idle') {
    const bounce = frame%40<20?0:-1;
    drawCharPixels(cx, px, py+bounce, charDir, myCharacter);
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
    const bob = walkTimer%12<6?0:-1;
    drawCharPixels(cx, px, py+bob, charDir, myCharacter);
    if(walkTimer%8===0){
      cx.fillStyle='rgba(90,158,50,0.5)';
      cx.fillRect(px+2,py+12,2,1);
    }
  } else if (charMode === 'water') {
    drawCharPixels(cx, px, py, charDir, myCharacter);
    const wf = 30-waterAnimFrame;
    cx.fillStyle='#60A5FA';
    for(let i=0;i<3;i++){
      const wx=px+charDir*8+i*2;
      const wy=py+4+wf*0.3+Math.sin(wf*0.3+i)*2;
      cx.fillRect(wx,wy,1,2);
    }
  }
}

function drawCharPixels(cx, x, y, dir, appearance) {
  const a = appearance || {type:'human',hairColor:'brown',skinTone:'light',clothesColor:'blue',eyeStyle:'dot'};
  const clothes = (CHAR_CLOTHES_COLORS[a.clothesColor]||CHAR_CLOTHES_COLORS.blue);
  // Body (shared)
  cx.fillStyle=clothes.base; cx.fillRect(x,y+6,6,4);
  cx.fillStyle='#5B7A9E'; cx.fillRect(x+1,y+10,2,2); cx.fillRect(x+3,y+10,2,2);
  // Head
  if (a.type==='human') {
    const hair=(CHAR_HAIR_COLORS[a.hairColor]||CHAR_HAIR_COLORS.brown);
    const skin=(CHAR_SKIN_TONES[a.skinTone]||CHAR_SKIN_TONES.light);
    cx.fillStyle=hair.base; cx.fillRect(x,y,6,3);
    cx.fillStyle=skin.base; cx.fillRect(x+1,y+3,4,3);
    cx.fillStyle='#3E2723';
    if(dir>0){cx.fillRect(x+2,y+4,1,1);cx.fillRect(x+4,y+4,1,1);}
    else{cx.fillRect(x+1,y+4,1,1);cx.fillRect(x+3,y+4,1,1);}
  } else {
    const pal=ANIMAL_PALS[a.type]||ANIMAL_PALS.bear;
    drawAnimalHeadVS(cx, x, y, a.type, pal, dir);
  }
}

function drawAnimalHeadVS(cx, x, y, type, pal, dir) {
  // Base head
  cx.fillStyle=pal.base; cx.fillRect(x,y+1,6,5);
  // Eyes
  cx.fillStyle='#3E2723';
  if(dir>0){cx.fillRect(x+2,y+3,1,1);cx.fillRect(x+4,y+3,1,1);}
  else{cx.fillRect(x+1,y+3,1,1);cx.fillRect(x+3,y+3,1,1);}
  // Nose/snout
  cx.fillStyle=pal.accent||pal.base;
  cx.fillRect(x+2,y+4,2,1);
  cx.fillStyle=pal.nose; cx.fillRect(x+3,y+4,1,1);
  // Ears by type
  cx.fillStyle=pal.base;
  if(type==='bear'||type==='tiger'){cx.fillRect(x,y,2,2);cx.fillRect(x+4,y,2,2);}
  else if(type==='rabbit'){cx.fillRect(x+1,y-2,1,3);cx.fillRect(x+4,y-2,1,3);cx.fillStyle=pal.accent;cx.fillRect(x+1,y-1,1,2);cx.fillRect(x+4,y-1,1,2);}
  else if(type==='wolf'||type==='husky'){cx.fillRect(x,y-1,2,2);cx.fillRect(x+4,y-1,2,2);}
  else if(type==='frog'){cx.fillStyle=pal.accent;cx.fillRect(x+1,y,1,1);cx.fillRect(x+4,y,1,1);}
  else if(type==='bichon'){cx.fillRect(x-1,y,2,3);cx.fillRect(x+5,y,2,3);}
  else if(type==='corgi'){cx.fillRect(x,y-1,2,3);cx.fillRect(x+4,y-1,2,3);cx.fillStyle=pal.accent;cx.fillRect(x+1,y+2,4,3);}
  // Tiger stripes
  if(type==='tiger'){cx.fillStyle=pal.accent;cx.fillRect(x,y+2,1,1);cx.fillRect(x+5,y+2,1,1);cx.fillRect(x+1,y+1,1,1);cx.fillRect(x+4,y+1,1,1);}
  // Husky face mask
  if(type==='husky'){cx.fillStyle=pal.accent;cx.fillRect(x+2,y+2,2,4);}
}

function drawGhostPixels(cx, x, y, clothesColor, appearance) {
  // Use appearance if available, else fallback to color-only mode
  if (appearance && appearance.type && appearance.type !== 'human') {
    const pal = ANIMAL_PALS[appearance.type] || ANIMAL_PALS.bear;
    cx.fillStyle=pal.base; cx.fillRect(x,y,6,3);
    cx.fillStyle=pal.base; cx.fillRect(x+1,y+3,4,3);
    cx.fillStyle='#3E2723'; cx.fillRect(x+2,y+4,1,1); cx.fillRect(x+4,y+4,1,1);
  } else {
    const hair = appearance ? (CHAR_HAIR_COLORS[appearance.hairColor]||CHAR_HAIR_COLORS.brown) : {base:'#7A5230'};
    cx.fillStyle=hair.base; cx.fillRect(x,y,6,3);
    const skin = appearance ? (CHAR_SKIN_TONES[appearance.skinTone]||CHAR_SKIN_TONES.light) : {base:'#FFD5B8'};
    cx.fillStyle=skin.base; cx.fillRect(x+1,y+3,4,3);
    cx.fillStyle='#3E2723'; cx.fillRect(x+2,y+4,1,1); cx.fillRect(x+4,y+4,1,1);
  }
  const cc = appearance ? (CHAR_CLOTHES_COLORS[appearance.clothesColor]||CHAR_CLOTHES_COLORS.blue).base : clothesColor;
  cx.fillStyle=cc; cx.fillRect(x,y+6,6,4);
  cx.fillStyle='#5B7A9E'; cx.fillRect(x+1,y+10,2,2); cx.fillRect(x+3,y+10,2,2);
}

function updateGhosts() {
  for (const [,g] of ghosts) {
    if (g.mode === 'walk') {
      const dx=g.target.x-g.pos.x, dy=g.target.y-g.pos.y;
      const dist=Math.sqrt(dx*dx+dy*dy);
      if (dist < 1) { g.pos.x=g.target.x; g.pos.y=g.target.y; g.mode='idle'; g.idleTimer=0; }
      else {
        g.pos.x+=(dx/dist)*0.35; g.pos.y+=(dy/dist)*0.35;
        if(dx>0.3) g.facing='right'; else if(dx<-0.3) g.facing='left';
      }
    } else {
      g.idleTimer++;
      if (g.idleTimer > 100+Math.abs(g.pos.x*7)%120) {
        g.target={x:8+Math.abs(Math.sin(frame*0.01+g.pos.x)*0.5+0.5)*236, y:56+Math.abs(Math.cos(frame*0.01+g.pos.y)*0.5+0.5)*120};
        g.mode='walk';
      }
    }
  }
}

function drawGhosts(cx) {
  for (const [id,g] of ghosts) {
    const px=Math.round(g.pos.x), py=Math.round(g.pos.y);
    const bounce = g.mode==='walk' ? (frame%10<5?-1:0) : (frame%50<25?0:-1);
    const isTracked = trackedGhostId === id;
    cx.globalAlpha = isTracked ? Math.min(g.opacity*1.5, 0.9) : g.opacity;
    if (g.facing==='left') {
      cx.save(); cx.translate(px+6, py+bounce); cx.scale(-1,1);
      drawGhostPixels(cx, 0, 0, g.color, g.character); cx.restore();
    } else { drawGhostPixels(cx, px, py+bounce, g.color, g.character); }
    if (isTracked) {
      cx.globalAlpha=0.9;
      // 닉네임은 하단 패널에 표시, 여기서는 심플하게
      cx.fillStyle='rgba(0,0,0,0.6)';
      const tw=Math.min(g.nickname.length*3+6,50);
      cx.fillRect(px-tw/2+3,py-8,tw,6);
      cx.fillStyle='#FFFFFF'; cx.font='4px monospace'; cx.textAlign='center';
      cx.fillText(g.nickname.slice(0,12),px+3,py-3); cx.textAlign='start';
    }
    if (g.watered) {
      cx.globalAlpha=g.opacity; cx.fillStyle='#64B5F6';
      cx.fillRect(px+7,py-3,1,2); cx.fillRect(px+6,py-1,3,1);
    }
    cx.globalAlpha=1;
  }
}

function drawMiniPortraitVS(cx, x, y, color, isOwner, appearance) {
  // 6×8px mini character
  const clothes = appearance ? (CHAR_CLOTHES_COLORS[appearance.clothesColor]||CHAR_CLOTHES_COLORS.blue).base : color;
  if (appearance && appearance.type && appearance.type !== 'human') {
    const pal = ANIMAL_PALS[appearance.type] || ANIMAL_PALS.bear;
    cx.fillStyle=pal.base; cx.fillRect(x+1,y,4,2);
    cx.fillStyle=pal.base; cx.fillRect(x+1,y+2,4,2);
    cx.fillStyle='#3E2723'; cx.fillRect(x+2,y+3,1,1); cx.fillRect(x+3,y+3,1,1);
  } else {
    const hair = appearance ? (CHAR_HAIR_COLORS[appearance.hairColor]||CHAR_HAIR_COLORS.brown) : {base: isOwner ? '#5C3A1E' : '#7A5230'};
    cx.fillStyle=hair.base; cx.fillRect(x+1,y,4,2);
    const skin = appearance ? (CHAR_SKIN_TONES[appearance.skinTone]||CHAR_SKIN_TONES.light) : {base:'#FFD5B8'};
    cx.fillStyle=skin.base; cx.fillRect(x+1,y+2,4,2);
    cx.fillStyle='#3E2723'; cx.fillRect(x+2,y+3,1,1); cx.fillRect(x+3,y+3,1,1);
  }
  cx.fillStyle=clothes; cx.fillRect(x,y+4,6,3);
  cx.fillStyle='#5B7A9E'; cx.fillRect(x+1,y+7,2,1); cx.fillRect(x+3,y+7,2,1);
}

let overflowHitArea = null;

function drawUserIconSidebar(cx) {
  const iconSize = 10;
  const gap = 2;
  const maxVisible = 4;
  const sideX = 2;
  let y = 3;

  userListHitAreas = [];
  overflowHitArea = null;

  // ME icon
  const meTracked = viewMode === 'first' && !trackedGhostId;
  // Border
  cx.fillStyle = meTracked ? '#fbbf24' : '#9ca3af';
  cx.fillRect(sideX, y, iconSize, iconSize);
  // Inner bg
  cx.fillStyle = 'rgba(0,0,0,0.5)';
  cx.fillRect(sideX+1, y+1, iconSize-2, iconSize-2);
  drawMiniPortraitVS(cx, sideX+2, y+1, '#6C9BD2', true, myCharacter);
  userListHitAreas.push({id:'__me__', x:sideX, y, w:iconSize, h:iconSize});
  y += iconSize + gap;

  // Ghost icons
  const entries = Array.from(ghosts.entries());
  const visCount = Math.min(entries.length, maxVisible);
  for (let i = 0; i < visCount; i++) {
    const [id, g] = entries[i];
    const isT = trackedGhostId === id;
    cx.fillStyle = isT ? '#fbbf24' : '#555';
    cx.fillRect(sideX, y, iconSize, iconSize);
    cx.fillStyle = 'rgba(0,0,0,0.5)';
    cx.fillRect(sideX+1, y+1, iconSize-2, iconSize-2);
    drawMiniPortraitVS(cx, sideX+2, y+1, g.color, false, g.character);
    if (g.watered) {
      cx.fillStyle = '#64B5F6';
      cx.fillRect(sideX+iconSize-3, y+1, 2, 2);
    }
    userListHitAreas.push({id, x:sideX, y, w:iconSize, h:iconSize});
    y += iconSize + gap;
  }

  // Overflow "+N"
  if (entries.length > maxVisible) {
    const remaining = entries.length - maxVisible;
    cx.fillStyle = 'rgba(0,0,0,0.5)';
    cx.fillRect(sideX, y, iconSize, iconSize);
    cx.fillStyle = 'rgba(255,255,255,0.1)';
    cx.fillRect(sideX, y, iconSize, iconSize);
    cx.fillStyle = '#9ca3af';
    cx.font = '4px monospace';
    cx.textAlign = 'center';
    cx.fillText('+'+remaining, sideX + iconSize/2, y + 7);
    cx.textAlign = 'start';
    overflowHitArea = {x:sideX, y, w:iconSize, h:iconSize, remaining};
    y += iconSize + gap;
  }
}

function drawBottomInfoPanelVS(cx) {
  if (viewMode !== 'first') return;

  let nickname = '';
  let level = 0;

  if (!trackedGhostId) {
    // own info — we don't have full profile data in VSCode, just show basics
    return; // skip for own character in VSCode (info is shown in HTML)
  } else {
    const ghost = ghosts.get(trackedGhostId);
    if (ghost) {
      nickname = ghost.nickname;
    }
  }

  if (!nickname) return;

  const panelW = 100;
  const panelH = 12;
  const panelX = (256 - panelW) / 2;
  const panelY = 192 - panelH - 4;

  cx.fillStyle = 'rgba(0,0,0,0.6)';
  cx.fillRect(panelX, panelY, panelW, panelH);
  cx.fillStyle = 'rgba(255,255,255,0.15)';
  cx.fillRect(panelX, panelY, panelW, 1);
  cx.fillRect(panelX, panelY+panelH-1, panelW, 1);
  cx.fillRect(panelX, panelY, 1, panelH);
  cx.fillRect(panelX+panelW-1, panelY, 1, panelH);

  cx.font = '4px monospace';
  cx.fillStyle = '#FFFFFF';
  const displayName = nickname.length > 16 ? nickname.slice(0,15)+'…' : nickname;
  cx.fillText(displayName, panelX+3, panelY+8);
}

function drawPixelSpeechBubbleVS(cx, x, y, text) {
  const maxChars = 24;
  const displayText = text.length > maxChars ? text.slice(0, maxChars-1)+'…' : text;
  cx.font = '4px monospace';
  const textW = Math.min(cx.measureText(displayText).width, 80);
  const padX = 4, padY = 3;
  const bubbleW = Math.ceil(textW) + padX*2;
  const bubbleH = 8 + padY;
  const bx = Math.round(x - bubbleW/2);
  const by = y - bubbleH - 4;

  const borderColor = '#5B4A3A';
  const bgColor = '#FFFBE6';

  // Background (rounded with stepped corners)
  cx.fillStyle = bgColor;
  cx.fillRect(bx+2, by, bubbleW-4, bubbleH);
  cx.fillRect(bx+1, by+1, bubbleW-2, bubbleH-2);
  cx.fillRect(bx, by+2, bubbleW, bubbleH-4);

  // Border
  cx.fillStyle = borderColor;
  cx.fillRect(bx+2, by-1, bubbleW-4, 1);
  cx.fillRect(bx+2, by+bubbleH, bubbleW-4, 1);
  cx.fillRect(bx-1, by+2, 1, bubbleH-4);
  cx.fillRect(bx+bubbleW, by+2, 1, bubbleH-4);
  // Stepped corners
  cx.fillRect(bx+1,by,1,1); cx.fillRect(bx,by+1,1,1);
  cx.fillRect(bx+bubbleW-2,by,1,1); cx.fillRect(bx+bubbleW-1,by+1,1,1);
  cx.fillRect(bx+1,by+bubbleH-1,1,1); cx.fillRect(bx,by+bubbleH-2,1,1);
  cx.fillRect(bx+bubbleW-2,by+bubbleH-1,1,1); cx.fillRect(bx+bubbleW-1,by+bubbleH-2,1,1);

  // Tail
  const tailX = Math.round(x);
  const tailY = by + bubbleH + 1;
  cx.fillStyle = bgColor;
  cx.fillRect(tailX-1, tailY, 3, 1);
  cx.fillRect(tailX, tailY+1, 1, 1);
  cx.fillStyle = borderColor;
  cx.fillRect(tailX-2, tailY, 1, 1);
  cx.fillRect(tailX+2, tailY, 1, 1);
  cx.fillRect(tailX-1, tailY+1, 1, 1);
  cx.fillRect(tailX+1, tailY+1, 1, 1);
  cx.fillRect(tailX, tailY+2, 1, 1);

  // Text
  cx.fillStyle = '#3E2723';
  cx.font = '4px monospace';
  cx.fillText(displayText, bx+padX, by+padY+4);
}

function hitTestUserListVS(sx,sy,cvs) {
  const rect=cvs.getBoundingClientRect();
  const cx=sx*256/rect.width, cy=sy*192/rect.height;
  for(const a of userListHitAreas) {
    if(cx>=a.x&&cx<=a.x+a.w&&cy>=a.y&&cy<=a.y+a.h) return {type:'user',id:a.id};
  }
  if(overflowHitArea){
    const o=overflowHitArea;
    if(cx>=o.x&&cx<=o.x+o.w&&cy>=o.y&&cy<=o.y+o.h) return {type:'overflow'};
  }
  return null;
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
  statusLink=data.statusLink;
  myGithubId=data.githubId;
  myCharacter=data.character||null;
  if (data.bookmarkIds) bookmarkIds = data.bookmarkIds;

  // 방문자 → 고스트 동기화
  if (data.visitors && data.visitors.length > 0) {
    const activeIds = new Set();
    for (const fp of data.visitors) {
      const ha = (Date.now()-new Date(fp.visited_at).getTime())/(1000*60*60);
      if (ha > 24) continue;
      const id = fp.github_id;
      activeIds.add(id);
      if (!ghosts.has(id)) {
        // 결정론적 초기 위치
        let hash=0; const s=id+(data.githubId||'');
        for(let i=0;i<s.length;i++) hash=((hash<<5)-hash+s.charCodeAt(i))|0;
        const ah=Math.abs(hash);
        const side=ah%2;
        const gx=side===0?(ah>>1)%56:(194+2+((ah>>1)%56));
        const gy=56+((ah>>8)%130);
        ghosts.set(id, {
          nickname:fp.nickname, pos:{x:gx,y:gy}, target:{x:gx,y:gy},
          facing:ah%2===0?'right':'left', mode:'idle', idleTimer:Math.floor(Math.random()*80),
          opacity:Math.max(0.15,1-ha/24)*0.6, watered:fp.watered||false, color:ghostColor(id)
        });
      }
    }
    for(const id of ghosts.keys()) { if(!activeIds.has(id)){ghosts.delete(id);if(trackedGhostId===id)trackedGhostId=null;} }
  }

  const sd=document.getElementById('statusDisplay');
  if(data.statusMessage){
    sd.textContent='💬 "'+data.statusMessage+'"';
    sd.style.display='block';
    sd.style.opacity='0.8';
  } else {
    sd.textContent='💬 ${locale === 'ko' ? '말풍선을 설정해보세요' : 'Set a status message'}';
    sd.style.opacity='0.4';
    sd.style.display='block';
  }

  const pct=Math.round(data.uniqueItems/data.totalItems*100);
  const ps=document.getElementById('progressSection');
  const pf=document.getElementById('progressFill');
  const pl=document.getElementById('progressLabel');
  ps.style.display='block';
  pf.style.width=pct+'%';
  pl.textContent='${locale === 'ko' ? '도감 진행률' : 'Codex'} '+pct+'%';
}

function toggleStatusEdit(){
  editingStatus=!editingStatus;
  const el=document.getElementById('statusEdit');
  el.style.display=editingStatus?'flex':'none';
  if(editingStatus){
    const inp=document.getElementById('statusInput');
    inp.value=statusMsg||'';
    const linkInp=document.getElementById('linkInput');
    linkInp.value=statusLink||'';
    inp.focus();
  }
}
function saveStatus(){
  const inp=document.getElementById('statusInput');
  const linkInp=document.getElementById('linkInput');
  const text=inp.value.trim();
  const link=linkInp.value.trim();
  vscode.postMessage({type:'setStatus',text,link});
  editingStatus=false;
  document.getElementById('statusEdit').style.display='none';
}

function showNotif(msg){
  const area=document.getElementById('notifArea');
  const el=document.createElement('div');
  el.className='notif-item';
  el.textContent=msg;
  area.appendChild(el);
  setTimeout(()=>{el.classList.add('out');setTimeout(()=>el.remove(),300);},3000);
}

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
    lastActivityFrame=frame;
    if(charMode==='idle'){
      if(farmState){
        const occupied=[];
        for(let i=0;i<farmState.length;i++)if(farmState[i])occupied.push(i);
        if(occupied.length>0){
          const slot=occupied[Math.floor(Math.random()*occupied.length)];
          const row=Math.floor(slot/${GRID_COLS}),col=slot%${GRID_COLS};
          charTargetX=72+col*32+Math.random()*8;
          charTargetY=60+row*24;
          charMode='walk';walkTimer=0;
          if(Math.random()<0.5)waterAnimFrame=30;
        }
      }
    }
    if(farmState){
      for(let i=0;i<farmState.length;i++){
        if(farmState[i]&&farmState[i].stage>0&&farmState[i].stage<3){
          growFlashFrames.push({slot:i,frame:frame});
        }
      }
    }
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
  } else if(msg.type==='exploreResult'){
    document.getElementById('exploreBtn').textContent='🎲 ${d.vscodeRandomVisit}';
    document.getElementById('randomSection').style.display='block';
    renderProfileList('randomList', msg.profiles);
  } else if(msg.type==='searchResult'){
    document.getElementById('searchResultsSection').style.display='block';
    renderProfileList('searchResultsList', msg.profiles);
  } else if(msg.type==='bookmarksResult'){
    bookmarkIds = msg.bookmarkIds || [];
    const el = document.getElementById('bookmarksList');
    if (!msg.profiles || msg.profiles.length === 0) {
      el.innerHTML = '<div class="empty-msg">${d.vscodeNoNeighbors.replace(/\n/g, '<br>')}</div>';
    } else {
      el.innerHTML = msg.profiles.map(profileCardHtml).join('');
    }
  } else if(msg.type==='farmResult'){
    if(msg.profile) {
      visitProfile = msg.profile;
      visitGrid = msg.profile.farm_snapshot ? msg.profile.farm_snapshot.grid : null;
      document.getElementById('visitNickname').textContent = msg.profile.nickname;
      document.getElementById('visitLevel').textContent = '${d.vscodeVisitLevel}' + (msg.profile.level||1);
      document.getElementById('visitHarvests').textContent = msg.profile.total_harvests||0;
      const st = msg.profile.status_message && msg.profile.status_message.text;
      document.getElementById('visitStatus').textContent = st ? '💬 "'+st+'"' : '';
      updateWaterBtn();
      updateBookmarkBtn();
    }
  } else if(msg.type==='waterResult'){
    if(msg.ok) {
      waterRemaining = typeof msg.remaining === 'number' ? msg.remaining : Math.max(0, waterRemaining-1);
      updateWaterBtn();
      showNotif('💧 ${locale === 'ko' ? '물을 줬어요!' : 'Watered!'}');
    } else {
      waterRemaining = 0;
      updateWaterBtn();
    }
  } else if(msg.type==='bookmarkToggled'){
    bookmarkIds = msg.bookmarkIds || [];
    updateBookmarkBtn();
  }
});

setInterval(()=>{growFlashFrames=growFlashFrames.filter(f=>frame-f.frame<20);},1000);

// Render loop
setInterval(()=>{
  if(initialized && currentTab === 'farm' && ctx && farmState){
    renderFarm(canvas,ctx,farmState,false,farmCam);
  } else if(!initialized && demoCtx){
    renderFarm(demoCanvas,demoCtx,demoCrops,true,null);
  }
  // Visit canvas rendering
  if(visitingId && visitCtx && visitGrid){
    renderFarm(visitCanvas,visitCtx,visitGrid,true,visitCam);
  }
},80);

// ── Canvas interaction: drag pan + click-to-move + pinch zoom + double-click reset ──
function setupCanvasInteraction(cvs, isOwn, cam) {
  if (!cvs || !cam) return;
  let dragState = null;
  let pinchState = null;
  const DRAG_THRESH = 3;

  cvs.addEventListener('pointerdown', (e) => {
    if (pinchState) return;
    dragState = { startX: e.clientX, startY: e.clientY, camX: cam.tx, camY: cam.ty, moved: false };
    cvs.setPointerCapture(e.pointerId);
  });

  cvs.addEventListener('pointermove', (e) => {
    if (!dragState) return;
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    if (Math.abs(dx) > DRAG_THRESH || Math.abs(dy) > DRAG_THRESH) dragState.moved = true;
    if (dragState.moved) {
      // 1인칭 모드에서 드래그 시 3인칭으로 전환
      if (isOwn && viewMode === 'first') {
        viewMode = 'third';
        const btn = document.getElementById('viewModeBtn');
        if (btn) btn.textContent = '👁';
      }
      const rect = cvs.getBoundingClientRect();
      const scX = 256 / rect.width, scY = 192 / rect.height;
      cam.tx = dragState.camX + dx * scX;
      cam.ty = dragState.camY + dy * scY;
      clampCam(cam);
    }
  });

  cvs.addEventListener('pointerup', (e) => {
    if (!dragState) return;
    if (!dragState.moved) {
      const rect = cvs.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      // 유저 아이콘 사이드바 클릭 체크
      const hit = hitTestUserListVS(sx, sy, cvs);
      if (hit) {
        if (hit.type === 'user' && hit.id) {
          if (hit.id === '__me__') { trackedGhostId = null; viewMode = 'first'; }
          else if (ghosts.has(hit.id)) { trackedGhostId = hit.id; viewMode = 'first'; }
          const btn = document.getElementById('viewModeBtn');
          if (btn) btn.textContent = '🗺';
        }
        dragState = null; return;
      }
      // 캐릭터 이동
      if (isOwn) {
        const w = screenToWorldVS(sx, sy, cvs, cam);
        charTargetX = Math.max(0, Math.min(240, w.x - 3));
        charTargetY = Math.max(48, Math.min(180, w.y - 6));
        charMode = 'walk'; walkTimer = 0;
      }
    }
    dragState = null;
  });

  cvs.addEventListener('dblclick', () => {
    cam.tx = 0; cam.ty = 0; cam.tz = 1.0;
  });

  // Pinch zoom
  const getTouchDist = (t1, t2) => Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
  cvs.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      dragState = null;
      const d = getTouchDist(e.touches[0], e.touches[1]);
      if (d < 10) return; // zero-distance guard
      pinchState = { dist: d, zoom: cam.tz };
    }
  }, { passive: false });

  cvs.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && pinchState) {
      e.preventDefault();
      const dist = getTouchDist(e.touches[0], e.touches[1]);
      const ratio = dist / pinchState.dist;
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const rect = cvs.getBoundingClientRect();
      const delta = pinchState.zoom * ratio - cam.tz;
      zoomAtPointVS(cx - rect.left, cy - rect.top, delta, cvs, cam);
    }
  }, { passive: false });

  cvs.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) pinchState = null;
  });

  // Mouse wheel zoom
  cvs.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = cvs.getBoundingClientRect();
    const delta = e.deltaY > 0 ? -0.25 : 0.25;
    zoomAtPointVS(e.clientX - rect.left, e.clientY - rect.top, delta, cvs, cam);
  }, { passive: false });
}

function toggleViewMode() {
  if (viewMode === 'third') {
    viewMode = 'first';
    trackedGhostId = null;
    document.getElementById('viewModeBtn').textContent = '🗺';
  } else {
    viewMode = 'third';
    trackedGhostId = null;
    farmCam.tx = 0; farmCam.ty = 0; farmCam.tz = 1.0;
    document.getElementById('viewModeBtn').textContent = '👁';
  }
}

if (canvas) setupCanvasInteraction(canvas, true, farmCam);
if (visitCanvas) setupCanvasInteraction(visitCanvas, false, visitCam);

// 작은 화면 자동 줌 (사이드바 폭 < 400px)
function autoZoomSmallScreen(cam) {
  const w = document.documentElement.clientWidth || 400;
  if (w >= 400) return;
  const zoom = 1.5;
  const gx = 64 + 2*32, gy = 56 + 2*24;
  cam.x = cam.tx = 128 - gx * zoom;
  cam.y = cam.ty = 96 - gy * zoom;
  cam.zoom = cam.tz = zoom;
  clampCam(cam);
  cam.x = cam.tx; cam.y = cam.ty; cam.zoom = cam.tz;
}
autoZoomSmallScreen(farmCam);

vscode.postMessage({type:'ready'});
</script>
</body>
</html>`;
  }
}
