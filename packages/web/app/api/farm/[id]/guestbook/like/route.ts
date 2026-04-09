import { NextRequest, NextResponse } from 'next/server';
import { redis, keys } from '@/lib/redis';
import { extractUserId } from '@/lib/session';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const callerId = extractUserId(request, body.github_id);

    if (!callerId || callerId !== id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { at } = body;
    if (!at) {
      return NextResponse.json({ error: 'Missing at' }, { status: 400 });
    }

    const likedKey = keys.guestbookLiked(id);
    const isLiked = await redis.sismember(likedKey, at);

    if (isLiked) {
      await redis.srem(likedKey, at);
      return NextResponse.json({ ok: true, liked: false });
    } else {
      await redis.sadd(likedKey, at);
      return NextResponse.json({ ok: true, liked: true });
    }
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
