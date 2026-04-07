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
const THUMB_SCALE = 9; // 64 → 576
const THUMB_SIZE = THUMB_PX * THUMB_SCALE; // 576
const THUMB_X = (W - THUMB_SIZE) / 2; // 312
const THUMB_Y = (H - THUMB_SIZE) / 2; // 27

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

        {/* 말풍선 (썸네일 상단 정렬) */}
        {status && (
          <div
            style={{
              position: 'absolute',
              left: THUMB_X + 20,
              top: THUMB_Y + 20,
              maxWidth: THUMB_SIZE - 40,
              display: 'flex',
              backgroundColor: 'rgba(15, 17, 23, 0.92)',
              border: '2px solid #fbbf24',
              borderRadius: 24,
              padding: '20px 28px',
            }}
          >
            <div style={{ display: 'flex', fontSize: 26, color: '#e5e7eb', lineHeight: 1.3 }}>
              &ldquo;{status}&rdquo;
            </div>
          </div>
        )}

        {/* 하단 텍스트 그룹 (썸네일 하단 정렬, 그라데이션 배경) */}
        <div
          style={{
            position: 'absolute',
            left: THUMB_X,
            top: THUMB_Y + THUMB_SIZE - 200,
            width: THUMB_SIZE,
            height: 200,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            padding: '24px 32px',
            background: 'linear-gradient(to bottom, rgba(15,17,23,0) 0%, rgba(15,17,23,0.85) 50%, rgba(15,17,23,0.95) 100%)',
            borderBottomLeftRadius: 12,
            borderBottomRightRadius: 12,
          }}
        >
          <div style={{ display: 'flex', fontSize: 44, fontWeight: 900, color: '#e5e7eb' }}>
            {nickname}
          </div>
          <div style={{ display: 'flex', fontSize: 22, color: '#9ca3af', marginTop: 4 }}>
            @{username}
          </div>
          <div style={{ display: 'flex', fontSize: 22, color: '#fbbf24', fontWeight: 900, marginTop: 4 }}>
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
