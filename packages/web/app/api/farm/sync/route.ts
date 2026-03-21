import { NextRequest, NextResponse } from 'next/server';
import { redis, keys } from '@/lib/redis';
import type { PublicProfile, Farm } from '@claude-farmer/shared';

// CLI/Web에서 농장 상태를 서버에 동기화
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { github_id, nickname, avatar_url, level, total_harvests, status_message, farm } = body;

  if (!github_id) {
    return NextResponse.json({ error: 'Missing github_id' }, { status: 400 });
  }

  const profile: PublicProfile = {
    nickname: nickname || github_id,
    avatar_url: avatar_url || '',
    level: level || 1,
    total_harvests: total_harvests || 0,
    status_message: status_message || null,
    farm_snapshot: farm || { level: 1, grid: new Array(16).fill(null), total_harvests: 0 },
    last_active: new Date().toISOString(),
  };

  await redis.set(keys.user(github_id), profile);
  await redis.zadd(keys.recentActive, { score: Date.now(), member: github_id });

  return NextResponse.json({ ok: true });
}
