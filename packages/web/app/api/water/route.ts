import { NextRequest, NextResponse } from 'next/server';
import { redis, keys } from '@/lib/redis';
import { DAILY_WATER_LIMIT } from '@claude-farmer/shared';
import type { PublicProfile } from '@claude-farmer/shared';

// 물 주기
export async function POST(request: NextRequest) {
  const { from, to } = await request.json();

  if (!from || !to) {
    return NextResponse.json({ error: 'Missing from/to' }, { status: 400 });
  }

  if (from === to) {
    return NextResponse.json({ error: 'Cannot water yourself' }, { status: 400 });
  }

  // 오늘 물 준 횟수 확인
  const givenKey = `user:${from}:water_given:${new Date().toISOString().slice(0, 10)}`;
  const givenCount = (await redis.get<number>(givenKey)) || 0;

  if (givenCount >= DAILY_WATER_LIMIT) {
    return NextResponse.json({ error: 'Daily water limit reached', remaining: 0 }, { status: 429 });
  }

  // 상대방 존재 확인
  const targetProfile = await redis.get<PublicProfile>(keys.user(to));
  if (!targetProfile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // 물 주기 기록
  await redis.incr(givenKey);
  await redis.expire(givenKey, 86400); // 24시간 후 만료

  // 상대방 물 받은 기록
  const receivedKey = keys.waterLog(to);
  await redis.incr(receivedKey);
  await redis.expire(receivedKey, 86400);

  const remaining = DAILY_WATER_LIMIT - givenCount - 1;
  return NextResponse.json({ ok: true, remaining });
}
