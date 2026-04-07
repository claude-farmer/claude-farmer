'use client';

import { useState, useEffect } from 'react';
import { useLocale } from '@/lib/locale-context';
import Icon from './Icon';
import type { StatusMessage } from '@claude-farmer/shared';

interface StatusEditModalProps {
  current: StatusMessage | null;
  onSave: (text: string, link?: string) => void | Promise<void>;
  onClose: () => void;
}

export default function StatusEditModal({ current, onSave, onClose }: StatusEditModalProps) {
  const { t, locale } = useLocale();
  const [text, setText] = useState(current?.text ?? '');
  const [link, setLink] = useState(current?.link ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleSave = async () => {
    setSaving(true);
    const trimmed = link.trim();
    const cleanLink = trimmed
      ? (/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
      : undefined;
    await onSave(text, cleanLink);
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={onClose}>
      <div
        className="bg-[var(--card)] w-full max-w-md rounded-t-xl"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-[var(--border)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)]">
          <span className="font-bold text-sm flex items-center gap-2">
            <Icon name="edit" size={18} />
            {locale === 'ko' ? '정보 수정' : 'Edit Profile'}
          </span>
          <button onClick={onClose} className="opacity-40 hover:opacity-100">
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Form */}
        <div className="p-4 flex flex-col gap-3">
          <div>
            <label className="text-xs opacity-60 mb-1 block">{locale === 'ko' ? '상태 메시지' : 'Status'}</label>
            <input
              type="text"
              value={text}
              onChange={e => setText(e.target.value)}
              maxLength={200}
              placeholder={t.setBubble}
              autoFocus
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
            />
            <div className="text-xs opacity-30 mt-1 text-right">{text.length}/200</div>
          </div>

          <div>
            <label className="text-xs opacity-60 mb-1 block">{locale === 'ko' ? '링크' : 'Link'} <span className="opacity-50">({locale === 'ko' ? '선택' : 'optional'})</span></label>
            <input
              type="url"
              value={link}
              onChange={e => setLink(e.target.value)}
              placeholder="https://..."
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-4 pb-4">
          <button
            onClick={onClose}
            className="flex-1 bg-[var(--bg)] border border-[var(--border)] py-2.5 rounded-lg text-sm font-bold hover:opacity-80"
          >
            {locale === 'ko' ? '취소' : 'Cancel'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-[var(--accent)] text-black py-2.5 rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-40"
          >
            {locale === 'ko' ? '저장' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
