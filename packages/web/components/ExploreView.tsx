'use client';

import type { PublicProfile } from '@claude-farmer/shared';

interface ExploreViewProps {
  bookmarks: PublicProfile[];
  onVisit?: (profile: PublicProfile) => void;
}

export default function ExploreView({ bookmarks, onVisit }: ExploreViewProps) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <h2 className="text-lg font-bold">🌍 탐험</h2>

      {/* 내 이웃 */}
      <div>
        <h3 className="text-sm font-bold opacity-60 mb-2">⭐ 내 이웃 (북마크)</h3>

        {bookmarks.length === 0 ? (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-6 text-center opacity-50 text-sm">
            아직 이웃이 없어요.<br />랜덤 방문으로 농장을 구경해보세요!
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {bookmarks.map((profile, i) => (
              <button
                key={i}
                onClick={() => onVisit?.(profile)}
                className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 text-left hover:border-[var(--accent)] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🧑‍💻</span>
                    <span className="font-bold">{profile.nickname}</span>
                    <span className="text-xs opacity-50">Lv.{profile.level}</span>
                  </div>
                  <span className="text-xs opacity-40">
                    수확 {profile.total_harvests}회
                  </span>
                </div>
                {profile.status_message?.text && (
                  <div className="text-sm opacity-60 mt-1">
                    💬 &ldquo;{profile.status_message.text}&rdquo;
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 랜덤 방문 */}
      <button className="w-full bg-[var(--accent)] text-black font-bold rounded-lg py-3 hover:opacity-90 transition-opacity">
        🎲 랜덤 농장 방문
      </button>
    </div>
  );
}
