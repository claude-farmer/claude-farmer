'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { fetchExplore, searchUser, fetchBookmarks, fetchSession } from '@/lib/api';
import FarmThumbnail from '@/components/FarmThumbnail';
import { useLocale } from '@/lib/locale-context';
import type { PublicProfile } from '@claude-farmer/shared';

export default function ExplorePage() {
  const { t, locale } = useLocale();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<(PublicProfile & { github_id: string })[]>([]);
  const [randomFarms, setRandomFarms] = useState<(PublicProfile & { github_id: string })[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<(PublicProfile & { github_id: string })[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const session = await fetchSession();
      if (session) {
        setCurrentUser(session.github_id);
        const bm = await fetchBookmarks();
        setBookmarks(bm);
      }
      const farms = await fetchExplore(session?.github_id ?? '', 9);
      setRandomFarms(farms);
      setLoading(false);
    }
    init();
  }, []);

  const handleRefresh = async () => {
    const farms = await fetchExplore(currentUser ?? '', 9);
    setRandomFarms(farms);
  };

  const handleSearch = async () => {
    if (searchQuery.trim().length < 2) return;
    setSearchLoading(true);
    const results = await searchUser(searchQuery.trim());
    setSearchResults(results.filter(p => p.github_id !== currentUser));
    setSearchLoading(false);
  };

  if (loading) {
    return (
      <div className="max-w-md mx-auto min-h-screen flex items-center justify-center bg-[var(--bg)] shadow-2xl border-x border-[var(--border)]">
        <div className="text-4xl animate-bounce">🔍</div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col bg-[var(--bg)] shadow-2xl border-x border-[var(--border)]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[var(--bg)] border-b border-[var(--border)]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center justify-between px-4 py-2">
          <Link href={currentUser ? `/@${currentUser}` : '/'} className="text-sm opacity-60 hover:opacity-100">
            ← {locale === 'ko' ? '농장' : 'Farm'}
          </Link>
          <span className="text-sm font-bold">🌍 {t.exploreTitle}</span>
          <div className="w-12" />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* Search */}
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); if (e.target.value.length < 2) setSearchResults(null); }}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder={t.searchPlaceholder}
              className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
            />
            <button
              onClick={handleSearch}
              disabled={searchLoading || searchQuery.trim().length < 2}
              className="bg-[var(--accent)] text-black font-bold rounded-lg px-4 py-2 text-sm disabled:opacity-50"
            >
              🔍
            </button>
          </div>
        </div>

        {/* Search Results */}
        {searchResults !== null && (
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <h3 className="text-xs font-bold opacity-50 mb-2">{t.searchResults}</h3>
            {searchResults.length === 0 ? (
              <p className="text-xs opacity-40">{t.searchNoResults}</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {searchResults.map(farm => (
                  <Link key={farm.github_id} href={`/@${farm.github_id}`} className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden hover:border-[var(--accent)] transition-all active:scale-95">
                    <FarmThumbnail githubId={farm.github_id} character={farm.character} level={farm.level} totalHarvests={farm.total_harvests} uniqueItems={farm.unique_items} streakDays={farm.streak_days} inventory={farm.inventory} className="w-full" />
                    <div className="px-1.5 py-1 text-center"><span className="text-xs font-bold truncate block">{farm.nickname}</span></div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Neighbors/Bookmarks (horizontal scroll) */}
        {bookmarks.length > 0 && (
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <h3 className="text-xs font-bold opacity-50 mb-2">🏡 {locale === 'ko' ? '이웃' : 'Neighbors'}</h3>
            <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {bookmarks.map(farm => (
                <Link key={farm.github_id} href={`/@${farm.github_id}`} className="flex flex-col items-center shrink-0">
                  <img src={farm.avatar_url} alt="" className="w-12 h-12 rounded-full border-2 border-[var(--border)] hover:border-[var(--accent)] transition-colors" />
                  <span className="text-xs mt-1 truncate max-w-[48px]">{farm.nickname}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Random Discover */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold opacity-50">🎲 {locale === 'ko' ? '추천 농장' : 'Discover'}</h3>
            <button onClick={handleRefresh} className="text-xs opacity-40 hover:opacity-100 transition-opacity">
              ↻ {locale === 'ko' ? '새로고침' : 'Refresh'}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {randomFarms.map(farm => (
              <Link key={farm.github_id} href={`/@${farm.github_id}`} className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden hover:border-[var(--accent)] transition-all active:scale-95">
                <FarmThumbnail githubId={farm.github_id} character={farm.character} level={farm.level} totalHarvests={farm.total_harvests} uniqueItems={farm.unique_items} streakDays={farm.streak_days} inventory={farm.inventory} className="w-full" />
                <div className="px-1.5 py-1 text-center"><span className="text-xs font-bold truncate block">{farm.nickname}</span></div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
