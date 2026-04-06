import { NextRequest, NextResponse } from 'next/server';
import { redis, keys } from '@/lib/redis';
import { GUESTBOOK_MAX_ENTRIES } from '@claude-farmer/shared';
import type { PublicProfile, InventoryItem } from '@claude-farmer/shared';

function extractUserId(request: NextRequest, bodyFrom?: string): string | null {
  const session = request.cookies.get('cf_session')?.value;
  if (session) {
    try { return JSON.parse(session).github_id; } catch {}
  }
  return bodyFrom || null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, item_id, from } = body;

    const userId = extractUserId(request, from);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!to || !item_id) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    if (userId === to) return NextResponse.json({ error: 'Cannot gift yourself' }, { status: 400 });

    // 보낸 사람 프로필/인벤토리
    const senderProfile = await redis.get<PublicProfile>(keys.user(userId));
    if (!senderProfile) return NextResponse.json({ error: 'Sender not found' }, { status: 401 });

    const inventory: InventoryItem[] = senderProfile.inventory ?? [];
    const itemIndex = inventory.findIndex(item => item.id === item_id);
    if (itemIndex === -1) return NextResponse.json({ error: 'Item not in inventory' }, { status: 400 });

    // 받는 사람 존재 확인
    const targetProfile = await redis.get<PublicProfile>(keys.user(to));
    if (!targetProfile) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const giftedItem = inventory[itemIndex];

    // 인벤토리에서 1개 제거
    inventory.splice(itemIndex, 1);
    senderProfile.inventory = inventory;
    await redis.set(keys.user(userId), JSON.stringify(senderProfile));

    // 받는 사람 선물 기록
    await redis.hincrby(keys.gifts(to), item_id, 1);
    await redis.incr(keys.totalGiftsReceived(to));

    // 방명록 기록
    const now = Date.now();
    const guestbookEntry = JSON.stringify({
      from_id: userId,
      from_nickname: senderProfile.nickname ?? userId,
      from_avatar_url: senderProfile.avatar_url,
      type: 'gift',
      message: giftedItem.name,
      item_id,
      at: new Date(now).toISOString(),
    });
    await redis.zadd(keys.guestbook(to), { score: now, member: guestbookEntry });
    const count = await redis.zcard(keys.guestbook(to));
    if (count > GUESTBOOK_MAX_ENTRIES) {
      await redis.zremrangebyrank(keys.guestbook(to), 0, count - GUESTBOOK_MAX_ENTRIES - 1);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
