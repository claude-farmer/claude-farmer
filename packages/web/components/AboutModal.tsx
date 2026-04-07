'use client';

import { useEffect } from 'react';
import { useLocale } from '@/lib/locale-context';
import Icon from './Icon';

interface AboutModalProps {
  onClose: () => void;
}

export default function AboutModal({ onClose }: AboutModalProps) {
  const { t, locale } = useLocale();

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={onClose}>
      <div
        className="bg-[var(--bg)] w-full max-w-md rounded-t-xl max-h-[85vh] flex flex-col"
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
            <Icon name="info" size={18} />
            {locale === 'ko' ? '소개' : 'About'}
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

        <div className="flex-1 overflow-y-auto">
        {/* Hero */}
        <section className="text-center px-6 pt-8 pb-6">
          <h1 className="text-2xl font-extrabold tracking-tight mb-3">{t.heroTagline}</h1>
          <p className="text-xs opacity-60 max-w-[260px] mx-auto leading-relaxed">{t.heroDesc}</p>
        </section>

        {/* Features */}
        <section className="px-6 pb-6">
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: '🌱', title: t.feat1Title, desc: t.feat1Desc },
              { icon: '🎲', title: t.feat2Title, desc: t.feat2Desc },
              { icon: '💧', title: t.feat3Title, desc: t.feat3Desc },
              { icon: '🎨', title: t.feat4Title, desc: t.feat4Desc },
            ].map(f => (
              <div key={f.title} className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
                <div className="text-xl mb-2">{f.icon}</div>
                <h3 className="text-xs font-bold mb-1">{f.title}</h3>
                <p className="text-xs opacity-40 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Get Started */}
        <section className="px-6 pb-6">
          <h2 className="text-xs font-bold mb-3 opacity-50">{t.getStarted}</h2>
          <div className="flex flex-col gap-2.5">
            {[
              { n: '1', t: 'npm install -g claude-farmer' },
              { n: '2', t: 'claude-farmer init' },
              { n: '3', t: t.step3 },
            ].map(s => (
              <div key={s.n} className="flex items-center gap-3 bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-3">
                <div className="w-5 h-5 rounded-full bg-[var(--accent)] text-black flex items-center justify-center font-bold text-xs shrink-0">
                  {s.n}
                </div>
                <code className="text-xs">{s.t}</code>
              </div>
            ))}
          </div>
        </section>

        {/* Platforms */}
        <section className="px-6 pb-8">
          <h2 className="text-xs font-bold mb-3 opacity-50">{t.footerPlatforms}</h2>
          <div className="flex gap-2 text-xs">
            <a href="https://www.npmjs.com/package/claude-farmer" target="_blank" rel="noopener noreferrer"
              className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-3 text-center hover:border-[var(--accent)] transition-colors">
              📦 npm
            </a>
            <a href="https://marketplace.visualstudio.com/items?itemName=doribear.claude-farmer-vscode" target="_blank" rel="noopener noreferrer"
              className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-3 text-center hover:border-[var(--accent)] transition-colors">
              🧩 VSCode
            </a>
            <a href="https://github.com/claude-farmer/claude-farmer" target="_blank" rel="noopener noreferrer"
              className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-3 text-center hover:border-[var(--accent)] transition-colors">
              ⭐ GitHub
            </a>
          </div>
        </section>

        {/* License */}
        <div className="text-center text-xs opacity-30 px-6 pb-6">
          <p>{t.footerLicense}</p>
        </div>
        </div>
      </div>
    </div>
  );
}
