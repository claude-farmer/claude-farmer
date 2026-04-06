import { NextRequest, NextResponse } from 'next/server';
import { redis, keys } from '@/lib/redis';
import { verifySession } from '@/lib/session';

export async function GET(request: NextRequest) {
  const cookie = request.cookies.get('cf_session')?.value;
  if (!cookie) {
    return NextResponse.json({ user: null });
  }

  const session = verifySession(cookie);
  if (!session) {
    return NextResponse.json({ user: null });
  }

  try {
    const profile = await redis.get(keys.user(session.github_id));
    if (!profile) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: { github_id: session.github_id, ...(profile as Record<string, unknown>) },
    });
  } catch {
    return NextResponse.json({ user: null });
  }
}
