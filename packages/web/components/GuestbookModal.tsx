'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchGuestbook, clearGuestbook, deleteGuestbookEntry, toggleGuestbookLike } from '@/lib/api';
import { useLocale } from '@/lib/locale-context';
import Icon from './Icon';
import { GuestbookEntryItem } from './GuestbookPanel';
import type { GuestbookEntry } from '@claude-farmer/shared';

interface GuestbookModalProps {
  farmId: string;
  isOwner?: boolean;
  refreshKey?: number;
  onClose: () => void;
}

export default function GuestbookModal({ farmId, isOwner, refreshKey, onClose }: GuestbookModalProps) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const [entries, setEntries] = useState<GuestbookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    fetchGuestbook(farmId).then(data => {
      setEntries(data.entries);
      setLoading(false);
    });
  }, [farmId, refreshKey]);

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleVisit = (id: string) => {
    onClose();
    router.push(`/@${id}`);
  };

  const handleClearAll = async () => {
    const confirmMsg = locale === 'ko' ? '방명록을 전체 삭제할까요?' : 'Clear all guestbook entries?';
    if (!confirm(confirmMsg)) return;
    setClearing(true);
    const ok = await clearGuestbook(farmId);
    if (ok) setEntries([]);
    setClearing(false);
  };

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

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end justify-center" onClick={onClose}>
      <div
        className="bg-[var(--bg)] w-full max-w-md rounded-t-xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="shrink-0 flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-[var(--border)]" />
        </div>

        {/* Header */}
        <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]">
          <span className="h-8 flex items-center gap-2 text-sm font-bold flex-1 min-w-0">
            <Icon name="edit_note" size={18} />
            {t.guestbookTitle}
            {entries.length > 0 && (
              <span className="text-xs opacity-50 font-normal">({entries.length})</span>
            )}
          </span>

          {/* 전체 삭제 (주인 전용) */}
          {isOwner && entries.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              disabled={clearing}
              title={locale === 'ko' ? '전체 삭제' : 'Clear all'}
              className="shrink-0 h-8 px-2 flex items-center gap-1 text-xs opacity-50 hover:opacity-100 hover:text-rose-400 border border-transparent hover:border-[var(--border)] rounded-lg transition-all disabled:opacity-30"
            >
              <Icon name="delete_sweep" size={16} />
              {locale === 'ko' ? '전체 삭제' : 'Clear all'}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 h-8 w-8 flex items-center justify-center border border-[var(--border)] rounded-lg hover:bg-[var(--card)] hover:border-[var(--accent)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {loading ? (
            <div className="text-center py-8 opacity-40 text-sm">{t.loading}</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 opacity-40 text-sm">{t.guestbookEmpty}</div>
          ) : (
            <div className="space-y-4">
              {entries.map((entry, i) => (
                <GuestbookEntryItem
                  key={i}
                  entry={entry}
                  onVisitUser={handleVisit}
                  isOwner={isOwner}
                  onDelete={handleDelete}
                  onLike={handleLike}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
