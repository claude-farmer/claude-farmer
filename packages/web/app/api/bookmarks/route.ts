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
    const profiles: (PublicProfile & { github_id: string })[] = [];

    for (const id of bookmarkIds) {
      const profile = await redis.get<PublicProfile>(keys.user(id));
      if (profile) {
        profiles.push({ ...profile, github_id: id });
      }
    }

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

    if (action === 'add') {
      await redis.sadd(keys.bookmarks(userId), target_id);
    } else {
      await redis.srem(keys.bookmarks(userId), target_id);
    }

    const bookmarkIds = await redis.smembers(keys.bookmarks(userId));
    return NextResponse.json({ ok: true, bookmarks: bookmarkIds });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
