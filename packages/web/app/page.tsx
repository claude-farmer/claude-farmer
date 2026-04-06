'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
      <div
        className="overflow-hidden"
        style={{
          maskImage: 'linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)',
        }}
      >
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto snap-x snap-mandatory px-6 pb-3 items-center"
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

// ── 메인 랜딩 ──
export default function Landing() {
  const { locale, t, setLocale } = useLocale();
  const router = useRouter();
  const [farms, setFarms] = useState<(PublicProfile & { github_id: string })[]>([]);

  useEffect(() => {
    // 로그인 유저 → /farm으로 리다이렉트
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data.user) router.replace('/farm');
      })
      .catch(() => {});

    // 농장 로드
    fetch('/api/explore?exclude=&count=12')
      .then(res => res.ok ? res.json() : [])
      .then(data => setFarms(data))
      .catch(() => {});
  }, [router]);

  const handleVisit = (farmId: string) => {
    router.push(`/farm?visit=${farmId}`);
  };

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col bg-[var(--bg)] shadow-2xl border-x border-[var(--border)]">
      {/* Header */}
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
        {/* 히어로 + 캐러셀 (하나의 블록) */}
        <section className="text-center px-6 pt-10 pb-8">
          <h1 className="text-3xl font-extrabold tracking-tight mb-3">{t.heroTagline}</h1>
          <p className="text-sm opacity-60 max-w-[260px] mx-auto leading-relaxed">{t.heroDesc}</p>
        </section>

        <section className="pb-8">
          <h2 className="text-sm font-bold opacity-50 px-6 mb-2">🌍 {t.liveFarmsTitle}</h2>
          <FarmCarousel farms={farms} onVisit={handleVisit} />
        </section>

        {/* 피처 (배경 틴트로 구분) */}
        <section className="px-6 py-8" style={{ backgroundColor: 'rgba(35,39,54,0.5)' }}>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: '🌱', title: t.feat1Title, desc: t.feat1Desc },
              { icon: '🎲', title: t.feat2Title, desc: t.feat2Desc },
              { icon: '💧', title: t.feat3Title, desc: t.feat3Desc },
              { icon: '🎨', title: t.feat4Title, desc: t.feat4Desc },
            ].map(f => (
              <div key={f.title} className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
                <div className="text-xl mb-1.5">{f.icon}</div>
                <h3 className="text-xs font-bold mb-1">{f.title}</h3>
                <p className="text-xs opacity-40 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 설치 스텝 */}
        <section className="px-6 pt-8 pb-6">
          <h2 className="text-sm font-bold mb-4 text-center">{t.getStarted}</h2>
          <div className="flex flex-col gap-2">
            {[
              { n: '1', t: 'npm install -g claude-farmer' },
              { n: '2', t: 'claude-farmer init' },
              { n: '3', t: t.step3 },
            ].map(s => (
              <div key={s.n} className="flex items-center gap-3 bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2.5">
                <div className="w-6 h-6 rounded-full bg-[var(--accent)] text-black flex items-center justify-center font-bold text-xs shrink-0">
                  {s.n}
                </div>
                <code className="text-xs">{s.t}</code>
              </div>
            ))}
          </div>
        </section>

        {/* 푸터 */}
        <footer className="px-6 pt-6 pb-8 border-t border-[var(--border)] text-xs">
          {/* 플랫폼 */}
          <div className="mb-4">
            <div className="opacity-40 mb-2 font-bold">{t.footerPlatforms}</div>
            <div className="flex gap-2">
              <a href="https://www.npmjs.com/package/claude-farmer" target="_blank" rel="noopener noreferrer"
                className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-center hover:border-[var(--accent)] transition-colors">
                📦 npm (CLI)
              </a>
              <a href="https://marketplace.visualstudio.com/items?itemName=doribear.claude-farmer-vscode" target="_blank" rel="noopener noreferrer"
                className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-center hover:border-[var(--accent)] transition-colors">
                🧩 VSCode
              </a>
              <a href="https://claudefarmer.com" className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-center hover:border-[var(--accent)] transition-colors">
                🌐 Web
              </a>
            </div>
          </div>

          {/* 오픈소스 */}
          <div className="mb-4">
            <a href="https://github.com/claude-farmer/claude-farmer" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 hover:border-[var(--accent)] transition-colors">
              <span>⭐</span>
              <span className="opacity-70">{t.footerOpenSource}</span>
            </a>
          </div>

          {/* 언어 + 라이센스 */}
          <div className="text-center opacity-20">
            <div className="flex gap-2 justify-center mb-1">
              <button onClick={() => setLocale('en')} className={`hover:opacity-60 ${locale === 'en' ? 'underline opacity-100' : ''}`}>EN</button>
              <span>|</span>
              <button onClick={() => setLocale('ko')} className={`hover:opacity-60 ${locale === 'ko' ? 'underline opacity-100' : ''}`}>KO</button>
            </div>
            <p>{t.footerLicense}</p>
          </div>
        </footer>
      </div>

      {/* CTA 하단 고정 */}
      <div className="px-6 pt-3 pb-4 border-t border-[var(--border)] bg-[var(--bg)]" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
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
      </div>
    </div>
  );
}
