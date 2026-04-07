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

function pickFontSize(text: string, table: { maxLen: number; size: number }[]): number {
  const len = text.length;
  return (table.find(t => len <= t.maxLen) ?? table[table.length - 1]).size;
}

const NICK_SIZES = [
  { maxLen: 10, size: 64 },
  { maxLen: 14, size: 56 },
  { maxLen: 20, size: 44 },
  { maxLen: 99, size: 36 },
];

const URL_SIZES = [
  { maxLen: 12, size: 30 },
  { maxLen: 18, size: 26 },
  { maxLen: 24, size: 22 },
  { maxLen: 99, size: 20 },
];

const W = 1200;
const H = 630;
const PAD = 56;
const THUMB_PX = 64;
const THUMB_SIZE = 512;
const THUMB_SCALE = THUMB_SIZE / THUMB_PX; // 8
const THUMB_X = PAD;
const THUMB_Y = (H - THUMB_SIZE) / 2; // 59
const RIGHT_X = THUMB_X + THUMB_SIZE + 48; // 616
const RIGHT_W = W - RIGHT_X - PAD; // 528

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

  const nickname = asciiSafe(profile.nickname, 24) || username;
  const level = profile.level ?? 0;
  const harvests = profile.total_harvests ?? 0;
  const items = profile.unique_items ?? 0;
  const streak = profile.streak_days ?? 0;
  const status = asciiSafe(profile.status_message?.text, 60);
  const urlText = `claudefarmer.com/@${username}`;

  const nickSize = pickFontSize(nickname, NICK_SIZES);
  const urlSize = pickFontSize(urlText, URL_SIZES);

  const rects = getThumbnailRects({
    githubId: username,
    character: profile.character,
    level,
    uniqueItems: items,
    streakDays: streak,
    inventory: profile.inventory ?? [],
  }, 16);

  const statsLine = `Lv.${level}  ·  ${harvests} Harvests  ·  ${items}/32 Codex` + (streak > 0 ? `  ·  ${streak}d Streak` : '');

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
        {/* LEFT: 라운드 사각형 썸네일 (512×512, 수직 중앙) */}
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            left: THUMB_X,
            top: THUMB_Y,
            width: THUMB_SIZE,
            height: THUMB_SIZE,
            backgroundColor: '#000',
            borderRadius: 32,
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

        {/* RIGHT: 텍스트 그룹 (수직 중앙 정렬, 좌측 정렬) */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'flex-start',
            position: 'absolute',
            left: RIGHT_X,
            top: 0,
            width: RIGHT_W,
            height: H,
          }}
        >
          {status && (
            <div
              style={{
                display: 'flex',
                maxWidth: RIGHT_W,
                backgroundColor: '#ffffff',
                color: '#0f1117',
                borderTopLeftRadius: 0,
                borderTopRightRadius: 24,
                borderBottomLeftRadius: 24,
                borderBottomRightRadius: 24,
                padding: '20px 26px',
                marginBottom: 28,
              }}
            >
              <div style={{ display: 'flex', fontSize: 26, color: '#0f1117', lineHeight: 1.35 }}>
                {status}
              </div>
            </div>
          )}
          <div
            style={{
              display: 'flex',
              fontSize: nickSize,
              fontWeight: 900,
              color: '#ffffff',
              lineHeight: 1.05,
              maxWidth: RIGHT_W,
            }}
          >
            {nickname}
          </div>
          {!status && (
            <div style={{ display: 'flex', fontSize: 20, color: '#9ca3af', marginTop: 14 }}>
              {statsLine}
            </div>
          )}
          <div
            style={{
              display: 'flex',
              fontSize: urlSize,
              color: '#fbbf24',
              fontWeight: 900,
              marginTop: 16,
              maxWidth: RIGHT_W,
            }}
          >
            {urlText}
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
