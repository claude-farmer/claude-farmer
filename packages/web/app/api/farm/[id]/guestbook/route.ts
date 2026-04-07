import { NextRequest, NextResponse } from 'next/server';
import { redis, keys } from '@/lib/redis';
import type { GuestbookEntry } from '@claude-farmer/shared';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 방명록 조회 (최신순, 최대 50개)
    const raw = await redis.zrange(keys.guestbook(id), 0, 49, { rev: true });
    const entries: GuestbookEntry[] = raw.map((entry: unknown) => {
      if (typeof entry === 'string') return JSON.parse(entry);
      return entry;
    });

    // 누적 카운터
    const [totalWater, totalGifts] = await Promise.all([
      redis.get<number>(keys.totalWaterReceived(id)).catch(() => 0),
      redis.get<number>(keys.totalGiftsReceived(id)).catch(() => 0),
    ]);

    return NextResponse.json({
      entries,
      total_water_received: totalWater ?? 0,
      total_gifts_received: totalGifts ?? 0,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
