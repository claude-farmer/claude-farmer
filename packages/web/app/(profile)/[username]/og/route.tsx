import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { redis, keys } from '@/lib/redis';
import type { PublicProfile } from '@claude-farmer/shared';

export const runtime = 'edge';

// ASCII로 안전하게 떨어뜨림 (CJK 문자가 폰트 누락으로 ImageResponse를 깨뜨리는 것을 방지)
function asciiSafe(s: string, max = 80): string {
  // 비-ASCII 문자 제거하고 길이 제한
  const ascii = s.replace(/[^\x20-\x7E]/g, '').trim();
  return ascii.length > max ? ascii.slice(0, max) + '...' : ascii;
}

function fallbackImage(label: string) {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200, height: 630, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: '#1a1d27', color: '#fbbf24',
          fontSize: 56, fontWeight: 'bold', fontFamily: 'sans-serif',
        }}
      >
        Claude Farmer · {label}
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const profile = await redis.get<PublicProfile>(keys.user(username));

    if (!profile) {
      return fallbackImage('Farm Not Found');
    }

    const level = profile.level ?? 1;
    const harvests = profile.total_harvests ?? 0;
    const items = profile.unique_items ?? 0;
    const streak = profile.streak_days ?? 0;
    const safeNick = asciiSafe(profile.nickname || username, 24) || username;
    const safeStatus = asciiSafe(profile.status_message?.text ?? '', 80);

    return new ImageResponse(
      (
        <div
          style={{
            width: 1200,
            height: 630,
            display: 'flex',
            flexDirection: 'column',
            background: 'linear-gradient(135deg, #1a1d27 0%, #232736 50%, #2a3a4a 100%)',
            fontFamily: 'sans-serif',
            padding: 60,
          }}
        >
          {/* 상단: 유저 정보 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 40 }}>
            <img
              src={profile.avatar_url}
              width={100}
              height={100}
              style={{ borderRadius: 50, border: '4px solid #fbbf24' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 48, fontWeight: 'bold', color: '#e5e7eb' }}>
                {safeNick}
              </div>
              <div style={{ fontSize: 24, color: '#9ca3af', marginTop: 4 }}>
                Lv.{level} · claudefarmer.com/@{username}
              </div>
            </div>
          </div>

          {/* 중간: 스탯 카드 */}
          <div style={{ display: 'flex', gap: 20, marginBottom: 40 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#232736', borderRadius: 16, padding: '20px 32px', border: '1px solid #2a2d3a' }}>
              <div style={{ fontSize: 36, fontWeight: 'bold', color: '#fbbf24' }}>{harvests}</div>
              <div style={{ fontSize: 16, color: '#9ca3af', marginTop: 4 }}>Harvests</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#232736', borderRadius: 16, padding: '20px 32px', border: '1px solid #2a2d3a' }}>
              <div style={{ fontSize: 36, fontWeight: 'bold', color: '#4ade80' }}>{items}/32</div>
              <div style={{ fontSize: 16, color: '#9ca3af', marginTop: 4 }}>Codex</div>
            </div>
            {streak > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#232736', borderRadius: 16, padding: '20px 32px', border: '1px solid #2a2d3a' }}>
                <div style={{ fontSize: 36, fontWeight: 'bold', color: '#ef4444' }}>{streak}d</div>
                <div style={{ fontSize: 16, color: '#9ca3af', marginTop: 4 }}>Streak</div>
              </div>
            )}
          </div>

          {/* 하단: 상태 메시지 + 브랜딩 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flex: 1 }}>
            {safeStatus ? (
              <div style={{ fontSize: 24, color: '#9ca3af', maxWidth: 600 }}>
                &ldquo;{safeStatus}&rdquo;
              </div>
            ) : (
              <div />
            )}
            <div style={{ fontSize: 24, color: '#fbbf24', fontWeight: 'bold' }}>Claude Farmer</div>
          </div>
        </div>
      ),
      { width: 1200, height: 630 },
    );
  } catch {
    return fallbackImage('Share Card');
  }
}
