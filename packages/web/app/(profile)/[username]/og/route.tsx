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
const PAD = 60;
const THUMB_PX = 64;
const THUMB_SCALE = 7; // 64 → 448
const THUMB_SIZE = THUMB_PX * THUMB_SCALE; // 448
const THUMB_X = PAD;
const THUMB_Y = (H - THUMB_SIZE) / 2; // 91
const RIGHT_X = THUMB_X + THUMB_SIZE + 48; // 556
const RIGHT_W = W - RIGHT_X - PAD; // 584

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
  const items = profile.unique_items ?? 0;
  const streak = profile.streak_days ?? 0;
  const status = asciiSafe(profile.status_message?.text, 60);

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
          position: 'relative',
          background: '#0f1117',
          fontFamily: 'sans-serif',
        }}
      >
        {/* 썸네일 픽셀 아트 (중앙) */}
        <div
          style={{
            position: 'absolute',
            left: THUMB_X,
            top: THUMB_Y,
            width: THUMB_SIZE,
            height: THUMB_SIZE,
            display: 'flex',
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

        {/* 우측 상단: 말풍선 (썸네일 상단 정렬, 좌측 tail) */}
        {status && (
          <div
            style={{
              position: 'absolute',
              left: RIGHT_X,
              top: THUMB_Y,
              maxWidth: RIGHT_W,
              display: 'flex',
            }}
          >
            {/* Tail (썸네일 쪽으로 향함) */}
            <div
              style={{
                position: 'absolute',
                left: -18,
                top: 36,
                width: 22,
                height: 28,
                display: 'flex',
                backgroundColor: '#fbbf24',
                clipPath: 'polygon(0% 50%, 100% 0%, 100% 100%)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: -14,
                top: 38,
                width: 20,
                height: 24,
                display: 'flex',
                backgroundColor: '#1a1d27',
                clipPath: 'polygon(0% 50%, 100% 0%, 100% 100%)',
              }}
            />
            {/* 본체 */}
            <div
              style={{
                display: 'flex',
                backgroundColor: '#1a1d27',
                border: '2px solid #fbbf24',
                borderRadius: 32,
                padding: '32px 40px',
              }}
            >
              <div style={{ display: 'flex', fontSize: 42, color: '#e5e7eb', lineHeight: 1.3 }}>
                {status}
              </div>
            </div>
          </div>
        )}

        {/* 우측 하단: 텍스트 그룹 (썸네일 하단 정렬, 위쪽 그라데이션) */}
        <div
          style={{
            position: 'absolute',
            left: RIGHT_X,
            top: THUMB_Y + THUMB_SIZE - 220,
            width: RIGHT_W,
            height: 220,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            padding: '24px 40px',
            background: 'linear-gradient(to bottom, rgba(15,17,23,0) 0%, rgba(15,17,23,0.85) 40%, rgba(15,17,23,1) 100%)',
          }}
        >
          <div style={{ display: 'flex', fontSize: 56, fontWeight: 900, color: '#e5e7eb' }}>
            {nickname}
          </div>
          <div style={{ display: 'flex', fontSize: 26, color: '#9ca3af', marginTop: 8 }}>
            @{username}
          </div>
          <div style={{ display: 'flex', fontSize: 26, color: '#fbbf24', fontWeight: 900, marginTop: 8 }}>
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
