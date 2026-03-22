import { NextRequest, NextResponse } from 'next/server';
import { redis, keys } from '@/lib/redis';
import { DAILY_WATER_LIMIT, GRID_SIZE } from '@claude-farmer/shared';
import type { PublicProfile } from '@claude-farmer/shared';

// 요청에서 인증된 사용자 ID 추출 (session cookie 또는 body)
function extractUserId(request: NextRequest, bodyFrom?: string): string | null {
  // 1. Web: session cookie
  const session = request.cookies.get('cf_session')?.value;
  if (session) {
    try {
      return JSON.parse(session).github_id;
    } catch {
      // fallthrough to body
    }
  }
  // 2. CLI/VSCode: body의 from 필드
  return bodyFrom || null;
}

// 물 주기
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, from, crop_slot } = body;

    const userId = extractUserId(request, from);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!to) {
      return NextResponse.json({ error: 'Missing target' }, { status: 400 });
    }

    if (userId === to) {
      return NextResponse.json({ error: 'Cannot water yourself' }, { status: 400 });
    }

    // crop_slot 검증 (optional, 0-15)
    if (crop_slot != null && (typeof crop_slot !== 'number' || crop_slot < 0 || crop_slot >= GRID_SIZE)) {
      return NextResponse.json({ error: 'Invalid crop_slot' }, { status: 400 });
    }

    // 보낸 사람 존재 확인 (CLI 스푸핑 최소 방지)
    const fromProfile = await redis.get<PublicProfile>(keys.user(userId));
    if (!fromProfile) {
      return NextResponse.json({ error: 'Sender not found' }, { status: 401 });
    }

    // 상대방 존재 확인 (incr 전에 먼저)
    const targetProfile = await redis.get<PublicProfile>(keys.user(to));
    if (!targetProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 오늘 물 준 횟수 확인
    const givenKey = `user:${userId}:water_given:${new Date().toISOString().slice(0, 10)}`;
    const givenCount = (await redis.get<number>(givenKey)) || 0;

    if (givenCount >= DAILY_WATER_LIMIT) {
      return NextResponse.json({ error: 'Daily water limit reached', remaining: 0 }, { status: 429 });
    }

    const fromNickname = fromProfile.nickname ?? userId;

    // 물 주기 기록 (검증 통과 후)
    await redis.incr(givenKey);
    await redis.expire(givenKey, 86400);

    // 상대방 물 받은 기록 (카운트)
    const receivedKey = keys.waterLog(to);
    await redis.incr(receivedKey);
    await redis.expire(receivedKey, 86400);

    // 상대방 물 받은 상세 기록 (알림용)
    const now = Date.now();
    const waterEntry = JSON.stringify({
      from_id: userId,
      from_nickname: fromNickname,
      crop_slot: crop_slot ?? null,
      at: new Date(now).toISOString(),
    });
    await redis.zadd(keys.waterDetail(to), { score: now, member: waterEntry });
    await redis.expire(keys.waterDetail(to), 86400);

    // 발자국 업데이트 (물 줬으면 watered: true)
    const footprintData = JSON.stringify({
      github_id: userId,
      nickname: fromNickname,
      visited_at: new Date(now).toISOString(),
      watered: true,
      crop_slot: crop_slot ?? undefined,
    });
    await redis.hset(keys.footprints(to), { [userId]: footprintData });
    await redis.expire(keys.footprints(to), 86400);

    const remaining = DAILY_WATER_LIMIT - givenCount - 1;
    return NextResponse.json({ ok: true, remaining });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
