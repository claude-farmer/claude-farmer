import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { redis, keys } from '@/lib/redis';
import type { PublicProfile } from '@claude-farmer/shared';

export const runtime = 'edge';

// 비-ASCII 문자 제거 (CJK/이모지가 폰트 누락으로 ImageResponse를 깨뜨리는 것 방지)
function asciiSafe(s: string | undefined | null, max = 32): string {
  if (!s) return '';
  const ascii = s.replace(/[^\x20-\x7E]/g, '').trim();
  return ascii.length > max ? ascii.slice(0, max) + '...' : ascii;
}

const W = 1200;
const H = 630;

function fallbackResponse(label: string) {
  return new ImageResponse(
    (
      <div
        style={{
          width: W, height: H, display: 'flex',
          flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, #1a1d27 0%, #232736 50%, #2a3a4a 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 80, fontWeight: 900, color: '#fbbf24' }}>Claude Farmer</div>
        <div style={{ fontSize: 36, color: '#9ca3af', marginTop: 16 }}>{label}</div>
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
  let username = '';
  try {
    const p = await params;
    username = p.username;
    const profile = await redis.get<PublicProfile>(keys.user(username));

    if (!profile) {
      return fallbackResponse('Your code grows a farm');
    }

    const nickname = asciiSafe(profile.nickname, 24) || username;
    const level = profile.level ?? 1;
    const harvests = profile.total_harvests ?? 0;
    const items = profile.unique_items ?? 0;
    const streak = profile.streak_days ?? 0;
    const status = asciiSafe(profile.status_message?.text, 80);

    return new ImageResponse(
      (
        <div
          style={{
            width: W, height: H, display: 'flex', flexDirection: 'column',
            background: 'linear-gradient(135deg, #1a1d27 0%, #232736 50%, #2a3a4a 100%)',
            fontFamily: 'sans-serif', padding: 60,
          }}
        >
          {/* 상단: 브랜드 + URL */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 32, fontWeight: 900, color: '#fbbf24' }}>Claude Farmer</div>
            <div style={{ fontSize: 24, color: '#9ca3af' }}>@{username}</div>
          </div>

          {/* 중앙: 아바타 + 닉네임 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 32, marginTop: 80 }}>
            <img
              src={profile.avatar_url}
              width={140}
              height={140}
              style={{ borderRadius: 70, border: '6px solid #fbbf24' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 64, fontWeight: 900, color: '#e5e7eb' }}>{nickname}</div>
              <div style={{ fontSize: 28, color: '#9ca3af', marginTop: 8 }}>Lv.{level}</div>
            </div>
          </div>

          {/* 통계 카드 */}
          <div style={{ display: 'flex', gap: 24, marginTop: 60 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#232736', borderRadius: 20, padding: '24px 40px', border: '2px solid #2a2d3a' }}>
              <div style={{ fontSize: 44, fontWeight: 900, color: '#fbbf24' }}>{harvests}</div>
              <div style={{ fontSize: 18, color: '#9ca3af', marginTop: 4 }}>Harvests</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#232736', borderRadius: 20, padding: '24px 40px', border: '2px solid #2a2d3a' }}>
              <div style={{ fontSize: 44, fontWeight: 900, color: '#4ade80' }}>{items}/32</div>
              <div style={{ fontSize: 18, color: '#9ca3af', marginTop: 4 }}>Codex</div>
            </div>
            {streak > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#232736', borderRadius: 20, padding: '24px 40px', border: '2px solid #2a2d3a' }}>
                <div style={{ fontSize: 44, fontWeight: 900, color: '#ef4444' }}>{streak}d</div>
                <div style={{ fontSize: 18, color: '#9ca3af', marginTop: 4 }}>Streak</div>
              </div>
            )}
          </div>

          {/* 하단: 상태 메시지 (있을 때만, ASCII만) + 사이트 */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flex: 1, marginTop: 40 }}>
            {status ? (
              <div style={{ fontSize: 26, color: '#9ca3af', maxWidth: 700, fontStyle: 'italic' }}>
                &ldquo;{status}&rdquo;
              </div>
            ) : (
              <div />
            )}
            <div style={{ fontSize: 26, color: '#fbbf24', fontWeight: 900 }}>claudefarmer.com</div>
          </div>
        </div>
      ),
      {
        width: W,
        height: H,
        headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' },
      },
    );
  } catch {
    return fallbackResponse(username ? `@${username}` : 'Your code grows a farm');
  }
}
