import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { LocalState } from '@claude-farmer/shared';
import { DATA_DIR, STATE_FILE, GRID_SIZE } from '@claude-farmer/shared';

const dataPath = join(homedir(), DATA_DIR);
const statePath = join(dataPath, STATE_FILE);

export async function ensureDataDir(): Promise<void> {
  if (!existsSync(dataPath)) {
    await mkdir(dataPath, { recursive: true });
  }
}

export function getDataPath(): string {
  return dataPath;
}

export function stateExists(): boolean {
  return existsSync(statePath);
}

export async function loadState(): Promise<LocalState> {
  try {
    const raw = await readFile(statePath, 'utf-8');
    return JSON.parse(raw) as LocalState;
  } catch {
    throw new Error(
      `Failed to read ${statePath}. File may be corrupted.\n` +
      `Try: rm "${statePath}" and run "claude-farmer init" again.`
    );
  }
}

export async function saveState(state: LocalState): Promise<void> {
  await ensureDataDir();
  await writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8');
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function createDefaultState(githubId: string, nickname: string, avatarUrl: string): LocalState {
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

export async function withState(fn: (state: LocalState) => LocalState | Promise<LocalState>): Promise<LocalState> {
  const state = await loadState();
  // 날짜 변경 시 daily 리셋
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
  const updated = await fn(state);
  await saveState(updated);
  return updated;
}
