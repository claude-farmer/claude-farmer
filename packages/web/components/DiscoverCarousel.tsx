'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchExplore, fetchBookmarks } from '@/lib/api';
import FarmThumbnail from '@/components/FarmThumbnail';
import Icon from './Icon';
import { useLocale } from '@/lib/locale-context';
import type { PublicProfile } from '@claude-farmer/shared';

interface DiscoverCarouselProps {
  currentUser: string | null;
  viewedUsername: string;
  isOwn: boolean;
  onOpenSearch: () => void;
}

export default function DiscoverCarousel({ currentUser, viewedUsername, isOwn, onOpenSearch }: DiscoverCarouselProps) {
  const { locale } = useLocale();
  const router = useRouter();
  const [farms, setFarms] = useState<(PublicProfile & { github_id: string })[]>([]);
  const [mode, setMode] = useState<'neighbors' | 'discover'>('discover');

  useEffect(() => {
    async function load() {
      let result: (PublicProfile & { github_id: string })[] = [];
      if (isOwn && currentUser) {
        const bm = await fetchBookmarks();
        const filtered = bm.filter(f => f.github_id !== currentUser && f.github_id !== viewedUsername);
        if (filtered.length >= 3) {
          result = filtered.slice(0, 8);
          setMode('neighbors');
        } else {
          const discover = await fetchExplore(currentUser, 8);
          result = [...filtered, ...discover.filter(f => f.github_id !== viewedUsername && !filtered.find(b => b.github_id === f.github_id))].slice(0, 8);
          setMode(filtered.length > 0 ? 'neighbors' : 'discover');
        }
      } else {
        const discover = await fetchExplore(currentUser ?? '', 8);
        result = discover.filter(f => f.github_id !== viewedUsername).slice(0, 8);
        setMode('discover');
      }
      setFarms(result);
    }
    load();
  }, [currentUser, viewedUsername, isOwn]);

  if (farms.length === 0) return null;

  const title = mode === 'neighbors'
    ? (locale === 'ko' ? '이웃' : 'Neighbors')
    : isOwn
    ? (locale === 'ko' ? '추천 농장' : 'Discover')
    : (locale === 'ko' ? '다른 농장' : 'More farms');

  const iconName = mode === 'neighbors' ? 'groups' : 'explore';

  return (
    <div className="px-4 pt-3">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold opacity-60 flex items-center gap-1.5">
            <Icon name={iconName} size={14} />
            {title}
          </span>
          <button onClick={onOpenSearch} className="text-xs text-[var(--accent)] flex items-center gap-0.5">
            {locale === 'ko' ? '전체보기' : 'View all'}
            <Icon name="chevron_right" size={14} />
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {farms.map(farm => (
            <button
              key={farm.github_id}
              onClick={() => router.push(`/@${farm.github_id}`)}
              className="snap-start shrink-0 w-20 bg-[var(--bg)] border border-[var(--border)] rounded-lg overflow-hidden hover:border-[var(--accent)] transition-all active:scale-95"
            >
              <FarmThumbnail
                githubId={farm.github_id}
                character={farm.character}
                level={farm.level}
                totalHarvests={farm.total_harvests}
                uniqueItems={farm.unique_items}
                streakDays={farm.streak_days}
                inventory={farm.inventory}
                className="w-full"
              />
              <div className="px-1 py-0.5 text-center">
                <span className="text-[10px] font-bold truncate block">{farm.nickname}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
