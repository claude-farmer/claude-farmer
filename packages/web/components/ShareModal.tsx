'use client';

import { useState, useEffect } from 'react';
import { useLocale } from '@/lib/locale-context';
import Icon from './Icon';

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
          <span className="font-bold text-sm flex items-center gap-2">
            <Icon name="share" size={18} />
            {locale === 'ko' ? '공유' : 'Share'}
          </span>
          <button onClick={onClose} className="opacity-40 hover:opacity-100">
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* OG Preview (1200×630 비율 유지) */}
        <div className="px-4 py-2">
          <div
            className="rounded-lg overflow-hidden border border-[var(--border)] bg-[#1a1d27] w-full"
            style={{ aspectRatio: '1200 / 630' }}
          >
            <img
              src={ogUrl}
              alt={`${nickname}'s farm`}
              className="w-full h-full object-contain block"
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
  );
}
