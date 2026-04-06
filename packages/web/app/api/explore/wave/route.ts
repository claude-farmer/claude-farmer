import { NextRequest, NextResponse } from 'next/server';
import { redis, keys } from '@/lib/redis';

// 파도타기: 특정 유저의 북마크에서 랜덤 1명 반환
export async function GET(request: NextRequest) {
  try {
    const fromId = request.nextUrl.searchParams.get('from');
    const excludeId = request.nextUrl.searchParams.get('exclude');
    if (!fromId) {
      return NextResponse.json({ error: 'Missing from parameter' }, { status: 400 });
    }

    const bookmarkId = await redis.srandmember(keys.bookmarks(fromId)) as string | null;
    if (!bookmarkId || bookmarkId === excludeId) {
      // Try once more if excluded
      const allBookmarks = await redis.smembers(keys.bookmarks(fromId)) as string[];
      const filtered = allBookmarks.filter(id => id !== excludeId);
      if (filtered.length === 0) {
        return NextResponse.json({ target: null });
      }
      const random = filtered[Math.floor(Math.random() * filtered.length)];
      return NextResponse.json({ target: random });
    }

    return NextResponse.json({ target: bookmarkId });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
