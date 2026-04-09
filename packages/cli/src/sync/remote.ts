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
        unique_items: new Set(state.inventory.map(i => i.id)).size,
        streak_days: state.activity.streak_days,
        today_input_chars: state.activity.today_input_chars,
        today_harvests: state.activity.today_harvests,
        today_water_given: state.activity.today_water_given,
        inventory: state.inventory,
        status_message: state.status_message,
        character: state.user.character,
        farm: state.farm,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function sendWater(from: string, to: string): Promise<{ ok: boolean; remaining?: number; cooldown_seconds?: number; cooldown_remaining?: number; error?: string }> {
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
    const res = await fetch(`${BASE_URL}/api/farm/${githubId}/notifications?from=${encodeURIComponent(githubId)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchGuestbook(githubId: string) {
  try {
    const res = await fetch(`${BASE_URL}/api/farm/${githubId}/guestbook`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function clearGuestbook(githubId: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/farm/${githubId}/guestbook`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ github_id: githubId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteGuestbookEntry(githubId: string, at: string, fromId: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/farm/${githubId}/guestbook`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ github_id: githubId, at, from_id: fromId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function toggleGuestbookLike(githubId: string, at: string): Promise<boolean | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/farm/${githubId}/guestbook/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ github_id: githubId, at }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.liked as boolean;
  } catch {
    return null;
  }
}

export async function fetchRankings(githubId: string) {
  try {
    const res = await fetch(`${BASE_URL}/api/farm/${githubId}/rankings`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function sendGift(toId: string, itemId: string, fromId: string) {
  try {
    const res = await fetch(`${BASE_URL}/api/gift`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: toId, item_id: itemId, from: fromId }),
    });
    return await res.json();
  } catch {
    return { ok: false, error: 'Network error' };
  }
}

export async function updateStatusRemote(githubId: string, statusMessage: LocalState['status_message']): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/farm/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ github_id: githubId, status_message: statusMessage }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function updateCharacterRemote(characterAppearance: unknown, fromId: string) {
  try {
    const res = await fetch(`${BASE_URL}/api/farm/character`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ character: characterAppearance, github_id: fromId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
