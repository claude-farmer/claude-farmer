import { NextRequest, NextResponse } from 'next/server';
import { redis, keys } from '@/lib/redis';
import type { PublicProfile } from '@claude-farmer/shared';

// 랜덤 농장 탐험 (최근 활동 유저 중 랜덤)
export async function GET(request: NextRequest) {
  const exclude = request.nextUrl.searchParams.get('exclude') || '';
  const count = parseInt(request.nextUrl.searchParams.get('count') || '10');

  // 최근 활동 유저 목록 (최근 100명)
  const recentUsers = await redis.zrange(keys.recentActive, 0, 99, { rev: true }) as string[];

  // 자신 제외
  const candidates = recentUsers.filter(u => u !== exclude);

  // 랜덤 셔플 후 count만큼
  const shuffled = candidates.sort(() => Math.random() - 0.5).slice(0, count);

  // 프로필 가져오기
  const profiles: (PublicProfile & { github_id: string })[] = [];
  for (const userId of shuffled) {
    const profile = await redis.get<PublicProfile>(keys.user(userId));
    if (profile) {
      profiles.push({ ...profile, github_id: userId });
    }
  }

  return NextResponse.json(profiles);
}
