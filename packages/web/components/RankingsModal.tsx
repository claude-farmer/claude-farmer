'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchRankings, type RankingEntry } from '@/lib/api';
import { useLocale } from '@/lib/locale-context';
import Icon from './Icon';

interface RankingsModalProps {
  farmId: string;
  initialTab: 'water' | 'gifts';
  onClose: () => void;
}

export default function RankingsModal({ farmId, initialTab, onClose }: RankingsModalProps) {
  const { locale } = useLocale();
  const router = useRouter();
  const [tab, setTab] = useState<'water' | 'gifts'>(initialTab);
  const [data, setData] = useState<{ water: RankingEntry[]; gifts: RankingEntry[] } | null>(null);

  useEffect(() => {
    fetchRankings(farmId).then(setData);
  }, [farmId]);

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const list = tab === 'water' ? data?.water ?? [] : data?.gifts ?? [];

  const handleVisit = (id: string) => {
    onClose();
    router.push(`/@${id}`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end justify-center" onClick={onClose}>
      <div
        className="bg-[var(--bg)] w-full max-w-md rounded-t-xl max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="shrink-0 flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-[var(--border)]" />
        </div>

        {/* Header */}
        <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]">
          <span className="h-8 flex items-center gap-2 text-sm font-bold flex-1 min-w-0">
            <Icon name="leaderboard" size={18} />
            {locale === 'ko' ? '랭킹' : 'Rankings'}
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

        {/* Tabs */}
        <div className="shrink-0 flex border-b border-[var(--border)]">
          <button
            onClick={() => setTab('water')}
            className={`flex-1 h-11 flex items-center justify-center gap-1.5 text-xs font-bold transition-colors ${
              tab === 'water' ? 'text-blue-400 border-b-2 border-blue-400' : 'opacity-50 hover:opacity-100'
            }`}
          >
            <Icon name="water_drop" size={14} filled />
            {locale === 'ko' ? '물주기' : 'Water'}
          </button>
          <button
            onClick={() => setTab('gifts')}
            className={`flex-1 h-11 flex items-center justify-center gap-1.5 text-xs font-bold transition-colors ${
              tab === 'gifts' ? 'text-pink-400 border-b-2 border-pink-400' : 'opacity-50 hover:opacity-100'
            }`}
          >
            <Icon name="redeem" size={14} />
            {locale === 'ko' ? '선물' : 'Gifts'}
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {data === null ? (
            <div className="text-center py-8 opacity-40 text-sm">{locale === 'ko' ? '불러오는 중...' : 'Loading...'}</div>
          ) : list.length === 0 ? (
            <div className="text-center py-8 opacity-40 text-sm">
              {locale === 'ko' ? '아직 기록이 없어요' : 'No records yet'}
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {list.map((entry, i) => (
                <button
                  key={entry.github_id}
                  onClick={() => handleVisit(entry.github_id)}
                  className="w-full flex items-center gap-3 py-2.5 hover:bg-[var(--card)] transition-colors px-2 -mx-2"
                >
                  <span className={`w-6 text-center text-xs font-bold tabular-nums ${
                    i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-orange-400' : 'opacity-40'
                  }`}>
                    {i + 1}
                  </span>
                  <img
                    src={entry.avatar_url}
                    alt=""
                    className="w-8 h-8 rounded-full border border-[var(--border)] object-cover shrink-0"
                  />
                  <span className="flex-1 text-sm font-bold truncate text-left">{entry.nickname}</span>
                  <span className={`inline-flex items-center gap-1 text-xs font-bold tabular-nums ${
                    tab === 'water' ? 'text-blue-400' : 'text-pink-400'
                  }`}>
                    <Icon name={tab === 'water' ? 'water_drop' : 'redeem'} size={12} filled={tab === 'water'} />
                    {entry.count}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
