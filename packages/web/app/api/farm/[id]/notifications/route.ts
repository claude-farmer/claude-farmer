import { NextRequest, NextResponse } from 'next/server';
import { redis, keys } from '@/lib/redis';
import { extractUserId } from '@/lib/session';
import type { Footprint } from '@claude-farmer/shared';

// 내 농장 알림 조회 (24시간 이내 방문자 + 물 주기 기록)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const fromQuery = request.nextUrl.searchParams.get('from') ?? undefined;
    const sessionUser = extractUserId(request, fromQuery);
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // 본인 농장만 알림 조회 가능
    if (sessionUser !== id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 발자국 (방문자 목록)
    const rawFootprints = await redis.hgetall<Record<string, string>>(keys.footprints(id));
    const visitors: Footprint[] = [];
    if (rawFootprints) {
      for (const value of Object.values(rawFootprints)) {
        try {
          const fp = typeof value === 'string' ? JSON.parse(value) : value;
          visitors.push(fp);
        } catch {
          // skip malformed
        }
      }
    }
    // 최신순 정렬
    visitors.sort((a, b) => new Date(b.visited_at).getTime() - new Date(a.visited_at).getTime());

    // 물 주기 상세 기록
    const rawWater = await redis.zrange<string[]>(keys.waterDetail(id), 0, -1);
    const water_received: { from_nickname: string; from_id: string; crop_slot?: number; at: string }[] = [];
    if (rawWater) {
      for (const entry of rawWater) {
        try {
          const w = typeof entry === 'string' ? JSON.parse(entry) : entry;
          water_received.push(w);
        } catch {
          // skip malformed
        }
      }
    }
    // 최신순 정렬
    water_received.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    return NextResponse.json({
      visitors,
      visitor_count: visitors.length,
      water_received,
      water_received_count: water_received.length,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
