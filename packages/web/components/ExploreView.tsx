'use client';

import { useState } from 'react';
import type { PublicProfile } from '@claude-farmer/shared';
import { fetchExplore, visitFarm } from '@/lib/api';
import { useLocale } from '@/lib/locale-context';

interface ExploreViewProps {
  bookmarks: PublicProfile[];
  currentUser?: string;
  onVisit?: (profile: PublicProfile) => void;
}

export default function ExploreView({ bookmarks, currentUser, onVisit }: ExploreViewProps) {
  const { t } = useLocale();
  const [randomProfiles, setRandomProfiles] = useState<(PublicProfile & { github_id: string })[]>([]);
  const [loading, setLoading] = useState(false);

  const handleRandomVisit = async () => {
    setLoading(true);
    const profiles = await fetchExplore(currentUser || '', 5);
    setRandomProfiles(profiles);
    setLoading(false);
  };

  const handleVisit = (profile: PublicProfile & { github_id?: string }) => {
    const id = (profile as PublicProfile & { github_id: string }).github_id;
    if (id) {
      visitFarm(id);
    }
    onVisit?.(profile);
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <h2 className="text-lg font-bold">🌍 {t.exploreTitle}</h2>

      <div>
        <h3 className="text-sm font-bold opacity-60 mb-2">⭐ {t.myNeighbors}</h3>

        {bookmarks.length === 0 ? (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-6 text-center opacity-50 text-sm whitespace-pre-line">
            {t.noNeighbors}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {bookmarks.map((profile, i) => (
              <button
                key={i}
                onClick={() => handleVisit(profile)}
                className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 text-left hover:border-[var(--accent)] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🧑‍💻</span>
                    <span className="font-bold">{profile.nickname}</span>
                    <span className="text-xs opacity-50">Lv.{profile.level}</span>
                  </div>
                  <span className="text-xs opacity-40">
                    {t.harvests} {profile.total_harvests}{t.times}
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

      <button
        onClick={handleRandomVisit}
        disabled={loading}
        className="w-full bg-[var(--accent)] text-black font-bold rounded-lg py-3 hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {loading ? `🔄 ${t.searching}` : `🎲 ${t.randomVisit}`}
      </button>

      {randomProfiles.length > 0 && (
        <div>
          <h3 className="text-sm font-bold opacity-60 mb-2">🎲 {t.discoveredFarms}</h3>
          <div className="flex flex-col gap-2">
            {randomProfiles.map((profile) => (
              <button
                key={profile.github_id}
                onClick={() => handleVisit(profile)}
                className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 text-left hover:border-[var(--accent)] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🧑‍💻</span>
                    <span className="font-bold">{profile.nickname}</span>
                    <span className="text-xs opacity-50">Lv.{profile.level}</span>
                  </div>
                  <span className="text-xs opacity-40">{t.harvests} {profile.total_harvests}{t.times}</span>
                </div>
                {profile.status_message?.text && (
                  <div className="text-sm opacity-60 mt-1">
                    💬 &ldquo;{profile.status_message.text}&rdquo;
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
