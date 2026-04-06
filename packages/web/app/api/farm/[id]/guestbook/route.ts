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

    // 총 받은 물 수
    const totalWater = (await redis.get<number>(keys.totalWaterReceived(id))) ?? 0;

    return NextResponse.json({ entries, total_water_received: totalWater });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
