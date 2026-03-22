import type { LocalState, FarmNotifications } from '@claude-farmer/shared';

const BASE_URL = 'https://claudefarmer.com';

export async function syncToServer(state: LocalState): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/farm/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        github_id: state.user.github_id,
        nickname: state.user.nickname,
        avatar_url: state.user.avatar_url,
        level: state.farm.level,
        total_harvests: state.farm.total_harvests,
        status_message: state.status_message,
        farm: state.farm,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function sendWater(from: string, to: string): Promise<{ ok: boolean; remaining?: number; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/api/water`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to }), // 서버는 session cookie → body from fallback
    });
    return await res.json();
  } catch {
    return { ok: false, error: 'Network error' };
  }
}

export async function fetchProfile(githubId: string) {
  try {
    const res = await fetch(`${BASE_URL}/api/farm/${githubId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchNotifications(githubId: string): Promise<FarmNotifications | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/farm/${githubId}/notifications`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
