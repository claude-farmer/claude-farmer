import { NextRequest, NextResponse } from 'next/server';
import { redis, keys } from '@/lib/redis';
import type { PublicProfile } from '@claude-farmer/shared';

interface RankingEntry {
  github_id: string;
  nickname: string;
  avatar_url: string;
  count: number;
}

async function topContributors(zsetKey: string, limit = 20): Promise<RankingEntry[]> {
  const raw = await redis.zrange(zsetKey, 0, limit - 1, { rev: true, withScores: true });
  // Upstash returns flat [member, score, member, score, ...]
  const pairs: { id: string; count: number }[] = [];
  for (let i = 0; i < raw.length; i += 2) {
    pairs.push({ id: String(raw[i]), count: Number(raw[i + 1]) });
  }
  if (pairs.length === 0) return [];
  const profiles = await Promise.all(
    pairs.map(p => redis.get<PublicProfile>(keys.user(p.id)).catch(() => null))
  );
  return pairs.map((p, i) => ({
    github_id: p.id,
    nickname: profiles[i]?.nickname ?? p.id,
    avatar_url: profiles[i]?.avatar_url ?? '',
    count: p.count,
  }));
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [water, gifts] = await Promise.all([
      topContributors(keys.waterByUser(id)),
      topContributors(keys.giftsByUser(id)),
    ]);
    return NextResponse.json({ water, gifts });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
