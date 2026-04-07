import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { redis, keys } from '@/lib/redis';
import type { PublicProfile } from '@claude-farmer/shared';

export const runtime = 'edge';

function asciiSafe(s: string | undefined | null, max = 32): string {
  if (!s) return '';
  const ascii = s.replace(/[^\x20-\x7E]/g, '').trim();
  return ascii.length > max ? ascii.slice(0, max) + '...' : ascii;
}

const W = 1200;
const H = 630;

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
          padding: 80,
        }}
      >
        <div style={{ display: 'flex', fontSize: 32, fontWeight: 700, color: '#fbbf24' }}>
          Claude Farmer
        </div>
        <div style={{ display: 'flex', fontSize: 96, fontWeight: 900, color: '#e5e7eb', marginTop: 24 }}>
          {nickname}
        </div>
        <div style={{ display: 'flex', fontSize: 32, color: '#9ca3af', marginTop: 16 }}>
          {stats}
        </div>
        <div style={{ display: 'flex', fontSize: 28, color: '#1a1d27', backgroundColor: '#fbbf24', padding: '20px 40px', borderRadius: 12, marginTop: 56, fontWeight: 900 }}>
          Visit and water this farm
        </div>
        <div style={{ display: 'flex', fontSize: 22, color: '#6b7280', marginTop: 32 }}>
          claudefarmer.com/@{username}
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
