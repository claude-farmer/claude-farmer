import { NextRequest, NextResponse } from 'next/server';
import { redis, keys } from '@/lib/redis';
import type { PublicProfile } from '@claude-farmer/shared';

// GitHub ID 또는 닉네임으로 유저 검색
export async function GET(request: NextRequest) {
  try {
    const q = (request.nextUrl.searchParams.get('q') || '').trim().toLowerCase();
    if (!q || q.length < 2) {
      return NextResponse.json({ error: 'Query too short (min 2 chars)' }, { status: 400 });
    }

    const results: (PublicProfile & { github_id: string })[] = [];
    const seen = new Set<string>();

    // 1) github_id 정확 매칭 시도
    const exactProfile = await redis.get<PublicProfile>(keys.user(q));
    if (exactProfile) {
      results.push({ ...exactProfile, github_id: q });
      seen.add(q);
    }

    // 2) 닉네임 인덱스에서 정확 매칭 시도
    if (!seen.size) {
      const indexedId = await redis.hget<string>(keys.nicknameIndex, q);
      if (indexedId) {
        const profile = await redis.get<PublicProfile>(keys.user(indexedId));
        if (profile) {
          results.push({ ...profile, github_id: indexedId });
          seen.add(indexedId);
        }
      }
    }

    // 3) 닉네임 인덱스에서 부분 매칭 (전체 인덱스 스캔)
    if (results.length < 10) {
      const allNicknames = await redis.hgetall<Record<string, string>>(keys.nicknameIndex);
      if (allNicknames) {
        for (const [nick, userId] of Object.entries(allNicknames)) {
          if (seen.has(userId)) continue;
          if (nick.includes(q)) {
            const profile = await redis.get<PublicProfile>(keys.user(userId));
            if (profile) {
              results.push({ ...profile, github_id: userId });
              seen.add(userId);
              if (results.length >= 10) break;
            }
          }
        }
      }
    }

    // 4) 최근 활동 유저 중 추가 매칭 (github_id 부분 매칭)
    const recentUsers = await redis.zrange(keys.recentActive, 0, 199, { rev: true }) as string[];

    for (const userId of recentUsers) {
      if (seen.has(userId)) continue;

      // github_id에 쿼리 포함
      if (userId.toLowerCase().includes(q)) {
        const profile = await redis.get<PublicProfile>(keys.user(userId));
        if (profile) {
          results.push({ ...profile, github_id: userId });
          seen.add(userId);
          if (results.length >= 10) break;
          continue;
        }
      }

      // 닉네임 매칭은 프로필을 가져와야 하므로 ID 매칭 후 처리
    }

    // 아직 10개 미만이면 닉네임으로도 검색
    if (results.length < 10) {
      for (const userId of recentUsers) {
        if (seen.has(userId)) continue;
        const profile = await redis.get<PublicProfile>(keys.user(userId));
        if (profile && profile.nickname.toLowerCase().includes(q)) {
          results.push({ ...profile, github_id: userId });
          seen.add(userId);
          if (results.length >= 10) break;
        }
      }
    }

    return NextResponse.json(results);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
