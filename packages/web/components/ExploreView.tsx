'use client';

import { useState } from 'react';
import type { PublicProfile } from '@claude-farmer/shared';
import { fetchExplore, visitFarm, searchUser } from '@/lib/api';
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

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<(PublicProfile & { github_id: string })[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const handleRandomVisit = async () => {
    setLoading(true);
    const profiles = await fetchExplore(currentUser || '', 5);
    setRandomProfiles(profiles);
    setLoading(false);
  };

  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (q.length < 2) return;
    setSearchLoading(true);
    const results = await searchUser(q);
    // 자기 자신 제외
    setSearchResults(results.filter(p => p.github_id !== currentUser));
    setSearchLoading(false);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleVisit = (profile: PublicProfile & { github_id?: string }) => {
    const id = (profile as PublicProfile & { github_id: string }).github_id;
    if (id) {
      visitFarm(id);
    }
    onVisit?.(profile);
  };

  const ProfileCard = ({ profile }: { profile: PublicProfile & { github_id?: string } }) => (
    <button
      onClick={() => handleVisit(profile)}
      className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 text-left hover:border-[var(--accent)] transition-colors w-full"
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
  );

  return (
    <div className="flex flex-col gap-4 p-4">
      <h2 className="text-lg font-bold">🌍 {t.exploreTitle}</h2>

      {/* Bookmarks — always on top for quick access */}
      <div>
        <h3 className="text-sm font-bold opacity-60 mb-2">⭐ {t.myNeighbors}</h3>

        {bookmarks.length === 0 ? (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-6 text-center opacity-50 text-sm whitespace-pre-line">
            {t.noNeighbors}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {bookmarks.map((profile, i) => (
              <ProfileCard key={i} profile={profile} />
            ))}
          </div>
        )}
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder={t.searchPlaceholder}
          className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
        />
        <button
          onClick={handleSearch}
          disabled={searchLoading || searchQuery.trim().length < 2}
          className="bg-[var(--accent)] text-black font-bold rounded-lg px-4 py-2 text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {searchLoading ? '...' : `🔍 ${t.searchBtn}`}
        </button>
      </div>

      {/* Search Results */}
      {searchResults !== null && (
        <div>
          <h3 className="text-sm font-bold opacity-60 mb-2">🔍 {t.searchResults}</h3>
          {searchResults.length === 0 ? (
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 text-center opacity-50 text-sm">
              {t.searchNoResults}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {searchResults.map((profile) => (
                <ProfileCard key={profile.github_id} profile={profile} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Random Visit */}
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
              <ProfileCard key={profile.github_id} profile={profile} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
