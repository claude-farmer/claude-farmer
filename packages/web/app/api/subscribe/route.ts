import { NextRequest, NextResponse } from 'next/server';
import { redis, keys } from '@/lib/redis';

// 이메일 구독
export async function POST(request: NextRequest) {
  const { email } = await request.json();

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  await redis.sadd(keys.subscribers, email.toLowerCase().trim());

  return NextResponse.json({ ok: true });
}
