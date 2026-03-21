import { NextRequest, NextResponse } from 'next/server';
import { redis, keys } from '@/lib/redis';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 });
  }

  // GitHub OAuth: code → access_token
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  const tokenData = await tokenRes.json();

  if (!tokenData.access_token) {
    return NextResponse.json({ error: 'OAuth failed' }, { status: 401 });
  }

  // GitHub API: access_token → user info
  const userRes = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const user = await userRes.json();

  // Redis에 프로필 저장 (없으면 생성)
  const existing = await redis.get(keys.user(user.login));
  if (!existing) {
    await redis.set(keys.user(user.login), {
      nickname: user.name || user.login,
      avatar_url: user.avatar_url,
      level: 1,
      total_harvests: 0,
      status_message: null,
      farm_snapshot: { level: 1, grid: new Array(16).fill(null), total_harvests: 0 },
      last_active: new Date().toISOString(),
    });
  }

  // 최근 활동 유저 목록에 추가
  await redis.zadd(keys.recentActive, { score: Date.now(), member: user.login });

  // CLI에서 사용할 토큰 표시 (간단한 방식)
  // 실제 프로덕션에서는 JWT/세션 쿠키를 사용해야 함
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://claudefarmer.com';
  const redirectUrl = new URL('/farm', baseUrl);
  redirectUrl.searchParams.set('user', user.login);
  redirectUrl.searchParams.set('token', tokenData.access_token);

  return NextResponse.redirect(redirectUrl.toString());
}
