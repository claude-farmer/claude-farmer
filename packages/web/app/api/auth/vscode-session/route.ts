import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { redis, keys } from '@/lib/redis';
import { signSession } from '@/lib/session';

const SECRET = process.env.SESSION_SECRET || process.env.GITHUB_CLIENT_SECRET || 'claude-farmer-default-secret';
const TOKEN_TTL_MS = 60_000; // 60초

function makeToken(githubId: string, ts: number): string {
  return createHmac('sha256', SECRET)
    .update(`${githubId}:${ts}`)
    .digest('hex')
    .slice(0, 32);
}

/** Extension → POST: github_id를 받아 one-time 로그인 URL 반환 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { github_id } = body as { github_id?: string };

    if (!github_id) {
      return NextResponse.json({ error: 'Missing github_id' }, { status: 400 });
    }

    // 실제 존재하는 유저인지 확인
    const profile = await redis.get(keys.user(github_id));
    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const ts = Date.now();
    const token = makeToken(github_id, ts);

    const url = `/api/auth/vscode-session?token=${token}&gid=${encodeURIComponent(github_id)}&ts=${ts}`;
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** Webview → GET: 토큰 검증 후 cf_session 쿠키 세팅 + 농장으로 리다이렉트 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const gid = searchParams.get('gid');
  const ts = Number(searchParams.get('ts') ?? '0');

  if (!token || !gid || !ts) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 만료 확인
  if (Date.now() - ts > TOKEN_TTL_MS) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 서명 검증
  const expected = makeToken(gid, ts);
  if (token !== expected) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 유저 존재 확인
  const profile = await redis.get<{ nickname: string; avatar_url: string }>(keys.user(gid));
  if (!profile) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // cf_session 쿠키 세팅
  const sessionValue = signSession({
    github_id: gid,
    nickname: profile.nickname ?? gid,
    avatar_url: profile.avatar_url ?? '',
  });

  const response = NextResponse.redirect(new URL(`/@${gid}`, request.url));
  response.cookies.set('cf_session', sessionValue, {
    httpOnly: true,
    sameSite: 'none', // cross-origin iframe 쿠키 허용
    secure: true,
    maxAge: 60 * 60 * 24 * 30, // 30일
    path: '/',
  });
  return response;
}
