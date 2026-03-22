import { NextRequest, NextResponse } from 'next/server';
import { redis, keys } from '@/lib/redis';
import type { PublicProfile } from '@claude-farmer/shared';

export async function POST(request: NextRequest) {
  try {
    // Web: session cookie에서 유저 ID 추출
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

    const profile = await redis.get<PublicProfile>(keys.user(userId));
    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { status_message } = body;

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
