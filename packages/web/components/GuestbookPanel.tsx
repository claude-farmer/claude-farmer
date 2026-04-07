'use client';

import { useState, useEffect } from 'react';
import { fetchGuestbook } from '@/lib/api';
import { useLocale } from '@/lib/locale-context';
import Icon from './Icon';
import Card from './Card';
import type { GuestbookEntry } from '@claude-farmer/shared';
import type { ReactNode } from 'react';

interface GuestbookPanelProps {
  farmId: string;
  refreshKey?: number;
  onVisitUser?: (userId: string) => void;
  footer?: ReactNode;
  hint?: ReactNode;
}

export default function GuestbookPanel({ farmId, refreshKey, onVisitUser, footer, hint }: GuestbookPanelProps) {
  const { t, locale } = useLocale();
  const [entries, setEntries] = useState<GuestbookEntry[]>([]);
  const [totalWater, setTotalWater] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchGuestbook(farmId).then(data => {
      setEntries(data.entries);
      setTotalWater(data.total_water_received);
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

  function typeLabel(type: string): string {
    if (locale === 'ko') {
      if (type === 'water') return '물주기';
      if (type === 'gift') return '선물';
      return '방문';
    }
    if (type === 'water') return 'watered';
    if (type === 'gift') return 'gifted';
    return 'visited';
  }

  return (
    <Card
      header={<><Icon name="edit_note" size={14} />{t.guestbookTitle}</>}
      headerRight={
        totalWater > 0 ? (
          <span className="opacity-60 flex items-center gap-1">
            <Icon name="water_drop" size={12} />
            {totalWater}
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
                      {typeLabel(entry.type)}
                    </span>
                    <span className="opacity-40">·</span>
                    <span className="opacity-40">{timeAgo(entry.at)}</span>
                  </div>
                  {(() => {
                    let bubbleText: string | null = null;
                    if (entry.type === 'gift' && entry.message) {
                      bubbleText = locale === 'ko' ? `${entry.message} 선물` : `gifted ${entry.message}`;
                    } else if (entry.type === 'water') {
                      bubbleText = entry.message
                        || (locale === 'ko' ? '물을 주고 갔어요' : 'left some water');
                    } else if (entry.message) {
                      bubbleText = entry.message;
                    }
                    return bubbleText ? (
                      <div className="mt-1.5 inline-block max-w-full bg-[var(--bg)] border border-[var(--border)] rounded-2xl rounded-tl-sm px-3 py-2 text-xs break-words">
                        {bubbleText}
                      </div>
                    ) : null;
                  })()}
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
