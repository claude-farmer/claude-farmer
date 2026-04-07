'use client';

import { useState, useEffect } from 'react';
import { fetchGuestbook } from '@/lib/api';
import { useLocale } from '@/lib/locale-context';
import Icon from './Icon';
import Card from './Card';
import { GACHA_ITEMS } from '@claude-farmer/shared';
import type { GuestbookEntry } from '@claude-farmer/shared';
import type { ReactNode } from 'react';

interface GuestbookPanelProps {
  farmId: string;
  refreshKey?: number;
  onVisitUser?: (userId: string) => void;
  onOpenRankings?: (tab: 'water' | 'gifts') => void;
  footer?: ReactNode;
  hint?: ReactNode;
}

export default function GuestbookPanel({ farmId, refreshKey, onVisitUser, onOpenRankings, footer, hint }: GuestbookPanelProps) {
  const { t, locale } = useLocale();
  const [entries, setEntries] = useState<GuestbookEntry[]>([]);
  const [totalWater, setTotalWater] = useState(0);
  const [totalGifts, setTotalGifts] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchGuestbook(farmId).then(data => {
      setEntries(data.entries);
      setTotalWater(data.total_water_received);
      setTotalGifts(data.total_gifts_received);
      setLoading(false);
    });
  }, [farmId, refreshKey]);

  function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t.guestbookJustNow;
    if (mins < 60) return `${mins}${t.guestbookMinAgo}`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}${t.guestbookHourAgo}`;
    const days = Math.floor(hours / 24);
    return `${days}${t.guestbookDayAgo}`;
  }

  function typeIconName(type: string): string {
    if (type === 'water') return 'water_drop';
    if (type === 'gift') return 'redeem';
    return 'directions_walk';
  }

  function typeLabel(entry: GuestbookEntry): string {
    if (entry.type === 'gift' && entry.item_id) {
      const item = GACHA_ITEMS.find(i => i.id === entry.item_id);
      const name = item?.name ?? '';
      return locale === 'ko' ? `${name} 선물` : `gifted ${name}`;
    }
    if (locale === 'ko') {
      if (entry.type === 'water') return '물주기';
      if (entry.type === 'gift') return '선물';
      return '방문';
    }
    if (entry.type === 'water') return 'watered';
    if (entry.type === 'gift') return 'gifted';
    return 'visited';
  }

  return (
    <Card
      header={<><Icon name="edit_note" size={14} />{t.guestbookTitle}</>}
      headerRight={
        (totalWater > 0 || totalGifts > 0) ? (
          <span className="flex items-center gap-1">
            {totalGifts > 0 && (
              <button
                type="button"
                onClick={() => onOpenRankings?.('gifts')}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-[var(--bg)] opacity-60 hover:opacity-100 transition-all"
              >
                <Icon name="redeem" size={12} />
                {totalGifts}
              </button>
            )}
            {totalWater > 0 && (
              <button
                type="button"
                onClick={() => onOpenRankings?.('water')}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-[var(--bg)] opacity-60 hover:opacity-100 transition-all"
              >
                <Icon name="water_drop" size={12} filled />
                {totalWater}
              </button>
            )}
          </span>
        ) : null
      }
      bodyClassName=""
      footer={footer}
    >
      <div className="max-h-80 overflow-y-auto px-3 py-3">
        {loading ? (
          <div className="text-center py-4 opacity-40 text-sm">{t.loading}</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-4 opacity-40 text-sm">{t.guestbookEmpty}</div>
        ) : (
          <div className="space-y-4">
            {entries.map((entry, i) => (
              <div key={i} className="flex gap-2.5 items-start">
                <button
                  onClick={() => onVisitUser?.(entry.from_id)}
                  className="w-9 h-9 rounded-full bg-[var(--border)] flex-shrink-0 overflow-hidden hover:ring-2 hover:ring-[var(--accent)] transition-all cursor-pointer"
                >
                  {entry.from_avatar_url && (
                    <img src={entry.from_avatar_url} alt="" className="w-full h-full object-cover" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-xs flex-wrap">
                    <button
                      onClick={() => onVisitUser?.(entry.from_id)}
                      className="font-bold truncate hover:text-[var(--accent)] transition-colors"
                    >
                      {entry.from_nickname}
                    </button>
                    <span className="opacity-40">·</span>
                    <span className="inline-flex items-center gap-0.5 opacity-60">
                      <Icon name={typeIconName(entry.type)} size={11} filled={entry.type === 'water'} />
                      {typeLabel(entry)}
                    </span>
                    <span className="opacity-40">·</span>
                    <span className="opacity-40">{timeAgo(entry.at)}</span>
                  </div>
                  {(entry.message || entry.link) && (
                    <div className="mt-1.5 inline-block max-w-full bg-[var(--bg)] border border-[var(--border)] rounded-2xl rounded-tl-sm overflow-hidden">
                      {entry.message && (
                        <div className="px-4 py-3 break-words text-sm leading-relaxed">
                          {entry.message}
                        </div>
                      )}
                      {entry.link && /^https?:\/\//i.test(entry.link) && (
                        <a
                          href={entry.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-4 py-2.5 border-t border-[var(--border)] text-xs text-[var(--accent)] hover:bg-[var(--card)] transition-colors"
                        >
                          <Icon name="open_in_new" size={12} className="shrink-0" />
                          <span className="truncate">{entry.link.replace(/^https?:\/\//, '')}</span>
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {hint && !loading && (
          <div className="mt-3 pt-3 border-t border-white/15 text-center text-[11px] opacity-40 leading-snug">
            {hint}
          </div>
        )}
      </div>
    </Card>
  );
}
