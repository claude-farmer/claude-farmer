import type { PublicProfile, FarmNotifications, Footprint, CharacterAppearance, GuestbookEntry } from '@claude-farmer/shared';

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

export async function syncFarm(data: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/api/farm/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch {
    return false;
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

export async function fetchExplore(exclude: string, count = 10): Promise<(PublicProfile & { github_id: string })[]> {
  try {
    const res = await fetch(`${BASE}/api/explore?exclude=${exclude}&count=${count}`);
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

export async function fetchNotifications(userId: string): Promise<FarmNotifications | null> {
  try {
    const res = await fetch(`${BASE}/api/farm/${userId}/notifications`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
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

export async function waveSurf(fromId: string, excludeId: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/api/explore/wave?from=${fromId}&exclude=${excludeId}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.target ?? null;
  } catch {
    return null;
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

export async function fetchGuestbook(farmId: string): Promise<{ entries: GuestbookEntry[]; total_water_received: number }> {
  try {
    const res = await fetch(`${BASE}/api/farm/${farmId}/guestbook`);
    if (!res.ok) return { entries: [], total_water_received: 0 };
    return await res.json();
  } catch {
    return { entries: [], total_water_received: 0 };
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
