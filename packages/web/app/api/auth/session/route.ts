import { NextRequest, NextResponse } from 'next/server';
import { redis, keys } from '@/lib/redis';

export async function GET(request: NextRequest) {
  const session = request.cookies.get('cf_session')?.value;
  if (!session) {
    return NextResponse.json({ user: null });
  }

  try {
    const { github_id } = JSON.parse(session);
    const profile = await redis.get(keys.user(github_id));
    if (!profile) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: { github_id, ...(profile as Record<string, unknown>) },
    });
  } catch {
    return NextResponse.json({ user: null });
  }
}
