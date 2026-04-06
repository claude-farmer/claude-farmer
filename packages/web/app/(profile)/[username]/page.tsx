'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import FarmCanvas, { type FarmCanvasHandle } from '@/components/FarmCanvas';
import GuestbookPanel from '@/components/GuestbookPanel';
import GiftPicker from '@/components/GiftPicker';
import BagView from '@/components/BagView';
import { fetchSession, fetchFarmWithFootprints, waterUser, visitFarm, sendGift, waveSurf } from '@/lib/api';
import { useLocale } from '@/lib/locale-context';
import { WATER_COOLDOWN_SECONDS, GRID_SIZE, getFarmerTitle, GACHA_ITEMS, getItemCounts, RARITY_COLOR } from '@claude-farmer/shared';
import type { PublicProfile, Footprint, InventoryItem } from '@claude-farmer/shared';

// 아이템 이모지 (BagView에서 재사용)
const ITEM_EMOJI: Record<string, string> = {
  c01: '🪨', c02: '🌿', c03: '🌾', c04: '🪱', c05: '🚿', c06: '🏗️', c07: '🧱', c08: '🌱', c09: '🍄',
  c10: '🐤', c11: '💥', c12: '📝',
  r01: '🐱', r02: '🐶', r03: '🌸', r04: '💧', r05: '🪑', r06: '📮', r07: '🔦', r08: '🤖', r09: '☕',
  e01: '⛲', e02: '🌀', e03: '🍎', e04: '🐰', e05: '🌈', e06: '📚', e07: '🌳',
  l01: '🌻', l02: '🦄', l03: '🌌', l04: '✨',
};

export default function FarmProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const canvasRef = useRef<FarmCanvasHandle>(null);

  const [username, setUsername] = useState('');
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [footprints, setFootprints] = useState<Footprint[]>([]);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // 인터랙션 상태
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [watering, setWatering] = useState(false);
  const [showGiftPicker, setShowGiftPicker] = useState(false);
  const [showCodex, setShowCodex] = useState(false);
  const [guestbookKey, setGuestbookKey] = useState(0);
  const [userInventory, setUserInventory] = useState<InventoryItem[]>([]);

  useEffect(() => {
    params.then(p => setUsername(p.username));
  }, [params]);

  useEffect(() => {
    if (!username) return;
    async function init() {
      const session = await fetchSession();
      if (session) setCurrentUser(session.github_id);

      // 자기 농장이면 자기 데이터 로드
      const data = await fetchFarmWithFootprints(username);
      if (!data) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setProfile(data);
      setFootprints(data.footprints ?? []);

      // 자기 인벤토리 로드 (선물용)
      if (session && session.github_id !== username) {
        const myFarm = await fetchFarmWithFootprints(session.github_id);
        if (myFarm?.inventory) setUserInventory(myFarm.inventory);
        visitFarm(username);
      }

      setLoading(false);
    }
    init();
  }, [username]);

  // 쿨다운 타이머
  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const timer = setInterval(() => {
      setCooldownLeft(p => p <= 1 ? 0 : p - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownLeft]);

  const isOwn = currentUser === username;
  const isLoggedIn = !!currentUser;

  const handleWater = async () => {
    if (cooldownLeft > 0 || watering || !profile) return;
    setWatering(true);
    const result = await waterUser(username);
    if (result.ok) {
      setCooldownLeft(result.cooldown_seconds ?? WATER_COOLDOWN_SECONDS);
      const slots = profile.farm_snapshot.grid.map((s, i) => s ? i : -1).filter(i => i >= 0);
      const slot = slots.length > 0 ? slots[Math.floor(Math.random() * slots.length)] : Math.floor(Math.random() * GRID_SIZE);
      canvasRef.current?.triggerWaterAnim(slot);
      setGuestbookKey(k => k + 1);
    } else if (result.cooldown_remaining) {
      setCooldownLeft(result.cooldown_remaining);
    }
    setWatering(false);
  };

  const handleGift = async (itemId: string) => {
    const result = await sendGift(username, itemId);
    if (result.ok) {
      setShowGiftPicker(false);
      setGuestbookKey(k => k + 1);
    }
  };

  // Not Found
  if (notFound) {
    return (
      <div className="max-w-md mx-auto min-h-screen flex flex-col bg-[var(--bg)] shadow-2xl border-x border-[var(--border)]">
        <header className="sticky top-0 z-50 bg-[var(--bg)] border-b border-[var(--border)] px-4 py-2">
          <Link href="/" className="text-sm font-bold">🌱 Claude Farmer</Link>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4">
          <div className="text-5xl">🌾</div>
          <h1 className="text-xl font-bold">@{username}</h1>
          <p className="text-sm opacity-50">
            {locale === 'ko' ? '아직 농장을 시작하지 않았어요' : 'hasn\'t started farming yet'}
          </p>
          <button
            onClick={() => {
              const url = `https://claudefarmer.com/@${username}`;
              if (navigator.share) navigator.share({ title: `@${username}'s Farm`, url });
              else { navigator.clipboard.writeText(url); alert(locale === 'ko' ? '링크 복사됨!' : 'Link copied!'); }
            }}
            className="bg-[var(--accent)] text-black font-bold px-6 py-3 rounded-lg text-sm"
          >
            {locale === 'ko' ? '초대 링크 복사' : 'Copy invite link'}
          </button>
          <Link href="/" className="text-xs opacity-40 hover:opacity-70">
            {locale === 'ko' ? '나도 농장 시작하기' : 'Start my own farm'}
          </Link>
        </div>
      </div>
    );
  }

  if (loading || !profile) {
    return (
      <div className="max-w-md mx-auto min-h-screen flex items-center justify-center bg-[var(--bg)] shadow-2xl border-x border-[var(--border)]">
        <div className="text-4xl animate-bounce">🌱</div>
      </div>
    );
  }

  const itemCounts = getItemCounts(profile.inventory ?? []);
  const uniqueItems = new Set((profile.inventory ?? []).map(i => i.id)).size;
  const farmerTitle = getFarmerTitle(profile.today_input_chars ?? 0);

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col bg-[var(--bg)] shadow-2xl border-x border-[var(--border)]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[var(--bg)] border-b border-[var(--border)]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2 text-sm">
            <img src={profile.avatar_url} alt="" className="w-7 h-7 rounded-full border border-[var(--border)]" />
            <span className="font-bold">{profile.nickname}</span>
            <span className="text-xs opacity-30">Lv.{profile.level}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/explore" className="text-lg opacity-50 hover:opacity-100">🔍</Link>
            {isLoggedIn && !isOwn && (
              <button onClick={async () => {
                const next = await waveSurf(username, currentUser);
                if (next) router.push(`/@${next}`);
              }} className="text-lg opacity-50 hover:opacity-100" title="Wave Surf">🌊</button>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Farm Canvas */}
        <div className="border-b border-[var(--border)]">
          <FarmCanvas
            ref={canvasRef}
            grid={profile.farm_snapshot.grid}
            footprints={footprints}
            farmOwnerId={username}
            clickToMove={isOwn}
            ownerNickname={profile.nickname}
            ownerLevel={profile.level}
            ownerStatusText={profile.status_message?.text}
            ownerStatusLink={profile.status_message?.link}
            ownerTotalHarvests={profile.total_harvests}
            ownerUniqueItems={uniqueItems}
            ownerCharacter={profile.character}
            ownerAvatarUrl={profile.avatar_url}
            decorations={GACHA_ITEMS.filter(item => (itemCounts.get(item.id) ?? 0) > 0).map(item => ({ itemId: item.id, count: itemCounts.get(item.id) ?? 0, rarity: item.rarity }))}
            streakDays={profile.streak_days}
          />
        </div>

        {/* Status */}
        {profile.status_message?.text && (
          <div className="px-4 py-2 border-b border-[var(--border)] text-sm">
            <span>💬 {profile.status_message.text}</span>
            {profile.status_message.link && /^https?:\/\//i.test(profile.status_message.link) && (
              <a href={profile.status_message.link} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--accent)] ml-2 hover:underline">
                🔗 {profile.status_message.link}
              </a>
            )}
          </div>
        )}

        {/* Action Bar */}
        <div className="flex gap-2 px-4 py-3 border-b border-[var(--border)]">
          {isOwn ? (
            <>
              <button onClick={() => {
                const url = `https://claudefarmer.com/@${username}`;
                if (navigator.share) navigator.share({ title: `${profile.nickname}'s Farm`, url });
                else { navigator.clipboard.writeText(url); alert(locale === 'ko' ? '링크 복사됨!' : 'Link copied!'); }
              }} className="flex-1 text-xs font-bold py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors">
                🔗 {locale === 'ko' ? '공유' : 'Share'}
              </button>
              <button onClick={() => setShowCodex(true)} className="flex-1 text-xs font-bold py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors">
                📖 {locale === 'ko' ? '도감' : 'Codex'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleWater}
                disabled={cooldownLeft > 0 || watering || !isLoggedIn}
                className="flex-1 text-xs font-bold py-2 rounded-lg bg-blue-500 text-white disabled:opacity-40 transition-all"
              >
                {cooldownLeft > 0 ? `💧 ${Math.floor(cooldownLeft/60)}:${(cooldownLeft%60).toString().padStart(2,'0')}` : `💧 ${t.visitWater}`}
              </button>
              {isLoggedIn && (
                <button onClick={() => setShowGiftPicker(true)} className="text-xs font-bold py-2 px-3 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-pink-400 transition-colors">
                  🎁
                </button>
              )}
              {!isLoggedIn && (
                <a href="/api/auth/login" className="flex-1 text-xs font-bold py-2 rounded-lg bg-[var(--accent)] text-black text-center">
                  {t.loginBtn}
                </a>
              )}
            </>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 px-4 py-3 text-xs">
          <div className="bg-[var(--card)] rounded-lg p-2 border border-[var(--border)]">
            <span className="opacity-50">📦</span> <span className="font-bold">{uniqueItems}/32</span>
          </div>
          <div className="bg-[var(--card)] rounded-lg p-2 border border-[var(--border)]">
            <span className="opacity-50">🪙</span> <span className="font-bold">{profile.total_harvests}</span>
          </div>
          {(profile.streak_days ?? 0) > 0 && (
            <div className="bg-[var(--card)] rounded-lg p-2 border border-[var(--border)]">
              <span className="opacity-50">🔥</span> <span className="font-bold">{profile.streak_days}{locale === 'ko' ? '일' : 'd'}</span>
            </div>
          )}
          <div className="bg-[var(--card)] rounded-lg p-2 border border-[var(--border)]">
            <span>{farmerTitle.emoji}</span> <span className="font-bold">{locale === 'ko' ? farmerTitle.ko : farmerTitle.en}</span>
          </div>
        </div>

        {/* Compact Codex (own farm only) */}
        {isOwn && (profile.inventory ?? []).length > 0 && (
          <div className="px-4 py-2 border-t border-[var(--border)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold opacity-50">📖 {locale === 'ko' ? '수집' : 'Collected'}</span>
              <button onClick={() => setShowCodex(true)} className="text-xs text-[var(--accent)]">
                {locale === 'ko' ? '전체보기 →' : 'View all →'}
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {GACHA_ITEMS.filter(item => itemCounts.has(item.id)).slice(0, 16).map(item => (
                <span key={item.id} className="text-sm" title={item.name}>
                  {ITEM_EMOJI[item.id] ?? '?'}
                </span>
              ))}
              {uniqueItems > 16 && <span className="text-xs opacity-40">+{uniqueItems - 16}</span>}
            </div>
          </div>
        )}

        {/* Guestbook */}
        <div className="px-4 py-3">
          <GuestbookPanel
            farmId={username}
            refreshKey={guestbookKey}
            onVisitUser={(id) => router.push(`/@${id}`)}
          />
        </div>
      </div>

      {/* Codex Modal */}
      {showCodex && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={() => setShowCodex(false)}>
          <div className="bg-[var(--bg)] w-full max-w-md rounded-t-xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-[var(--bg)] border-b border-[var(--border)] px-4 py-2 flex justify-between items-center">
              <span className="font-bold text-sm">📖 {locale === 'ko' ? '도감' : 'Codex'}</span>
              <button onClick={() => setShowCodex(false)} className="text-xs opacity-40">✕</button>
            </div>
            <BagView inventory={profile.inventory ?? []} />
          </div>
        </div>
      )}

      {/* Gift Picker */}
      {showGiftPicker && (
        <GiftPicker inventory={userInventory} onGift={handleGift} onClose={() => setShowGiftPicker(false)} />
      )}
    </div>
  );
}
