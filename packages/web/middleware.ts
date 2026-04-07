import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /@username[/og 등] → /(profile)/[username][/og 등] 리라이트
  const match = pathname.match(/^\/@([\w-]+)(\/.*)?$/);
  if (match) {
    const username = match[1];
    const rest = match[2] ?? '';
    const url = request.nextUrl.clone();
    url.pathname = `/${username}${rest}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  // Next.js 내부/정적 자원/루트 API + 기존 페이지 라우트만 제외
  // 'og'는 제외하지 않음 → /@username/og 가 미들웨어를 통과해야 함
  matcher: ['/((?!api|_next|favicon|apple-icon|manifest|robots|sitemap|explore|farm|settings).*)'],
};
