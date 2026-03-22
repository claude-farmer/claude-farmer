'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useLocale } from '@/lib/locale-context';

function PixelFarmPreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    canvas.width = 128;
    canvas.height = 96;

    const crops = ['#FF8C00', '#EF4444', '#FACC15', '#FF6B81', '#F97316', '#FBB6CE'];
    const stages = [2, 3, 4, 6, 4, 3];

    const interval = setInterval(() => {
      frameRef.current++;
      const f = frameRef.current;
      ctx.clearRect(0, 0, 128, 96);

      const hour = new Date().getHours();
      let skyTop: string, skyBot: string;
      if (hour >= 6 && hour < 11) { skyTop = '#FFF3E0'; skyBot = '#FFCCBC'; }
      else if (hour >= 11 && hour < 17) { skyTop = '#B3E5FC'; skyBot = '#E1F5FE'; }
      else if (hour >= 17 && hour < 21) { skyTop = '#F48FB1'; skyBot = '#FFE082'; }
      else { skyTop = '#0D1B2A'; skyBot = '#1B2838'; }

      const grad = ctx.createLinearGradient(0, 0, 0, 36);
      grad.addColorStop(0, skyTop);
      grad.addColorStop(1, skyBot);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 36);

      ctx.fillStyle = '#7BC74D';
      ctx.fillRect(0, 36, 128, 60);
      ctx.fillStyle = '#5A9E32';
      for (let x = 0; x < 128; x += 5) {
        for (let y = 36; y < 96; y += 4) {
          ctx.fillRect(x + (y % 3), y, 1, 1);
        }
      }

      ctx.fillStyle = '#8B6914';
      ctx.fillRect(16, 42, 56, 44);
      ctx.fillStyle = '#6B4E0A';
      for (let x = 16; x < 72; x += 3) {
        for (let y = 42; y < 86; y += 3) {
          ctx.fillRect(x + (y % 2), y, 1, 1);
        }
      }

      for (let i = 0; i < 6; i++) {
        const row = Math.floor(i / 3);
        const col = i % 3;
        const cx = 24 + col * 16;
        const cy = 52 + row * 18;
        const h = stages[i] + (f % 40 < 20 ? 0 : 1);

        ctx.fillStyle = '#7BC74D';
        ctx.fillRect(cx, cy - h, 2, h);
        ctx.fillRect(cx - 1, cy - h - 1, 4, 2);

        if (stages[i] > 3) {
          ctx.fillStyle = crops[i];
          ctx.fillRect(cx - 1, cy - h + 1, 3, 3);
        }
      }

      const bounce = f % 40 < 20 ? 0 : -1;
      const charX = 84;
      const charY = 56 + bounce;
      ctx.fillStyle = '#5C3A1E';
      ctx.fillRect(charX, charY, 6, 3);
      ctx.fillStyle = '#FFD5B8';
      ctx.fillRect(charX + 1, charY + 3, 4, 3);
      ctx.fillStyle = '#3E2723';
      ctx.fillRect(charX + 1, charY + 4, 1, 1);
      ctx.fillRect(charX + 4, charY + 4, 1, 1);
      ctx.fillStyle = '#6C9BD2';
      ctx.fillRect(charX, charY + 6, 6, 4);
      ctx.fillStyle = '#5B7A9E';
      ctx.fillRect(charX + 1, charY + 10, 2, 2);
      ctx.fillRect(charX + 3, charY + 10, 2, 2);

      if (hour >= 21 || hour < 6) {
        ctx.fillStyle = '#FFFFFF';
        [12, 35, 58, 82, 105].forEach((sx, i) => {
          if (f % 60 < 40 || i % 2 === 0)
            ctx.fillRect(sx, 5 + (i * 7) % 25, 1, 1);
        });
      }
    }, 80);

    return () => clearInterval(interval);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full max-w-sm rounded-xl border-2 border-[var(--border)]"
      style={{ aspectRatio: '128/96', imageRendering: 'pixelated' }}
    />
  );
}

export default function Landing() {
  const { locale, t, setLocale } = useLocale();
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (res.ok) setSubscribed(true);
    }
  };

  const features = [
    { icon: '🌱', title: t.feat1Title, desc: t.feat1Desc },
    { icon: '🎲', title: t.feat2Title, desc: t.feat2Desc },
    { icon: '💧', title: t.feat3Title, desc: t.feat3Desc },
    { icon: '🎨', title: t.feat4Title, desc: t.feat4Desc },
  ];

  const steps = [
    { num: '1', text: 'npm install -g claude-farmer' },
    { num: '2', text: 'claude-farmer init' },
    { num: '3', text: t.step3 },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 flex flex-col items-center gap-16">
      {/* Hero */}
      <section className="text-center flex flex-col items-center gap-6">
        <h1 className="text-4xl font-bold">🌱 Claude Farmer</h1>
        <p className="text-xl text-[var(--text)] opacity-70">{t.heroTagline}</p>
        <p className="text-sm opacity-50 max-w-md">{t.heroDesc}</p>

        <PixelFarmPreview />

        <div className="flex gap-3 flex-wrap justify-center">
          <a
            href="https://www.npmjs.com/package/claude-farmer"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[var(--accent)] text-black font-bold px-6 py-3 rounded-lg hover:opacity-90 transition-opacity"
          >
            npm install -g claude-farmer
          </a>
          <Link
            href="/farm"
            className="bg-[var(--card)] border border-[var(--border)] text-[var(--text)] font-bold px-6 py-3 rounded-lg hover:border-[var(--accent)] transition-colors"
          >
            {t.demoBtn}
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {features.map(f => (
            <div key={f.title} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
              <div className="text-2xl mb-2">{f.icon}</div>
              <h3 className="font-bold mb-1">{f.title}</h3>
              <p className="text-sm opacity-60">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Get Started */}
      <section className="w-full text-center">
        <h2 className="text-2xl font-bold mb-6">{t.getStarted}</h2>
        <div className="flex flex-col gap-4 max-w-md mx-auto">
          {steps.map(s => (
            <div key={s.num} className="flex items-center gap-4 bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
              <div className="w-8 h-8 rounded-full bg-[var(--accent)] text-black flex items-center justify-center font-bold text-sm shrink-0">
                {s.num}
              </div>
              <code className="text-sm text-left">{s.text}</code>
            </div>
          ))}
        </div>
      </section>

      {/* Gacha */}
      <section className="w-full text-center">
        <h2 className="text-2xl font-bold mb-2">{t.gachaTitle}</h2>
        <p className="text-sm opacity-50 mb-6">{t.gachaDesc}</p>
        <div className="flex justify-center gap-6 text-sm">
          {[
            { emoji: '🪨', label: 'Common', pct: '60%', color: 'gray' },
            { emoji: '🐱', label: 'Rare', pct: '28%', color: 'blue' },
            { emoji: '⛲', label: 'Epic', pct: '10%', color: 'purple' },
            { emoji: '🦄', label: 'Legendary', pct: '2%', color: 'yellow' },
          ].map(g => (
            <div key={g.label}>
              <div className={`w-12 h-12 rounded-lg bg-${g.color}-500/20 border border-${g.color}-500 flex items-center justify-center mb-1`}>{g.emoji}</div>
              <span className={`text-${g.color}-400`}>{g.label}</span>
              <div className="text-xs opacity-40">{g.pct}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Subscribe */}
      <section className="w-full text-center">
        <h2 className="text-2xl font-bold mb-2">{t.subscribeTitle}</h2>
        <p className="text-sm opacity-50 mb-4">{t.subscribeDesc}</p>
        {subscribed ? (
          <div className="bg-[var(--success)]/20 border border-[var(--success)] rounded-lg p-4 max-w-sm mx-auto">
            <span className="text-[var(--success)]">{t.subscribeDone}</span>
          </div>
        ) : (
          <form onSubmit={handleSubscribe} className="flex gap-2 max-w-sm mx-auto">
            <input
              type="email"
              placeholder={t.emailPlaceholder}
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
            />
            <button
              type="submit"
              className="bg-[var(--accent)] text-black font-bold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity text-sm"
            >
              {t.subscribeBtn}
            </button>
          </form>
        )}
      </section>

      {/* Footer */}
      <footer className="text-center text-xs opacity-30 pb-8">
        <div className="flex gap-4 justify-center mb-2">
          <a href="https://github.com/claude-farmer/claude-farmer" target="_blank" rel="noopener noreferrer" className="hover:opacity-60">GitHub</a>
          <a href="https://www.npmjs.com/package/claude-farmer" target="_blank" rel="noopener noreferrer" className="hover:opacity-60">npm</a>
          <a href="https://marketplace.visualstudio.com/items?itemName=doribear.claude-farmer-vscode" target="_blank" rel="noopener noreferrer" className="hover:opacity-60">VSCode</a>
        </div>
        <div className="flex gap-2 justify-center mb-2">
          <button
            onClick={() => setLocale('en')}
            className={`hover:opacity-60 ${locale === 'en' ? 'underline opacity-100' : ''}`}
          >EN</button>
          <span>|</span>
          <button
            onClick={() => setLocale('ko')}
            className={`hover:opacity-60 ${locale === 'ko' ? 'underline opacity-100' : ''}`}
          >KO</button>
        </div>
        <p>{t.footerContrib}</p>
        <p className="mt-1">{t.footerLicense}</p>
      </footer>
    </div>
  );
}
