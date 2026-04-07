import { NextRequest, NextResponse } from 'next/server';
import { redis, keys } from '@/lib/redis';
import { extractUserId } from '@/lib/session';

export async function GET(request: NextRequest) {
  try {
    const userId = extractUserId(request);
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
