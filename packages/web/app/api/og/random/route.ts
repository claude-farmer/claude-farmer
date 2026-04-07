import { NextRequest } from 'next/server';
import { redis, keys } from '@/lib/redis';

export const runtime = 'edge';

// 랜덤 활성 유저의 OG 이미지를 프록시 스트림으로 반환
// README/외부 임베드용 — GitHub Camo 등 이미지 프록시가 캐싱하지만,
// s-maxage=600으로 10분마다 회전
export async function GET(request: NextRequest) {
  try {
    const recentUsers = (await redis.zrange(keys.recentActive, 0, 99, { rev: true })) as string[];
    if (!recentUsers || recentUsers.length === 0) {
      // 활성 유저 없음 → 사이트 기본 og로 리다이렉트
      return Response.redirect(new URL('/og', request.url).toString(), 302);
    }
    const pick = recentUsers[Math.floor(Math.random() * recentUsers.length)];
    const target = new URL(`/${encodeURIComponent(pick)}/og`, request.url);
    const upstream = await fetch(target.toString(), { cache: 'no-store' });
    if (!upstream.ok || !upstream.body) {
      return Response.redirect(new URL('/og', request.url).toString(), 302);
    }
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'image/png',
        'Cache-Control': 'public, max-age=600, s-maxage=600, stale-while-revalidate=300',
      },
    });
  } catch {
    return Response.redirect(new URL('/og', request.url).toString(), 302);
  }
}
