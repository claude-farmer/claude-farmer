'use client';

import { useState, useEffect } from 'react';
import { fetchGuestbook } from '@/lib/api';
import { useLocale } from '@/lib/locale-context';
import type { GuestbookEntry } from '@claude-farmer/shared';

interface GuestbookPanelProps {
  farmId: string;
  refreshKey?: number;
  onVisitUser?: (userId: string) => void;
}

export default function GuestbookPanel({ farmId, refreshKey, onVisitUser }: GuestbookPanelProps) {
  const { t } = useLocale();
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

  function typeIcon(type: string) {
    if (type === 'water') return '💧';
    if (type === 'gift') return '🎁';
    return '👣';
  }

  return (
    <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
        <span className="text-sm font-bold">📝 {t.guestbookTitle}</span>
        {totalWater > 0 && (
          <span className="text-xs opacity-60">💧 {t.guestbookTotalWater}: {totalWater}</span>
        )}
      </div>

      {/* Entries */}
      <div className="max-h-64 overflow-y-auto">
        {loading ? (
          <div className="text-center py-4 opacity-40 text-sm">{t.loading}</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-4 opacity-40 text-sm">{t.guestbookEmpty}</div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {entries.map((entry, i) => (
              <div key={i} className="px-3 py-2 flex gap-2 items-start">
                {/* Avatar — 클릭하면 해당 유저 농장 방문 */}
                <button
                  onClick={() => onVisitUser?.(entry.from_id)}
                  className="w-7 h-7 rounded-full bg-[var(--border)] flex-shrink-0 overflow-hidden mt-0.5 hover:ring-2 hover:ring-[var(--accent)] transition-all cursor-pointer"
                >
                  {entry.from_avatar_url && (
                    <img src={entry.from_avatar_url} alt="" className="w-full h-full" />
                  )}
                </button>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">{typeIcon(entry.type)}</span>
                    <button onClick={() => onVisitUser?.(entry.from_id)} className="text-sm font-bold truncate hover:text-[var(--accent)] transition-colors">{entry.from_nickname}</button>
                    <span className="text-xs opacity-40 flex-shrink-0">{timeAgo(entry.at)}</span>
                  </div>
                  {entry.message && (
                    <div className="text-xs opacity-70 mt-0.5 bg-[var(--bg)] rounded px-2 py-1 inline-block">
                      &ldquo;{entry.message}&rdquo;
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
