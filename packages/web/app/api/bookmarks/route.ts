import { NextRequest, NextResponse } from 'next/server';
import { redis, keys } from '@/lib/redis';
import type { PublicProfile } from '@claude-farmer/shared';

// 북마크 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = request.cookies.get('cf_session')?.value;
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let userId: string;
    try {
      userId = JSON.parse(session).github_id;
    } catch {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const bookmarkIds = await redis.smembers(keys.bookmarks(userId));

    // 병렬로 프로필 + 이웃 여부 조회
    const results = await Promise.all(
      bookmarkIds.map(async (id) => {
        const [profile, isMutual] = await Promise.all([
          redis.get<PublicProfile>(keys.user(id)),
          redis.sismember(keys.bookmarks(id), userId),
        ]);
        if (!profile) return null;
        return { ...profile, github_id: id, is_neighbor: !!isMutual };
      })
    );

    const profiles = results.filter(Boolean);
    return NextResponse.json(profiles);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 북마크 추가/삭제
export async function POST(request: NextRequest) {
  try {
    const session = request.cookies.get('cf_session')?.value;
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let userId: string;
    try {
      userId = JSON.parse(session).github_id;
    } catch {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { target_id, action } = await request.json();
    if (!target_id || !['add', 'remove'].includes(action)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // 자기 자신 북마크 방지
    if (target_id === userId) {
      return NextResponse.json({ error: 'Cannot bookmark yourself' }, { status: 400 });
    }

    // 멱등성: 이미 같은 상태면 카운터 변경 없음
    const isMember = await redis.sismember(keys.bookmarks(userId), target_id);
    if (action === 'add' && !isMember) {
      await redis.sadd(keys.bookmarks(userId), target_id);
      await redis.incr(keys.totalBookmarks(target_id));
    } else if (action === 'remove' && isMember) {
      await redis.srem(keys.bookmarks(userId), target_id);
      const newCount = await redis.decr(keys.totalBookmarks(target_id));
      if (newCount < 0) await redis.set(keys.totalBookmarks(target_id), 0);
    }

    const bookmarkIds = await redis.smembers(keys.bookmarks(userId));
    return NextResponse.json({ ok: true, bookmarks: bookmarkIds });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
