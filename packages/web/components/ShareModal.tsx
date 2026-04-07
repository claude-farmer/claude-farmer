'use client';

import { useState, useEffect, useRef } from 'react';
import { useLocale } from '@/lib/locale-context';
import Icon from './Icon';
import ShareCanvas, { type ShareCanvasHandle } from './ShareCanvas';
import type { CharacterAppearance, InventoryItem } from '@claude-farmer/shared';

interface ShareModalProps {
  username: string;
  nickname: string;
  level: number;
  totalHarvests: number;
  uniqueItems: number;
  streakDays: number;
  inventory: InventoryItem[];
  character?: CharacterAppearance;
  statusText?: string;
  onClose: () => void;
}

export default function ShareModal({
  username, nickname, level, totalHarvests, uniqueItems, streakDays, inventory, character, statusText, onClose,
}: ShareModalProps) {
  const { locale } = useLocale();
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const url = `https://claudefarmer.com/@${username}`;
  const shareCanvasRef = useRef<ShareCanvasHandle>(null);

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownload = async () => {
    setDownloading(true);
    const blob = await shareCanvasRef.current?.getBlob();
    if (blob) {
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${username}-farm.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    }
    setDownloading(false);
  };

  const handleNativeShare = async () => {
    const blob = await shareCanvasRef.current?.getBlob();
    if (blob && typeof navigator.canShare === 'function') {
      const file = new File([blob], `${username}-farm.png`, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ title: `${nickname}'s Farm — Claude Farmer`, url, files: [file] });
          return;
        } catch {}
      }
    }
    if (navigator.share) {
      try {
        await navigator.share({ title: `${nickname}'s Farm — Claude Farmer`, url });
      } catch {}
    } else {
      handleCopy();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end justify-center" onClick={onClose}>
      <div
        className="bg-[var(--card)] w-full max-w-md rounded-t-xl max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-[var(--border)]" />
        </div>

        {/* Header */}
        <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]">
          <span className="h-8 flex items-center gap-2 text-sm font-bold flex-1 min-w-0">
            <Icon name="share" size={18} />
            {locale === 'ko' ? '공유' : 'Share'}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 h-8 w-8 flex items-center justify-center border border-[var(--border)] rounded-lg hover:bg-[var(--bg)] hover:border-[var(--accent)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Share preview (client canvas) */}
          <div className="px-4 py-2">
            <ShareCanvas
              ref={shareCanvasRef}
              username={username}
              nickname={nickname}
              level={level}
              totalHarvests={totalHarvests}
              uniqueItems={uniqueItems}
              streakDays={streakDays}
              inventory={inventory}
              character={character}
              statusText={statusText}
            />
          </div>

          {/* URL */}
          <div className="px-4 py-2">
            <div className="bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs font-mono opacity-70 truncate">
              {url}
            </div>
          </div>

          {/* Action buttons */}
          <div className="px-4 py-3 grid grid-cols-3 gap-2">
            <button
              onClick={handleCopy}
              className="flex flex-col items-center gap-1 bg-[var(--accent)] text-black font-bold py-3 rounded-lg text-xs hover:opacity-90 transition-opacity"
            >
              <Icon name={copied ? 'check' : 'content_copy'} size={20} />
              <span>{copied ? (locale === 'ko' ? '복사됨' : 'Copied') : (locale === 'ko' ? '복사' : 'Copy')}</span>
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex flex-col items-center gap-1 bg-[var(--card)] border border-[var(--border)] font-bold py-3 rounded-lg text-xs hover:border-[var(--accent)] transition-colors disabled:opacity-40"
            >
              <Icon name="download" size={20} />
              <span>{locale === 'ko' ? '저장' : 'Save'}</span>
            </button>
            <button
              onClick={handleNativeShare}
              className="flex flex-col items-center gap-1 bg-[var(--card)] border border-[var(--border)] font-bold py-3 rounded-lg text-xs hover:border-[var(--accent)] transition-colors"
            >
              <Icon name="ios_share" size={20} />
              <span>{locale === 'ko' ? '공유' : 'Share'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
