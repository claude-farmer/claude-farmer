import type { PublicProfile, Footprint, CharacterAppearance, GuestbookEntry } from '@claude-farmer/shared';

const BASE = '';

export async function fetchSession(): Promise<{ github_id: string; nickname: string; avatar_url: string } | null> {
  try {
    const res = await fetch(`${BASE}/api/auth/session`);
    const data = await res.json();
    return data.user || null;
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  await fetch(`${BASE}/api/auth/logout`, { method: 'POST' });
}

export async function fetchFarm(id: string): Promise<PublicProfile | null> {
  try {
    const res = await fetch(`${BASE}/api/farm/${id}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function waterUser(to: string, cropSlot?: number): Promise<{ ok: boolean; remaining?: number; cooldown_seconds?: number; cooldown_remaining?: number; error?: string }> {
  try {
    const res = await fetch(`${BASE}/api/water`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, crop_slot: cropSlot }),
    });
    return await res.json();
  } catch {
    return { ok: false, error: 'Network error' };
  }
}

export async function searchUser(query: string): Promise<(PublicProfile & { github_id: string })[]> {
  try {
    const res = await fetch(`${BASE}/api/explore/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function fetchWaterCooldown(): Promise<number> {
  try {
    const res = await fetch(`${BASE}/api/water/cooldown`);
    if (!res.ok) return 0;
    const data = await res.json();
    return data.remaining ?? 0;
  } catch {
    return 0;
  }
}

export async function fetchExplore(exclude: string, count = 10, sort: 'random' | 'recent' = 'random'): Promise<(PublicProfile & { github_id: string })[]> {
  try {
    const res = await fetch(`${BASE}/api/explore?exclude=${exclude}&count=${count}&sort=${sort}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function visitFarm(farmOwnerId: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/api/farm/${farmOwnerId}/visit`, { method: 'POST' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchFarmWithFootprints(id: string): Promise<(PublicProfile & { footprints: Footprint[] }) | null> {
  try {
    const res = await fetch(`${BASE}/api/farm/${id}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchBookmarks(): Promise<(PublicProfile & { github_id: string })[]> {
  try {
    const res = await fetch(`${BASE}/api/bookmarks`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function toggleBookmark(targetId: string, action: 'add' | 'remove'): Promise<string[]> {
  try {
    const res = await fetch(`${BASE}/api/bookmarks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_id: targetId, action }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.bookmarks ?? [];
  } catch {
    return [];
  }
}

export async function updateStatus(statusMessage: { text: string; link?: string; updated_at: string } | null): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/api/farm/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status_message: statusMessage }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function updateCharacter(character: CharacterAppearance): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/api/farm/character`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ character }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function sendGift(to: string, itemId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE}/api/gift`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, item_id: itemId }),
    });
    return await res.json();
  } catch {
    return { ok: false, error: 'Network error' };
  }
}

export interface RankingEntry {
  github_id: string;
  nickname: string;
  avatar_url: string;
  count: number;
}

export async function fetchRankings(farmId: string): Promise<{ water: RankingEntry[]; gifts: RankingEntry[] }> {
  try {
    const res = await fetch(`${BASE}/api/farm/${farmId}/rankings`);
    if (!res.ok) return { water: [], gifts: [] };
    const data = await res.json();
    return { water: data.water ?? [], gifts: data.gifts ?? [] };
  } catch {
    return { water: [], gifts: [] };
  }
}

export async function fetchGuestbook(farmId: string): Promise<{ entries: GuestbookEntry[]; total_water_received: number; total_gifts_received: number }> {
  try {
    const res = await fetch(`${BASE}/api/farm/${farmId}/guestbook`);
    if (!res.ok) return { entries: [], total_water_received: 0, total_gifts_received: 0 };
    const data = await res.json();
    return {
      entries: data.entries ?? [],
      total_water_received: data.total_water_received ?? 0,
      total_gifts_received: data.total_gifts_received ?? 0,
    };
  } catch {
    return { entries: [], total_water_received: 0, total_gifts_received: 0 };
  }
}

export async function clearGuestbook(farmId: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/api/farm/${farmId}/guestbook`, { method: 'DELETE' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteGuestbookEntry(farmId: string, at: string, fromId: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/api/farm/${farmId}/guestbook`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ at, from_id: fromId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function toggleGuestbookLike(farmId: string, at: string): Promise<boolean | null> {
  try {
    const res = await fetch(`${BASE}/api/farm/${farmId}/guestbook/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ at }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.liked as boolean;
  } catch {
    return null;
  }
}

export async function subscribe(email: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/api/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
