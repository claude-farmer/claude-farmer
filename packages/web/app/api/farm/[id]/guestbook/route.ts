import { NextRequest, NextResponse } from 'next/server';
import { redis, keys } from '@/lib/redis';
import { extractUserId } from '@/lib/session';
import type { GuestbookEntry } from '@claude-farmer/shared';

export async function GET(
  request: NextRequest,
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

    // 좋아요 set 조회 (주인 세션이 있을 때만)
    const callerId = extractUserId(request, undefined);
    let likedSet: string[] = [];
    if (callerId === id) {
      const raw = await redis.smembers(keys.guestbookLiked(id)).catch(() => []);
      likedSet = raw as string[];
    }

    const annotated = entries.map(e => ({
      ...e,
      liked: likedSet.includes(e.at),
    }));

    // 누적 카운터
    const [totalWater, totalGifts] = await Promise.all([
      redis.get<number>(keys.totalWaterReceived(id)).catch(() => 0),
      redis.get<number>(keys.totalGiftsReceived(id)).catch(() => 0),
    ]);

    return NextResponse.json({
      entries: annotated,
      total_water_received: totalWater ?? 0,
      total_gifts_received: totalGifts ?? 0,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const callerId = extractUserId(request, body.github_id);

    if (!callerId || callerId !== id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 개별 삭제: body에 at + from_id가 있으면
    if (body.at) {
      const score = new Date(body.at).getTime();
      const members = await redis.zrange(keys.guestbook(id), score, score, { byScore: true });
      if (members.length === 0) {
        return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
      }
      // from_id로 정확한 항목 매칭
      const target = members.find((m: unknown) => {
        try {
          const e = typeof m === 'string' ? JSON.parse(m) : m;
          return body.from_id ? e.from_id === body.from_id : true;
        } catch { return false; }
      }) ?? members[0];

      await redis.zrem(keys.guestbook(id), target);
      // 좋아요도 제거
      await redis.srem(keys.guestbookLiked(id), body.at).catch(() => null);
      return NextResponse.json({ ok: true });
    }

    // 전체 삭제
    await redis.del(keys.guestbook(id));
    await redis.del(keys.guestbookLiked(id));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
