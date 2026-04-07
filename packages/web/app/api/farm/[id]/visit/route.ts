import { NextRequest, NextResponse } from 'next/server';
import { redis, keys } from '@/lib/redis';
import { GUESTBOOK_MAX_ENTRIES } from '@claude-farmer/shared';
import type { PublicProfile } from '@claude-farmer/shared';

// 다른 유저 농장 방문 기록
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = request.cookies.get('cf_session')?.value;
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let visitorId: string;
    try {
      visitorId = JSON.parse(session).github_id;
    } catch {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { id: farmOwnerId } = await params;

    // 자기 농장 방문은 기록하지 않음
    if (visitorId === farmOwnerId) {
      return NextResponse.json({ ok: true });
    }

    // 방문자 프로필에서 닉네임 조회
    const visitorProfile = await redis.get<PublicProfile>(keys.user(visitorId));
    const nickname = visitorProfile?.nickname ?? visitorId;

    const now = Date.now();

    // 누적 방문자 카운트 (방문할 때마다 증가)
    await redis.incr(keys.totalVisitors(farmOwnerId));

    // 방문자 sorted set에 추가 (중복 방문은 timestamp 갱신)
    await redis.zadd(keys.visitors(farmOwnerId), { score: now, member: visitorId });
    await redis.expire(keys.visitors(farmOwnerId), 86400);

    // 24시간 지난 방문 기록 제거
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    await redis.zremrangebyscore(keys.visitors(farmOwnerId), 0, oneDayAgo);

    // 발자국 hash에 추가 (물 안 줬으므로 watered: false)
    const existing = await redis.hget<string>(keys.footprints(farmOwnerId), visitorId);
    let footprintData: string;

    if (existing) {
      // 이미 발자국이 있으면 (물 줬을 수 있음) visited_at만 갱신
      try {
        const parsed = typeof existing === 'string' ? JSON.parse(existing) : existing;
        parsed.visited_at = new Date(now).toISOString();
        footprintData = JSON.stringify(parsed);
      } catch {
        footprintData = JSON.stringify({
          github_id: visitorId,
          nickname,
          visited_at: new Date(now).toISOString(),
          watered: false,
        });
      }
    } else {
      footprintData = JSON.stringify({
        github_id: visitorId,
        nickname,
        visited_at: new Date(now).toISOString(),
        watered: false,
      });
    }

    await redis.hset(keys.footprints(farmOwnerId), { [visitorId]: footprintData });
    await redis.expire(keys.footprints(farmOwnerId), 86400);

    // 방명록 기록 (1시간 내 중복 방문은 기록 안 함)
    const oneHourAgo = now - 60 * 60 * 1000;
    const recentEntries = await redis.zrange(keys.guestbook(farmOwnerId), oneHourAgo, now, { byScore: true });
    const hasRecentVisit = recentEntries.some((entry: unknown) => {
      try {
        const e = typeof entry === 'string' ? JSON.parse(entry) : entry;
        return e.from_id === visitorId && e.type === 'visit';
      } catch { return false; }
    });

    if (!hasRecentVisit) {
      const guestbookEntry = JSON.stringify({
        from_id: visitorId,
        from_nickname: nickname,
        from_avatar_url: visitorProfile?.avatar_url,
        type: 'visit',
        message: visitorProfile?.status_message?.text || null,
        at: new Date(now).toISOString(),
      });
      await redis.zadd(keys.guestbook(farmOwnerId), { score: now, member: guestbookEntry });
      const count = await redis.zcard(keys.guestbook(farmOwnerId));
      if (count > GUESTBOOK_MAX_ENTRIES) {
        await redis.zremrangebyrank(keys.guestbook(farmOwnerId), 0, count - GUESTBOOK_MAX_ENTRIES - 1);
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
