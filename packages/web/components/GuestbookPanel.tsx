'use client';

import { useState, useEffect } from 'react';
import { fetchGuestbook, deleteGuestbookEntry, toggleGuestbookLike } from '@/lib/api';
import { useLocale } from '@/lib/locale-context';
import Icon from './Icon';
import Card from './Card';
import { GACHA_ITEMS } from '@claude-farmer/shared';
import type { GuestbookEntry } from '@claude-farmer/shared';
import type { ReactNode } from 'react';

interface GuestbookPanelProps {
  farmId: string;
  isOwner?: boolean;
  refreshKey?: number;
  onVisitUser?: (userId: string) => void;
  onOpenRankings?: (tab: 'water' | 'gifts') => void;
  onOpenAll?: () => void;
  limit?: number;
  footer?: ReactNode;
  hint?: ReactNode;
}

export function useTimeAgo() {
  const { t } = useLocale();
  return function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t.guestbookJustNow;
    if (mins < 60) return `${mins}${t.guestbookMinAgo}`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}${t.guestbookHourAgo}`;
    const days = Math.floor(hours / 24);
    return `${days}${t.guestbookDayAgo}`;
  };
}

export function guestbookTypeIcon(type: string): string {
  if (type === 'water') return 'water_drop';
  if (type === 'gift') return 'redeem';
  return 'directions_walk';
}

export function guestbookTypeLabel(entry: GuestbookEntry, locale: 'ko' | 'en'): string {
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

export function GuestbookEntryItem({
  entry, breakdown, onVisitUser, isOwner, onDelete, onLike,
}: {
  entry: GuestbookEntry;
  breakdown?: Record<string, number>;
  onVisitUser?: (userId: string) => void;
  isOwner?: boolean;
  onDelete?: (entry: GuestbookEntry) => void;
  onLike?: (entry: GuestbookEntry) => void;
}) {
  const { locale } = useLocale();
  const timeAgo = useTimeAgo();

  const types = breakdown ? Object.keys(breakdown).filter(k => breakdown[k] > 0) : [entry.type];
  const totalCount = breakdown ? Object.values(breakdown).reduce((a, b) => a + b, 0) : 1;
  const singleAction = types.length === 1 && totalCount === 1;

  return (
    <div className="group flex gap-2.5 items-start">
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
          {singleAction ? (
            <span className="inline-flex items-center gap-0.5 opacity-60">
              <Icon name={guestbookTypeIcon(entry.type)} size={11} filled={entry.type === 'water'} />
              {guestbookTypeLabel(entry, locale)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 opacity-60">
              {types.map(type => (
                <span key={type} className="inline-flex items-center gap-0.5">
                  <Icon name={guestbookTypeIcon(type)} size={11} filled={type === 'water'} />
                  {(breakdown?.[type] ?? 1) > 1 && <span className="text-[10px] font-bold">×{breakdown?.[type]}</span>}
                </span>
              ))}
            </span>
          )}
          <span className="opacity-40">·</span>
          <span className="opacity-40">{timeAgo(entry.at)}</span>

          {/* 주인 전용 액션 */}
          {isOwner && (
            <span className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => onLike?.(entry)}
                title="Like"
                className={`h-5 w-5 flex items-center justify-center rounded hover:bg-[var(--card)] transition-colors ${entry.liked ? 'text-rose-400' : 'opacity-50 hover:opacity-100'}`}
              >
                <Icon name="favorite" size={13} filled={!!entry.liked} />
              </button>
              <button
                type="button"
                onClick={() => onDelete?.(entry)}
                title="Delete"
                className="h-5 w-5 flex items-center justify-center rounded opacity-50 hover:opacity-100 hover:text-rose-400 hover:bg-[var(--card)] transition-colors"
              >
                <Icon name="delete" size={13} />
              </button>
            </span>
          )}
        </div>
        {(entry.message || entry.link) && (
          <div className="mt-1.5 inline-block max-w-full bg-[var(--bg)] border border-[var(--border)] rounded-2xl rounded-tl-sm overflow-hidden">
            {entry.message && (
              <div className="px-4 py-3 break-words text-sm leading-relaxed">
                {entry.message}
              </div>
            )}
            {entry.link && (
              <a
                href={/^https?:\/\//i.test(entry.link) ? entry.link : `https://${entry.link}`}
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
  );
}

export default function GuestbookPanel({
  farmId, isOwner, refreshKey, onVisitUser, onOpenRankings, onOpenAll, limit = 5, footer, hint,
}: GuestbookPanelProps) {
  const { t } = useLocale();
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

  const handleDelete = async (entry: GuestbookEntry) => {
    const ok = await deleteGuestbookEntry(farmId, entry.at, entry.from_id);
    if (ok) setEntries(prev => prev.filter(e => e.at !== entry.at || e.from_id !== entry.from_id));
  };

  const handleLike = async (entry: GuestbookEntry) => {
    const liked = await toggleGuestbookLike(farmId, entry.at);
    if (liked !== null) {
      setEntries(prev => prev.map(e =>
        e.at === entry.at && e.from_id === entry.from_id ? { ...e, liked } : e
      ));
    }
  };

  // 연속된 동일 사용자 + 동일 메시지/링크 그룹핑
  const grouped: { entry: GuestbookEntry; counts: Record<string, number> }[] = [];
  for (const e of entries) {
    const last = grouped[grouped.length - 1];
    if (
      last &&
      last.entry.from_id === e.from_id &&
      last.entry.message === e.message &&
      last.entry.link === e.link
    ) {
      last.counts[e.type] = (last.counts[e.type] ?? 0) + 1;
    } else {
      grouped.push({ entry: e, counts: { [e.type]: 1 } });
    }
  }
  const visible = grouped.slice(0, limit);

  return (
    <Card
      header={<><Icon name="edit_note" size={14} />{t.guestbookTitle}</>}
      headerRight={
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
          {entries.length > 0 && (
            <button
              type="button"
              onClick={() => onOpenAll?.()}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-[var(--bg)] opacity-60 hover:opacity-100 transition-all"
            >
              <Icon name="edit_note" size={12} />
              {entries.length}
            </button>
          )}
        </span>
      }
      bodyClassName=""
      footer={footer}
    >
      <div className="px-3 py-3">
        {loading ? (
          <div className="text-center py-4 opacity-40 text-sm">{t.loading}</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-4 opacity-40 text-sm">{t.guestbookEmpty}</div>
        ) : (
          <div className="space-y-4">
            {visible.map((g, i) => (
              <GuestbookEntryItem
                key={i}
                entry={g.entry}
                breakdown={g.counts}
                onVisitUser={onVisitUser}
                isOwner={isOwner}
                onDelete={handleDelete}
                onLike={handleLike}
              />
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
