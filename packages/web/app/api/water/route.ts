import { NextRequest, NextResponse } from 'next/server';
import { redis, keys } from '@/lib/redis';
import { DAILY_WATER_LIMIT, GRID_SIZE } from '@claude-farmer/shared';
import type { PublicProfile } from '@claude-farmer/shared';

// 물 주기
export async function POST(request: NextRequest) {
  try {
    // 세션 쿠키에서 인증
    const session = request.cookies.get('cf_session')?.value;
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let from: string;
    try {
      from = JSON.parse(session).github_id;
    } catch {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { to, crop_slot } = await request.json();

    if (!to) {
      return NextResponse.json({ error: 'Missing target' }, { status: 400 });
    }

    if (from === to) {
      return NextResponse.json({ error: 'Cannot water yourself' }, { status: 400 });
    }

    // crop_slot 검증 (optional, 0-15)
    if (crop_slot != null && (typeof crop_slot !== 'number' || crop_slot < 0 || crop_slot >= GRID_SIZE)) {
      return NextResponse.json({ error: 'Invalid crop_slot' }, { status: 400 });
    }

    // 상대방 존재 확인 (incr 전에 먼저)
    const targetProfile = await redis.get<PublicProfile>(keys.user(to));
    if (!targetProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 오늘 물 준 횟수 확인
    const givenKey = `user:${from}:water_given:${new Date().toISOString().slice(0, 10)}`;
    const givenCount = (await redis.get<number>(givenKey)) || 0;

    if (givenCount >= DAILY_WATER_LIMIT) {
      return NextResponse.json({ error: 'Daily water limit reached', remaining: 0 }, { status: 429 });
    }

    // 물 준 사람 프로필 조회 (닉네임용)
    const fromProfile = await redis.get<PublicProfile>(keys.user(from));
    const fromNickname = fromProfile?.nickname ?? from;

    // 물 주기 기록 (incr은 검증 통과 후)
    await redis.incr(givenKey);
    await redis.expire(givenKey, 86400);

    // 상대방 물 받은 기록 (카운트)
    const receivedKey = keys.waterLog(to);
    await redis.incr(receivedKey);
    await redis.expire(receivedKey, 86400);

    // 상대방 물 받은 상세 기록 (알림용)
    const now = Date.now();
    const waterEntry = JSON.stringify({
      from_id: from,
      from_nickname: fromNickname,
      crop_slot: crop_slot ?? null,
      at: new Date(now).toISOString(),
    });
    await redis.zadd(keys.waterDetail(to), { score: now, member: waterEntry });
    await redis.expire(keys.waterDetail(to), 86400);

    // 발자국 업데이트 (물 줬으면 watered: true)
    const footprintData = JSON.stringify({
      github_id: from,
      nickname: fromNickname,
      visited_at: new Date(now).toISOString(),
      watered: true,
      crop_slot: crop_slot ?? undefined,
    });
    await redis.hset(keys.footprints(to), { [from]: footprintData });
    await redis.expire(keys.footprints(to), 86400);

    const remaining = DAILY_WATER_LIMIT - givenCount - 1;
    return NextResponse.json({ ok: true, remaining });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
