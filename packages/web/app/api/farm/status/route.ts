import { NextRequest, NextResponse } from 'next/server';
import { redis, keys } from '@/lib/redis';
import { extractUserId } from '@/lib/session';
import type { PublicProfile } from '@claude-farmer/shared';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { status_message, github_id } = body;

    const userId = extractUserId(request, github_id);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await redis.get<PublicProfile>(keys.user(userId));
    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    profile.status_message = status_message
      ? {
          text: ((status_message.text as string) || '').slice(0, 200),
          link: status_message.link ? ((status_message.link as string)).slice(0, 500) : undefined,
          updated_at: new Date().toISOString(),
        }
      : null;

    await redis.set(keys.user(userId), profile);

    return NextResponse.json({ ok: true, status_message: profile.status_message });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
