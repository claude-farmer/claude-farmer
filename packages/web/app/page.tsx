'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

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
    const stages = [2, 3, 4, 6, 4, 3]; // 작물 높이

    const interval = setInterval(() => {
      frameRef.current++;
      const f = frameRef.current;
      ctx.clearRect(0, 0, 128, 96);

      // 하늘
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

      // 풀
      ctx.fillStyle = '#7BC74D';
      ctx.fillRect(0, 36, 128, 60);
      ctx.fillStyle = '#5A9E32';
      for (let x = 0; x < 128; x += 5) {
        for (let y = 36; y < 96; y += 4) {
          ctx.fillRect(x + (y % 3), y, 1, 1);
        }
      }

      // 흙 영역
      ctx.fillStyle = '#8B6914';
      ctx.fillRect(16, 42, 56, 44);
      ctx.fillStyle = '#6B4E0A';
      for (let x = 16; x < 72; x += 3) {
        for (let y = 42; y < 86; y += 3) {
          ctx.fillRect(x + (y % 2), y, 1, 1);
        }
      }

      // 작물
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

      // 캐릭터
      const bounce = f % 40 < 20 ? 0 : -1;
      const charX = 84;
      const charY = 56 + bounce;
      ctx.fillStyle = '#5C3A1E'; // 머리
      ctx.fillRect(charX, charY, 6, 3);
      ctx.fillStyle = '#FFD5B8'; // 얼굴
      ctx.fillRect(charX + 1, charY + 3, 4, 3);
      ctx.fillStyle = '#3E2723'; // 눈
      ctx.fillRect(charX + 1, charY + 4, 1, 1);
      ctx.fillRect(charX + 4, charY + 4, 1, 1);
      ctx.fillStyle = '#6C9BD2'; // 옷
      ctx.fillRect(charX, charY + 6, 6, 4);
      ctx.fillStyle = '#5B7A9E'; // 바지
      ctx.fillRect(charX + 1, charY + 10, 2, 2);
      ctx.fillRect(charX + 3, charY + 10, 2, 2);

      // 별 (밤)
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

const FEATURES = [
  { icon: '🌱', title: '자동 성장', desc: 'Claude Code를 쓰기만 하면 농장이 자동으로 자라요' },
  { icon: '🎲', title: '가챠 수집', desc: '수확할 때마다 가챠! 24종 아이템 도감을 채워보세요' },
  { icon: '💧', title: '소셜', desc: '다른 개발자 농장에 놀러가서 물도 줄 수 있어요' },
  { icon: '🎨', title: '픽셀아트', desc: '귀엽고 따뜻한 16×16 픽셀아트. 시간대별 배경 변화' },
];

const STEPS = [
  { num: '1', text: 'npm install -g claude-farmer' },
  { num: '2', text: 'claude-farmer init' },
  { num: '3', text: 'Claude Code를 쓰면 자동으로 농장이 자라요!' },
];

export default function Landing() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      // TODO: 이메일 수집 API 연동
      setSubscribed(true);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 flex flex-col items-center gap-16">
      {/* 히어로 */}
      <section className="text-center flex flex-col items-center gap-6">
        <h1 className="text-4xl font-bold">
          🌱 Claude Farmer
        </h1>
        <p className="text-xl text-[var(--text)] opacity-70">
          Your code grows a farm.
        </p>
        <p className="text-sm opacity-50 max-w-md">
          Claude Code를 쓰면 농장이 자동으로 자라는 방치형 픽셀아트 농장 게임.
          코딩하면 씨앗이 심기고, 대화할수록 자라고, 수확하면 가챠!
        </p>

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
            데모 보기 →
          </Link>
        </div>
      </section>

      {/* 기능 소개 */}
      <section className="w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FEATURES.map(f => (
            <div key={f.title} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
              <div className="text-2xl mb-2">{f.icon}</div>
              <h3 className="font-bold mb-1">{f.title}</h3>
              <p className="text-sm opacity-60">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 시작하기 */}
      <section className="w-full text-center">
        <h2 className="text-2xl font-bold mb-6">시작하기</h2>
        <div className="flex flex-col gap-4 max-w-md mx-auto">
          {STEPS.map(s => (
            <div key={s.num} className="flex items-center gap-4 bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
              <div className="w-8 h-8 rounded-full bg-[var(--accent)] text-black flex items-center justify-center font-bold text-sm shrink-0">
                {s.num}
              </div>
              <code className="text-sm text-left">{s.text}</code>
            </div>
          ))}
        </div>
      </section>

      {/* 가챠 미리보기 */}
      <section className="w-full text-center">
        <h2 className="text-2xl font-bold mb-2">수확하면 가챠!</h2>
        <p className="text-sm opacity-50 mb-6">24종 아이템을 수집해보세요</p>
        <div className="flex justify-center gap-6 text-sm">
          <div>
            <div className="w-12 h-12 rounded-lg bg-gray-500/20 border border-gray-500 flex items-center justify-center mb-1">🪨</div>
            <span className="text-gray-400">Common</span>
            <div className="text-xs opacity-40">60%</div>
          </div>
          <div>
            <div className="w-12 h-12 rounded-lg bg-blue-500/20 border border-blue-500 flex items-center justify-center mb-1">🐱</div>
            <span className="text-blue-400">Rare</span>
            <div className="text-xs opacity-40">28%</div>
          </div>
          <div>
            <div className="w-12 h-12 rounded-lg bg-purple-500/20 border border-purple-500 flex items-center justify-center mb-1">⛲</div>
            <span className="text-purple-400">Epic</span>
            <div className="text-xs opacity-40">10%</div>
          </div>
          <div>
            <div className="w-12 h-12 rounded-lg bg-yellow-500/20 border border-yellow-500 flex items-center justify-center mb-1">🦄</div>
            <span className="text-yellow-400">Legendary</span>
            <div className="text-xs opacity-40">2%</div>
          </div>
        </div>
      </section>

      {/* 이메일 구독 */}
      <section className="w-full text-center">
        <h2 className="text-2xl font-bold mb-2">업데이트 소식 받기</h2>
        <p className="text-sm opacity-50 mb-4">새 기능, 시즌 이벤트 소식을 보내드려요</p>
        {subscribed ? (
          <div className="bg-[var(--success)]/20 border border-[var(--success)] rounded-lg p-4 max-w-sm mx-auto">
            <span className="text-[var(--success)]">✅ 구독 완료! 소식을 보내드릴게요.</span>
          </div>
        ) : (
          <form onSubmit={handleSubscribe} className="flex gap-2 max-w-sm mx-auto">
            <input
              type="email"
              placeholder="이메일 주소"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
            />
            <button
              type="submit"
              className="bg-[var(--accent)] text-black font-bold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity text-sm"
            >
              구독
            </button>
          </form>
        )}
      </section>

      {/* 푸터 */}
      <footer className="text-center text-xs opacity-30 pb-8">
        <div className="flex gap-4 justify-center mb-2">
          <a href="https://github.com/claude-farmer/claude-farmer" target="_blank" rel="noopener noreferrer" className="hover:opacity-60">GitHub</a>
          <a href="https://www.npmjs.com/package/claude-farmer" target="_blank" rel="noopener noreferrer" className="hover:opacity-60">npm</a>
        </div>
        <p>MIT License · Made with 🌱 by farmers who code</p>
      </footer>
    </div>
  );
}
