import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { redis, keys } from '@/lib/redis';
import { getThumbnailRects } from '@/canvas/thumbnailRects';
import { getThumbnailSkyTheme } from '@/canvas/thumbnailScene';
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

// 텍스트 비율 1 / 1.3 / 1.5 (base 36)
const FS_BASE = 36;
const FS_STATUS = FS_BASE; // 36 (1×)
const FS_HANDLE = Math.round(FS_BASE * 1.3); // 47 (1.3×)
const FS_NICK = Math.round(FS_BASE * 1.5); // 54 (1.5×)
const FS_URL = 30;

// 우측 카드 썸네일 (텍스트 영역과 동일 높이, 살짝 더 크게)
const TOP_PAD = 40;
const BOTTOM_RESERVED = 100; // 하단 로고 영역
const CARD_SIZE = H - TOP_PAD - BOTTOM_RESERVED; // 490
const CARD_X = W - CARD_SIZE - 40; // 670
const CARD_Y = TOP_PAD; // 40
const CARD_SCALE = CARD_SIZE / THUMB_PX; // ~7.66

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
          background: '#0f1117',
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

  const nickname = asciiSafe(profile.nickname, 28) || username;
  const level = profile.level ?? 0;
  const items = profile.unique_items ?? 0;
  const streak = profile.streak_days ?? 0;
  const status = asciiSafe(profile.status_message?.text, 90);

  const rects = getThumbnailRects({
    githubId: username,
    character: profile.character,
    level,
    uniqueItems: items,
    streakDays: streak,
    inventory: profile.inventory ?? [],
  }, 16);

  // 배경: 사용자 sky 테마 기반 그라데이션 (블러 대용 - Satori filter:blur 미동작)
  const sky = getThumbnailSkyTheme(username);
  const bgGradient = `linear-gradient(135deg, ${sky.top} 0%, ${sky.bot} 35%, #1a2f1a 70%, #0f1117 100%)`;

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: 'flex',
          position: 'relative',
          background: bgGradient,
          fontFamily: 'sans-serif',
          overflow: 'hidden',
        }}
      >

        {/* 우측 그라데이션 (텍스트 가독성 보장) */}
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            left: 0,
            top: 0,
            width: W,
            height: H,
            background: 'linear-gradient(to right, rgba(15,17,23,0.85) 0%, rgba(15,17,23,0.78) 35%, rgba(15,17,23,0) 75%)',
          }}
        />

        {/* 하단 그라데이션 (로고 보호) */}
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            left: 0,
            top: 0,
            width: W,
            height: H,
            background: 'linear-gradient(to top, rgba(15,17,23,0.92) 0%, rgba(15,17,23,0.7) 15%, rgba(15,17,23,0) 35%)',
          }}
        />

        {/* 우측 카드 썸네일 (그라데이션 위, 텍스트 영역과 동일 높이) */}
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            left: CARD_X,
            top: CARD_Y,
            width: CARD_SIZE,
            height: CARD_SIZE,
            backgroundColor: '#000',
            borderRadius: 32,
            border: '6px solid #fbbf24',
            overflow: 'hidden',
          }}
        >
          {rects.map((r, i) => (
            <div
              key={`card-${i}`}
              style={{
                position: 'absolute',
                left: Math.round(r.x * CARD_SCALE),
                top: Math.round(r.y * CARD_SCALE),
                width: Math.ceil(r.w * CARD_SCALE) + 1,
                height: Math.ceil(r.h * CARD_SCALE) + 1,
                backgroundColor: r.color,
                opacity: r.opacity,
              }}
            />
          ))}
        </div>

        {/* 좌측 상단 텍스트 그룹 (로고 침범 방지를 위해 height 제한, 우측 카드 침범 방지) */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            position: 'absolute',
            left: 56,
            top: TOP_PAD,
            width: CARD_X - 56 - 32,
            maxHeight: CARD_SIZE,
            overflow: 'hidden',
            justifyContent: 'flex-start',
          }}
        >
          <div style={{ display: 'flex', fontSize: FS_NICK, fontWeight: 900, color: '#ffffff', lineHeight: 1.1 }}>
            {nickname}
          </div>
          <div style={{ display: 'flex', fontSize: FS_HANDLE, color: '#9ca3af', marginTop: 20 }}>
            @{username}
          </div>
          {status && (
            <div
              style={{
                display: 'flex',
                marginTop: 40,
                paddingLeft: 20,
                borderLeft: '4px solid #fbbf24',
                maxWidth: 640,
              }}
            >
              <div style={{ display: 'flex', fontSize: FS_STATUS, color: '#d1d5db', lineHeight: 1.4 }}>
                {status}
              </div>
            </div>
          )}
        </div>

        {/* 좌측 하단 로고 */}
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            left: 56,
            bottom: 48,
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', fontSize: FS_URL, color: '#fbbf24', fontWeight: 900 }}>
            claudefarmer.com
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
