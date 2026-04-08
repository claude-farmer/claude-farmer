import { NextRequest, NextResponse } from 'next/server';
import { redis, keys } from '@/lib/redis';
import { extractUserId } from '@/lib/session';

export async function GET(request: NextRequest) {
  try {
    // session cookie 우선, ?from= query param fallback (CLI/VSCode 용)
    const fromQuery = request.nextUrl.searchParams.get('from') ?? undefined;
    const userId = extractUserId(request, fromQuery);
    if (!userId) return NextResponse.json({ remaining: 0 });

    const cooldownKey = keys.waterCooldown(userId);
    const exists = await redis.exists(cooldownKey);
    if (!exists) return NextResponse.json({ remaining: 0 });

    const ttl = await redis.ttl(cooldownKey);
    return NextResponse.json({ remaining: Math.max(0, ttl) });
  } catch {
    return NextResponse.json({ remaining: 0 });
  }
}
