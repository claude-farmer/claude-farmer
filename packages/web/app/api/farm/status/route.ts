import { NextRequest, NextResponse } from 'next/server';
import { redis, keys } from '@/lib/redis';
import type { PublicProfile } from '@claude-farmer/shared';

// 요청에서 인증된 사용자 ID 추출 (session cookie 또는 body github_id)
function extractUserId(request: NextRequest, bodyGithubId?: string): string | null {
  const session = request.cookies.get('cf_session')?.value;
  if (session) {
    try {
      return JSON.parse(session).github_id;
    } catch {
      // fallthrough to body
    }
  }
  return bodyGithubId || null;
}

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
