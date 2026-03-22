import { NextRequest, NextResponse } from 'next/server';
import { redis, keys } from '@/lib/redis';
import { GRID_SIZE } from '@claude-farmer/shared';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const cliPort = request.nextUrl.searchParams.get('cli_port');
  const from = request.nextUrl.searchParams.get('from');

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
      farm_snapshot: { level: 1, grid: new Array(GRID_SIZE).fill(null), total_harvests: 0 },
      last_active: new Date().toISOString(),
    });
  }

  // 최근 활동 유저 목록에 추가
  await redis.zadd(keys.recentActive, { score: Date.now(), member: user.login });

  // CLI OAuth: CLI 로컬 서버로 리다이렉트
  if (cliPort) {
    const cliCallback = `http://localhost:${cliPort}/callback?github_id=${encodeURIComponent(user.login)}&nickname=${encodeURIComponent(user.name || user.login)}&avatar_url=${encodeURIComponent(user.avatar_url)}`;
    return NextResponse.redirect(cliCallback);
  }

  // VSCode OAuth: vscode:// URI 스킴으로 리다이렉트
  if (from === 'vscode') {
    const vscodeUri = `vscode://doribear.claude-farmer-vscode/callback?github_id=${encodeURIComponent(user.login)}&nickname=${encodeURIComponent(user.name || user.login)}&avatar_url=${encodeURIComponent(user.avatar_url)}`;
    return NextResponse.redirect(vscodeUri);
  }

  // Web OAuth: 세션 쿠키 설정 후 /farm으로 리다이렉트
  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || 'https://claudefarmer.com').trim();
  const res = NextResponse.redirect(new URL('/farm', baseUrl));
  res.cookies.set('cf_session', JSON.stringify({
    github_id: user.login,
    nickname: user.name || user.login,
    avatar_url: user.avatar_url,
  }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  });

  return res;
}
