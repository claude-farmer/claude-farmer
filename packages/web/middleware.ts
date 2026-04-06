import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /@username → /(profile)/[username] 리라이트
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
  matcher: ['/((?!api|_next|favicon|apple-icon|manifest|robots|sitemap|og|explore|farm|settings).*)'],
};
