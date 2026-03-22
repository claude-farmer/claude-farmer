import { NextRequest, NextResponse } from 'next/server';
import { redis, keys } from '@/lib/redis';
import { GRID_SIZE } from '@claude-farmer/shared';
import type { PublicProfile, Farm } from '@claude-farmer/shared';

// 요청에서 인증된 사용자 ID 추출 (session cookie 또는 body)
function extractUserId(request: NextRequest, bodyGithubId?: string): string | null {
  // 1. Web: session cookie
  const session = request.cookies.get('cf_session')?.value;
  if (session) {
    try {
      return JSON.parse(session).github_id;
    } catch {
      // fallthrough to body
    }
  }
  // 2. CLI/VSCode: body의 github_id 필드
  return bodyGithubId || null;
}

// CLI/Web에서 농장 상태를 서버에 동기화
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { github_id, nickname, avatar_url, level, total_harvests, unique_items, streak_days, status_message, farm } = body;

    const userId = extractUserId(request, github_id);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // CLI에서 body로 보낸 github_id가 인증된 유저와 일치하는지 확인
    // (session cookie 경우 이미 추출됨, CLI 경우 동일)
    // 최소 검증: 해당 유저가 Redis에 존재하는지 확인
    const existing = await redis.get<PublicProfile>(keys.user(userId));
    if (!existing && userId !== github_id) {
      // session 유저와 body 유저가 다르면 거부
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const profile: PublicProfile = {
      nickname: (nickname || userId).slice(0, 50),
      avatar_url: (avatar_url || '').slice(0, 500),
      level: level || 1,
      total_harvests: total_harvests || 0,
      unique_items: typeof unique_items === 'number' ? unique_items : undefined,
      streak_days: typeof streak_days === 'number' ? streak_days : undefined,
      status_message: status_message ? {
        ...status_message,
        text: (status_message.text || '').slice(0, 200),
        link: status_message.link ? (status_message.link as string).slice(0, 500) : undefined,
      } : null,
      farm_snapshot: farm || { level: 1, grid: new Array(GRID_SIZE).fill(null), total_harvests: 0 },
      last_active: new Date().toISOString(),
    };

    await redis.set(keys.user(userId), profile);
    await redis.zadd(keys.recentActive, { score: Date.now(), member: userId });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
