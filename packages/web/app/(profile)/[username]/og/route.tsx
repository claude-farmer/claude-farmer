import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { redis, keys } from '@/lib/redis';
import { getThumbnailRects } from '@/canvas/thumbnailRects';
import type { PublicProfile } from '@claude-farmer/shared';

export const runtime = 'edge';

function asciiSafe(s: string | undefined | null, max = 80): string {
  if (!s) return '';
  const ascii = s.replace(/[^\x20-\x7E]/g, '').trim();
  return ascii.length > max ? ascii.slice(0, max) + '...' : ascii;
}

const W = 1200;
const H = 630;
const THUMB_PX = 64;
const THUMB_DRAWN = H; // 630
const THUMB_SCALE = THUMB_DRAWN / THUMB_PX; // 9.84375
const RIGHT_X = THUMB_DRAWN; // 630
const RIGHT_W = W - RIGHT_X; // 570

function homeFallback() {
  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1a1d27',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 96, fontWeight: 900, color: '#fbbf24' }}>
          Claude Farmer
        </div>
        <div style={{ display: 'flex', fontSize: 36, color: '#9ca3af', marginTop: 24 }}>
          Your code grows a farm
        </div>
        <div style={{ display: 'flex', fontSize: 24, color: '#fbbf24', marginTop: 48, fontWeight: 700 }}>
          claudefarmer.com
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' },
    },
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const profile = await redis.get<PublicProfile>(keys.user(username)).catch(() => null);

  if (!profile) {
    return homeFallback();
  }

  const nickname = asciiSafe(profile.nickname, 24) || username;
  const level = profile.level ?? 0;
  const harvests = profile.total_harvests ?? 0;
  const items = profile.unique_items ?? 0;
  const streak = profile.streak_days ?? 0;
  const status = asciiSafe(profile.status_message?.text, 70);

  // 말풍선 없으면 통계로 대체
  const statsLine = `Lv.${level}  ·  ${harvests} Harvests  ·  ${items}/32 Codex` + (streak > 0 ? `  ·  ${streak}d Streak` : '');

  const rects = getThumbnailRects({
    githubId: username,
    character: profile.character,
    level,
    uniqueItems: items,
    streakDays: streak,
    inventory: profile.inventory ?? [],
  }, 16);

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: 'flex',
          background: '#0f1117',
          fontFamily: 'sans-serif',
        }}
      >
        {/* LEFT: 썸네일 픽셀 아트 (630×630, 풀 높이) */}
        <div
          style={{
            display: 'flex',
            position: 'relative',
            width: THUMB_DRAWN,
            height: THUMB_DRAWN,
            backgroundColor: '#000',
          }}
        >
          {rects.map((r, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: Math.round(r.x * THUMB_SCALE),
                top: Math.round(r.y * THUMB_SCALE),
                width: Math.ceil(r.w * THUMB_SCALE) + 1,
                height: Math.ceil(r.h * THUMB_SCALE) + 1,
                backgroundColor: r.color,
                opacity: r.opacity,
              }}
            />
          ))}
        </div>

        {/* RIGHT: 텍스트 영역 (570×630) */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: RIGHT_W,
            height: H,
            padding: '56px 48px',
            background: 'linear-gradient(135deg, #1a1d27 0%, #0f1117 100%)',
          }}
        >
          {/* 상단: 말풍선 (있을 때만) */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {status && (
              <div
                style={{
                  display: 'flex',
                  maxWidth: RIGHT_W - 96,
                  backgroundColor: '#ffffff',
                  color: '#0f1117',
                  borderTopLeftRadius: 0,
                  borderTopRightRadius: 28,
                  borderBottomLeftRadius: 28,
                  borderBottomRightRadius: 28,
                  padding: '24px 30px',
                }}
              >
                <div style={{ display: 'flex', fontSize: 32, color: '#0f1117', lineHeight: 1.35 }}>
                  {status}
                </div>
              </div>
            )}
          </div>

          {/* 하단: 닉네임 + 통계(말풍선 없을 때) + URL */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 64, fontWeight: 900, color: '#ffffff' }}>
              {nickname}
            </div>
            {!status && (
              <div style={{ display: 'flex', fontSize: 22, color: '#9ca3af', marginTop: 12 }}>
                {statsLine}
              </div>
            )}
            <div style={{ display: 'flex', fontSize: 28, color: '#fbbf24', fontWeight: 900, marginTop: 14 }}>
              claudefarmer.com/@{username}
            </div>
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
