import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { redis, keys } from '@/lib/redis';
import { getThumbnailRects } from '@/canvas/thumbnailRects';
import type { PublicProfile } from '@claude-farmer/shared';

export const runtime = 'edge';

function asciiSafe(s: string | undefined | null, max = 32): string {
  if (!s) return '';
  const ascii = s.replace(/[^\x20-\x7E]/g, '').trim();
  return ascii.length > max ? ascii.slice(0, max) + '...' : ascii;
}

const W = 1200;
const H = 630;
const THUMB_PX = 64;
const THUMB_SCALE = 7; // 64 → 448

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const profile = await redis.get<PublicProfile>(keys.user(username)).catch(() => null);

  const nickname = asciiSafe(profile?.nickname, 24) || username;
  const level = profile?.level ?? 0;
  const harvests = profile?.total_harvests ?? 0;
  const items = profile?.unique_items ?? 0;
  const streak = profile?.streak_days ?? 0;
  const stats = `Lv.${level}  ${harvests} Harvests  ${items}/32 Codex` + (streak > 0 ? `  ${streak}d Streak` : '');

  // 썸네일 픽셀 아트 → 사각형 리스트
  const rects = getThumbnailRects({
    githubId: username,
    character: profile?.character,
    level,
    uniqueItems: items,
    streakDays: streak,
    inventory: profile?.inventory ?? [],
  }, 16);

  const thumbSize = THUMB_PX * THUMB_SCALE; // 448

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          background: '#1a1d27',
          fontFamily: 'sans-serif',
          padding: 60,
        }}
      >
        {/* 좌측: 썸네일 픽셀 아트 */}
        <div
          style={{
            display: 'flex',
            position: 'relative',
            width: thumbSize,
            height: thumbSize,
            borderRadius: 16,
            border: '4px solid #fbbf24',
            overflow: 'hidden',
          }}
        >
          {rects.map((r, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: r.x * THUMB_SCALE,
                top: r.y * THUMB_SCALE,
                width: r.w * THUMB_SCALE,
                height: r.h * THUMB_SCALE,
                backgroundColor: r.color,
                opacity: r.opacity,
              }}
            />
          ))}
        </div>

        {/* 우측: 텍스트 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginLeft: 60,
            flex: 1,
          }}
        >
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: '#fbbf24' }}>
            Claude Farmer
          </div>
          <div style={{ display: 'flex', fontSize: 72, fontWeight: 900, color: '#e5e7eb', marginTop: 16 }}>
            {nickname}
          </div>
          <div style={{ display: 'flex', fontSize: 26, color: '#9ca3af', marginTop: 12 }}>
            {stats}
          </div>
          <div style={{ display: 'flex', fontSize: 24, color: '#1a1d27', backgroundColor: '#fbbf24', padding: '16px 32px', borderRadius: 12, marginTop: 32, fontWeight: 900 }}>
            Visit and water this farm
          </div>
          <div style={{ display: 'flex', fontSize: 20, color: '#6b7280', marginTop: 24 }}>
            claudefarmer.com/@{username}
          </div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' },
    },
  );
}
