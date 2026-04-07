'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchExplore, searchUser, fetchBookmarks } from '@/lib/api';
import FarmThumbnail from '@/components/FarmThumbnail';
import { useLocale } from '@/lib/locale-context';
import Icon from './Icon';
import type { PublicProfile } from '@claude-farmer/shared';

interface SearchModalProps {
  currentUser: string | null;
  onClose: () => void;
}

export default function SearchModal({ currentUser, onClose }: SearchModalProps) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const [bookmarks, setBookmarks] = useState<(PublicProfile & { github_id: string })[]>([]);
  const [randomFarms, setRandomFarms] = useState<(PublicProfile & { github_id: string })[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<(PublicProfile & { github_id: string })[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    async function init() {
      if (currentUser) {
        const bm = await fetchBookmarks();
        setBookmarks(bm);
      }
      const farms = await fetchExplore(currentUser ?? '', 9);
      setRandomFarms(farms);
    }
    init();
  }, [currentUser]);

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [onClose]);

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

  const handleVisit = (id: string) => {
    onClose();
    router.push(`/@${id}`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[var(--bg)] flex flex-col" onClick={onClose}>
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col bg-[var(--bg)] shadow-2xl border-x border-[var(--border)]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <header className="sticky top-0 z-10 bg-[var(--bg)] border-b border-[var(--border)]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="flex items-center gap-2 px-3 py-2">
            <span className="h-8 flex items-center gap-2 text-sm font-bold flex-1 min-w-0">
              <Icon name="explore" size={18} />
              {t.exploreTitle}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 h-8 w-8 flex items-center justify-center border border-[var(--border)] rounded-lg hover:bg-[var(--card)] hover:border-[var(--accent)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              <Icon name="close" size={18} />
            </button>
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
                autoFocus
                className="flex-1 h-9 bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 text-sm focus:outline-none focus:border-[var(--accent)]"
              />
              <button
                type="button"
                onClick={handleSearch}
                disabled={searchLoading || searchQuery.trim().length < 2}
                aria-label={t.exploreTitle}
                className="shrink-0 h-9 w-9 flex items-center justify-center border border-[var(--border)] rounded-lg hover:bg-[var(--card)] hover:border-[var(--accent)] transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                <Icon name="search" size={18} />
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
                    <button key={farm.github_id} onClick={() => handleVisit(farm.github_id)} className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden hover:border-[var(--accent)] transition-all active:scale-95">
                      <FarmThumbnail githubId={farm.github_id} character={farm.character} level={farm.level} totalHarvests={farm.total_harvests} uniqueItems={farm.unique_items} streakDays={farm.streak_days} inventory={farm.inventory} className="w-full" />
                      <div className="px-1.5 py-1 text-center"><span className="text-xs font-bold truncate block">{farm.nickname}</span></div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Neighbors (horizontal) */}
          {bookmarks.length > 0 && searchResults === null && (
            <div className="px-4 py-3 border-b border-[var(--border)]">
              <h3 className="text-xs font-bold opacity-50 mb-2 flex items-center gap-1.5">
                <Icon name="groups" size={14} />
                {locale === 'ko' ? '이웃' : 'Neighbors'}
              </h3>
              <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {bookmarks.map(farm => (
                  <button key={farm.github_id} onClick={() => handleVisit(farm.github_id)} className="flex flex-col items-center shrink-0">
                    <img src={farm.avatar_url} alt="" className="w-12 h-12 rounded-full border-2 border-[var(--border)] hover:border-[var(--accent)] transition-colors" />
                    <span className="text-xs mt-1 truncate max-w-[48px]">{farm.nickname}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Random Discover */}
          {searchResults === null && (
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold opacity-50 flex items-center gap-1.5">
                  <Icon name="casino" size={14} />
                  {locale === 'ko' ? '추천 농장' : 'Discover'}
                </h3>
                <button onClick={handleRefresh} className="text-xs opacity-40 hover:opacity-100 transition-opacity flex items-center gap-1">
                  <Icon name="refresh" size={14} />
                  {locale === 'ko' ? '새로고침' : 'Refresh'}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {randomFarms.map(farm => (
                  <button key={farm.github_id} onClick={() => handleVisit(farm.github_id)} className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden hover:border-[var(--accent)] transition-all active:scale-95">
                    <FarmThumbnail githubId={farm.github_id} character={farm.character} level={farm.level} totalHarvests={farm.total_harvests} uniqueItems={farm.unique_items} streakDays={farm.streak_days} inventory={farm.inventory} className="w-full" />
                    <div className="px-1.5 py-1 text-center"><span className="text-xs font-bold truncate block">{farm.nickname}</span></div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
