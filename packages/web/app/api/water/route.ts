import { NextRequest, NextResponse } from 'next/server';
import { redis, keys } from '@/lib/redis';
import { extractUserId } from '@/lib/session';
import { WATER_COOLDOWN_SECONDS, GRID_SIZE, GUESTBOOK_MAX_ENTRIES } from '@claude-farmer/shared';
import type { PublicProfile } from '@claude-farmer/shared';

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

    if (crop_slot != null && (typeof crop_slot !== 'number' || crop_slot < 0 || crop_slot >= GRID_SIZE)) {
      return NextResponse.json({ error: 'Invalid crop_slot' }, { status: 400 });
    }

    const fromProfile = await redis.get<PublicProfile>(keys.user(userId));
    if (!fromProfile) {
      return NextResponse.json({ error: 'Sender not found' }, { status: 401 });
    }

    const targetProfile = await redis.get<PublicProfile>(keys.user(to));
    if (!targetProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 쿨다운 체크 (5분)
    const cooldownKey = keys.waterCooldown(userId);
    const cooldownExists = await redis.exists(cooldownKey);
    if (cooldownExists) {
      const ttl = await redis.ttl(cooldownKey);
      return NextResponse.json({ error: 'Water on cooldown', cooldown_remaining: ttl }, { status: 429 });
    }

    const fromNickname = fromProfile.nickname ?? userId;
    const now = Date.now();

    // 쿨다운 설정 (5분)
    await redis.set(cooldownKey, '1', { ex: WATER_COOLDOWN_SECONDS });

    // 물 받은 기록 (일별 카운트 - 레거시 호환)
    const receivedKey = keys.waterLog(to);
    await redis.incr(receivedKey);
    await redis.expire(receivedKey, 86400);

    // 총 받은 물 수 (영구)
    await redis.incr(keys.totalWaterReceived(to));

    // 사용자별 누적 물 (랭킹용)
    await redis.zincrby(keys.waterByUser(to), 1, userId);

    // 일별 준 횟수 (레거시 호환)
    const givenKey = `user:${userId}:water_given:${new Date().toISOString().slice(0, 10)}`;
    await redis.incr(givenKey);
    await redis.expire(givenKey, 86400);

    // 물 상세 기록 (알림용)
    const waterEntry = JSON.stringify({
      from_id: userId,
      from_nickname: fromNickname,
      crop_slot: crop_slot ?? null,
      at: new Date(now).toISOString(),
    });
    await redis.zadd(keys.waterDetail(to), { score: now, member: waterEntry });
    await redis.expire(keys.waterDetail(to), 86400);

    // 발자국 업데이트
    const footprintData = JSON.stringify({
      github_id: userId,
      nickname: fromNickname,
      visited_at: new Date(now).toISOString(),
      watered: true,
      crop_slot: crop_slot ?? undefined,
    });
    await redis.hset(keys.footprints(to), { [userId]: footprintData });
    await redis.expire(keys.footprints(to), 86400);

    // 방명록 기록
    const guestbookEntry = JSON.stringify({
      from_id: userId,
      from_nickname: fromNickname,
      from_avatar_url: fromProfile.avatar_url,
      type: 'water',
      message: fromProfile.status_message?.text || null,
      link: fromProfile.status_message?.link ?? null,
      at: new Date(now).toISOString(),
    });
    await redis.zadd(keys.guestbook(to), { score: now, member: guestbookEntry });
    // max entries 유지
    const count = await redis.zcard(keys.guestbook(to));
    if (count > GUESTBOOK_MAX_ENTRIES) {
      await redis.zremrangebyrank(keys.guestbook(to), 0, count - GUESTBOOK_MAX_ENTRIES - 1);
    }

    // remaining for CLI backward compat (daily count)
    const givenCount = (await redis.get<number>(givenKey)) || 0;
    const remaining = Math.max(0, 3 - givenCount);
    return NextResponse.json({ ok: true, cooldown_seconds: WATER_COOLDOWN_SECONDS, remaining });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
