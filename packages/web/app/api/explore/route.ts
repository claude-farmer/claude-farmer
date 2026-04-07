import { NextRequest, NextResponse } from 'next/server';
import { redis, keys } from '@/lib/redis';
import type { PublicProfile } from '@claude-farmer/shared';

// 랜덤 농장 탐험 (최근 활동 유저 중 랜덤)
export async function GET(request: NextRequest) {
  try {
    const exclude = request.nextUrl.searchParams.get('exclude') || '';
    const rawCount = parseInt(request.nextUrl.searchParams.get('count') || '10');
    const count = Math.min(Math.max(rawCount || 10, 1), 50);
    const sort = request.nextUrl.searchParams.get('sort') || 'random';

    // 최근 활동 유저 목록 (최근 100명, 활동 시각 내림차순)
    const recentUsers = await redis.zrange(keys.recentActive, 0, 99, { rev: true }) as string[];

    // 자신 제외
    const candidates = recentUsers.filter(u => u !== exclude);

    // sort=recent → 활동 시각 순서 그대로, 아니면 랜덤 셔플
    const picked = sort === 'recent'
      ? candidates.slice(0, count)
      : candidates.sort(() => Math.random() - 0.5).slice(0, count);

    // 프로필 가져오기
    const profiles: (PublicProfile & { github_id: string })[] = [];
    for (const userId of picked) {
      const profile = await redis.get<PublicProfile>(keys.user(userId));
      if (profile) {
        profiles.push({ ...profile, github_id: userId });
      }
    }

    return NextResponse.json(profiles);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
