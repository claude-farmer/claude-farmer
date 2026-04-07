'use client';

import { useState, useEffect } from 'react';
import { useLocale } from '@/lib/locale-context';

interface ShareModalProps {
  username: string;
  nickname: string;
  onClose: () => void;
}

export default function ShareModal({ username, nickname, onClose }: ShareModalProps) {
  const { locale } = useLocale();
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const url = `https://claudefarmer.com/@${username}`;
  const ogUrl = `/@${username}/og`;

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
    try {
      const res = await fetch(ogUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${username}-farm.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      // fallback: open in new tab
      window.open(ogUrl, '_blank');
    }
    setDownloading(false);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `${nickname}'s Farm — Claude Farmer`, url });
      } catch {}
    } else {
      handleCopy();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={onClose}>
      <div
        className="bg-[var(--card)] w-full max-w-md rounded-t-xl max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-[var(--border)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2">
          <span className="font-bold text-sm">🔗 {locale === 'ko' ? '공유' : 'Share'}</span>
          <button onClick={onClose} className="text-xs opacity-40 hover:opacity-100">✕</button>
        </div>

        {/* OG Preview */}
        <div className="px-4 py-2">
          <div className="rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--bg)]">
            <img
              src={ogUrl}
              alt={`${nickname}'s farm`}
              className="w-full h-auto block"
              loading="lazy"
            />
          </div>
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
            className="bg-[var(--accent)] text-black font-bold py-3 rounded-lg text-xs hover:opacity-90 transition-opacity"
          >
            {copied ? '✓' : '📋'}
            <div className="mt-0.5">{copied ? (locale === 'ko' ? '복사됨' : 'Copied') : (locale === 'ko' ? '복사' : 'Copy')}</div>
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="bg-[var(--card)] border border-[var(--border)] font-bold py-3 rounded-lg text-xs hover:border-[var(--accent)] transition-colors disabled:opacity-40"
          >
            ⬇️
            <div className="mt-0.5">{locale === 'ko' ? '저장' : 'Save'}</div>
          </button>
          <button
            onClick={handleNativeShare}
            className="bg-[var(--card)] border border-[var(--border)] font-bold py-3 rounded-lg text-xs hover:border-[var(--accent)] transition-colors"
          >
            📤
            <div className="mt-0.5">{locale === 'ko' ? '공유' : 'Share'}</div>
          </button>
        </div>
      </div>
    </div>
  );
}
