'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useLocale } from '@/lib/locale-context';
import FarmThumbnail from '@/components/FarmThumbnail';
import type { PublicProfile } from '@claude-farmer/shared';

// ── 농장 카드 캐러셀 ──
function FarmCarousel({ farms, onVisit }: {
  farms: (PublicProfile & { github_id: string })[];
  onVisit: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (!autoScroll || farms.length <= 2) return;
    const el = scrollRef.current;
    if (!el) return;
    const interval = setInterval(() => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (el.scrollLeft >= maxScroll - 5) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        el.scrollBy({ left: 200, behavior: 'smooth' });
      }
    }, 3500);
    return () => clearInterval(interval);
  }, [autoScroll, farms.length]);

  if (farms.length === 0) return null;

  return (
    <div className="w-full relative">
      {/* 그라데이션 마스크 (양끝 페이드) */}
      <div
        className="overflow-hidden"
        style={{
          maskImage: 'linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)',
        }}
      >
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto snap-x snap-mandatory px-8 pb-3 items-center"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          onTouchStart={() => setAutoScroll(false)}
          onMouseDown={() => setAutoScroll(false)}
        >
          {farms.map(farm => (
            <button
              key={farm.github_id}
              onClick={() => onVisit(farm.github_id)}
              className="snap-center shrink-0 w-40 bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden hover:border-[var(--accent)] transition-all active:scale-95 text-left"
            >
              {/* 썸네일이 카드 전체를 채움 */}
              <FarmThumbnail
                githubId={farm.github_id}
                character={farm.character}
                level={farm.level}
                totalHarvests={farm.total_harvests}
                uniqueItems={farm.unique_items}
                streakDays={farm.streak_days}
                inventory={farm.inventory}
                className="w-full"
              />
              {/* 닉네임만 간결하게 */}
              <div className="flex items-center gap-1.5 px-2 py-1.5">
                <img
                  src={farm.avatar_url}
                  alt=""
                  className="w-4 h-4 rounded-full border border-[var(--border)]"
                  loading="lazy"
                />
                <span className="text-xs font-bold truncate">{farm.nickname}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 메인 랜딩 (앱 스타일) ──
export default function Landing() {
  const { locale, t, setLocale } = useLocale();
  const [farms, setFarms] = useState<(PublicProfile & { github_id: string })[]>([]);

  useEffect(() => {
    fetch('/api/explore?exclude=&count=12')
      .then(res => res.ok ? res.json() : [])
      .then(data => setFarms(data))
      .catch(() => {});
  }, []);

  const handleVisit = (farmId: string) => {
    window.location.href = `/farm?visit=${farmId}`;
  };

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col bg-[var(--bg)] shadow-2xl border-x border-[var(--border)]">
      {/* Header (앱과 동일한 스타일) */}
      <header className="sticky top-0 z-50 bg-[var(--bg)] border-b border-[var(--border)]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="font-bold text-sm">🌱 Claude Farmer</span>
          <a
            href="/api/auth/login"
            className="text-xs bg-[var(--accent)] text-black px-3 py-1 rounded-full font-bold hover:opacity-90"
          >
            {t.loginBtn}
          </a>
        </div>
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* 히어로 — 간결하게 */}
        <section className="text-center px-4 pt-6 pb-4">
          <h1 className="text-2xl font-bold mb-1">{t.heroTagline}</h1>
          <p className="text-xs opacity-50 max-w-xs mx-auto">{t.heroDesc}</p>
        </section>

        {/* 실제 유저 농장 캐러셀 (첫 번째 eye-catching 요소) */}
        <section className="pb-4">
          <h2 className="text-sm font-bold opacity-50 px-4 mb-2">🌍 {t.liveFarmsTitle}</h2>
          <FarmCarousel farms={farms} onVisit={handleVisit} />
        </section>

        {/* Features — 컴팩트 */}
        <section className="px-4 pb-4">
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: '🌱', title: t.feat1Title, desc: t.feat1Desc },
              { icon: '🎲', title: t.feat2Title, desc: t.feat2Desc },
              { icon: '💧', title: t.feat3Title, desc: t.feat3Desc },
              { icon: '🎨', title: t.feat4Title, desc: t.feat4Desc },
            ].map(f => (
              <div key={f.title} className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
                <div className="text-lg mb-1">{f.icon}</div>
                <h3 className="text-xs font-bold mb-0.5">{f.title}</h3>
                <p className="text-xs opacity-40 leading-tight">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Get Started — 심플 */}
        <section className="px-4 pb-4">
          <h2 className="text-sm font-bold mb-3 text-center">{t.getStarted}</h2>
          <div className="flex flex-col gap-2 max-w-sm mx-auto">
            {[
              { n: '1', t: 'npm install -g claude-farmer' },
              { n: '2', t: 'claude-farmer init' },
              { n: '3', t: t.step3 },
            ].map(s => (
              <div key={s.n} className="flex items-center gap-3 bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2">
                <div className="w-6 h-6 rounded-full bg-[var(--accent)] text-black flex items-center justify-center font-bold text-xs shrink-0">
                  {s.n}
                </div>
                <code className="text-xs">{s.t}</code>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 pb-6">
          <div className="flex gap-2">
            <a
              href="https://www.npmjs.com/package/claude-farmer"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-[var(--accent)] text-black font-bold py-3 rounded-lg text-center text-sm hover:opacity-90 transition-opacity"
            >
              npm install
            </a>
            <Link
              href="/farm"
              className="flex-1 bg-[var(--card)] border border-[var(--border)] text-[var(--text)] font-bold py-3 rounded-lg text-center text-sm hover:border-[var(--accent)] transition-colors"
            >
              {t.demoBtn}
            </Link>
          </div>
        </section>

        {/* Footer — 최소 */}
        <footer className="text-center text-xs opacity-20 px-4 pb-6">
          <div className="flex gap-4 justify-center mb-2">
            <a href="https://github.com/claude-farmer/claude-farmer" target="_blank" rel="noopener noreferrer" className="hover:opacity-60">GitHub</a>
            <a href="https://www.npmjs.com/package/claude-farmer" target="_blank" rel="noopener noreferrer" className="hover:opacity-60">npm</a>
            <a href="https://marketplace.visualstudio.com/items?itemName=doribear.claude-farmer-vscode" target="_blank" rel="noopener noreferrer" className="hover:opacity-60">VSCode</a>
          </div>
          <div className="flex gap-2 justify-center mb-2">
            <button onClick={() => setLocale('en')} className={`hover:opacity-60 ${locale === 'en' ? 'underline opacity-100' : ''}`}>EN</button>
            <span>|</span>
            <button onClick={() => setLocale('ko')} className={`hover:opacity-60 ${locale === 'ko' ? 'underline opacity-100' : ''}`}>KO</button>
          </div>
          <p>{t.footerLicense}</p>
        </footer>
      </div>

      {/* Bottom bar — 앱과 동일한 스타일 */}
      <nav className="flex border-t border-[var(--border)] bg-[var(--card)] sticky bottom-0 z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <Link href="/farm" className="flex-1 py-2 text-center text-sm text-[var(--text)] opacity-50 hover:opacity-75">
          <div className="text-base">🏠</div>
          <div>{t.tabFarm}</div>
        </Link>
        <Link href="/farm" className="flex-1 py-2 text-center text-sm text-[var(--text)] opacity-50 hover:opacity-75">
          <div className="text-base">📖</div>
          <div>{t.tabBag}</div>
        </Link>
        <button className="flex-1 py-2 text-center text-sm text-[var(--accent)]">
          <div className="text-base">🌍</div>
          <div>{t.tabExplore}</div>
        </button>
      </nav>
    </div>
  );
}
