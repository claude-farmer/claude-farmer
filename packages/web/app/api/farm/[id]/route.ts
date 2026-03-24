import { NextRequest, NextResponse } from 'next/server';
import { redis, keys } from '@/lib/redis';
import type { PublicProfile, Footprint } from '@claude-farmer/shared';

// 특정 유저의 공개 프로필 조회 (발자국 포함)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const profile = await redis.get<PublicProfile>(keys.user(id));

    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 발자국 데이터 조회 (24시간 이내)
    const rawFootprints = await redis.hgetall<Record<string, string>>(keys.footprints(id));
    const footprints: (Footprint & { character?: PublicProfile['character']; avatar_url?: string })[] = [];
    if (rawFootprints) {
      for (const value of Object.values(rawFootprints)) {
        try {
          const fp = typeof value === 'string' ? JSON.parse(value) : value;
          footprints.push(fp);
        } catch {
          // skip malformed entries
        }
      }
    }

    // 방문자 캐릭터 정보 enrichment (최대 20명)
    const visitorIds = footprints.slice(0, 20).map(fp => fp.github_id);
    if (visitorIds.length > 0) {
      const visitorProfiles = await Promise.all(
        visitorIds.map(vid => redis.get<PublicProfile>(keys.user(vid)).catch(() => null))
      );
      for (let i = 0; i < visitorIds.length; i++) {
        const vp = visitorProfiles[i];
        if (vp) {
          if (vp.character) footprints[i].character = vp.character;
          if (vp.avatar_url) footprints[i].avatar_url = vp.avatar_url;
        }
      }
    }

    return NextResponse.json({ ...profile, footprints });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
