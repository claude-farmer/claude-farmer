'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import FarmCanvas, { type FarmCanvasHandle } from '@/components/FarmCanvas';
import GuestbookPanel from '@/components/GuestbookPanel';
import GiftPicker from '@/components/GiftPicker';
import BagView from '@/components/BagView';
import CharacterEditor from '@/components/CharacterEditor';
import MenuDropdown from '@/components/MenuDropdown';
import SearchModal from '@/components/SearchModal';
import ShareModal from '@/components/ShareModal';
import {
  fetchSession, fetchFarmWithFootprints, waterUser, visitFarm, sendGift, waveSurf,
  fetchBookmarks, toggleBookmark, updateStatus, updateCharacter,
} from '@/lib/api';
import usePolling from '@/hooks/usePolling';
import { useLocale } from '@/lib/locale-context';
import {
  WATER_COOLDOWN_SECONDS, GRID_SIZE, getFarmerTitle, GACHA_ITEMS, getItemCounts,
} from '@claude-farmer/shared';
import type { PublicProfile, Footprint, InventoryItem, CharacterAppearance, FarmNotifications } from '@claude-farmer/shared';

const ITEM_EMOJI: Record<string, string> = {
  c01: '🪨', c02: '🌿', c03: '🌾', c04: '🪱', c05: '🚿', c06: '🏗️', c07: '🧱', c08: '🌱', c09: '🍄',
  c10: '🐤', c11: '💥', c12: '📝',
  r01: '🐱', r02: '🐶', r03: '🌸', r04: '💧', r05: '🪑', r06: '📮', r07: '🔦', r08: '🤖', r09: '☕',
  e01: '⛲', e02: '🌀', e03: '🍎', e04: '🐰', e05: '🌈', e06: '📚', e07: '🌳',
  l01: '🌻', l02: '🦄', l03: '🌌', l04: '✨',
};

type ActiveModal = 'none' | 'menu' | 'search' | 'share' | 'codex' | 'character' | 'gift';

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
  const [bookmarkIds, setBookmarkIds] = useState<string[]>([]);

  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [watering, setWatering] = useState(false);
  const [modal, setModal] = useState<ActiveModal>('none');
  const [guestbookKey, setGuestbookKey] = useState(0);
  const [userInventory, setUserInventory] = useState<InventoryItem[]>([]);

  // 상태 메시지 편집
  const [editingStatus, setEditingStatus] = useState(false);
  const [statusDraft, setStatusDraft] = useState('');
  const [linkDraft, setLinkDraft] = useState('');

  useEffect(() => {
    params.then(p => setUsername(p.username));
  }, [params]);

  useEffect(() => {
    if (!username) return;
    async function init() {
      const session = await fetchSession();
      if (session) setCurrentUser(session.github_id);

      const data = await fetchFarmWithFootprints(username);
      if (!data) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setProfile(data);
      setFootprints(data.footprints ?? []);

      if (session) {
        const bm = await fetchBookmarks();
        setBookmarkIds(bm.map(b => b.github_id));

        if (session.github_id !== username) {
          const myFarm = await fetchFarmWithFootprints(session.github_id);
          if (myFarm?.inventory) setUserInventory(myFarm.inventory);
          visitFarm(username);
        } else {
          setUserInventory(data.inventory ?? []);
        }
      }
      setLoading(false);
    }
    init();
  }, [username]);

  const isOwn = currentUser === username && currentUser !== null;
  const isLoggedIn = !!currentUser;

  // 자기 농장 30s polling
  const { data: notifications } = usePolling<FarmNotifications>(
    isOwn ? `/api/farm/${username}/notifications` : null,
    { interval: 30_000, enabled: isOwn }
  );
  const { data: farmPolled } = usePolling<PublicProfile & { footprints: Footprint[] }>(
    isOwn ? `/api/farm/${username}` : null,
    { interval: 30_000, enabled: isOwn }
  );

  useEffect(() => {
    if (farmPolled) {
      if (farmPolled.footprints) setFootprints(farmPolled.footprints);
      if (farmPolled.inventory) setProfile(p => p ? { ...p, inventory: farmPolled.inventory } : p);
    }
  }, [farmPolled]);

  // 쿨다운 타이머
  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const timer = setInterval(() => setCooldownLeft(p => p <= 1 ? 0 : p - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldownLeft]);

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
      setModal('none');
      setGuestbookKey(k => k + 1);
    }
  };

  const handleStatusSave = async () => {
    if (!isOwn) return;
    const newStatus = statusDraft.trim()
      ? { text: statusDraft.trim().slice(0, 200), link: linkDraft.trim() && /^https?:\/\//i.test(linkDraft.trim()) ? linkDraft.trim() : undefined, updated_at: new Date().toISOString() }
      : null;
    setProfile(p => p ? { ...p, status_message: newStatus } : p);
    await updateStatus(newStatus);
    setEditingStatus(false);
  };

  const handleCharacterUpdate = async (character: CharacterAppearance) => {
    if (!isOwn) return;
    setProfile(p => p ? { ...p, character } : p);
    await updateCharacter(character);
    setModal('none');
  };

  const handleToggleBookmark = async () => {
    if (!isLoggedIn) return;
    const action = bookmarkIds.includes(username) ? 'remove' : 'add';
    const newIds = await toggleBookmark(username, action);
    setBookmarkIds(newIds);
  };

  // ── Not Found ──
  if (notFound) {
    return (
      <div className="max-w-md mx-auto min-h-screen flex flex-col bg-[var(--bg)] shadow-2xl border-x border-[var(--border)]">
        <header className="sticky top-0 z-50 bg-[var(--bg)] border-b border-[var(--border)] px-4 py-2">
          <Link href="/" className="text-sm font-bold">🌱 Claude Farmer</Link>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4">
          <div className="text-5xl">🌾</div>
          <h1 className="text-xl font-bold">@{username}</h1>
          <p className="text-sm opacity-50">{locale === 'ko' ? '아직 농장을 시작하지 않았어요' : 'hasn\'t started farming yet'}</p>
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
  const isEmpty = isOwn && (profile.total_harvests ?? 0) === 0;
  const isBookmarked = bookmarkIds.includes(username);

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col bg-[var(--bg)] shadow-2xl border-x border-[var(--border)]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[var(--bg)] border-b border-[var(--border)]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center justify-between px-4 py-2 relative">
          {/* Left: Avatar + Name (with menu dropdown if logged in) */}
          {isLoggedIn ? (
            <button
              onClick={() => setModal(modal === 'menu' ? 'none' : 'menu')}
              className="flex items-center gap-2 text-sm hover:opacity-80"
            >
              <img src={profile.avatar_url} alt="" className="w-7 h-7 rounded-full border border-[var(--border)]" />
              <span className="font-bold">{profile.nickname}</span>
              <span className="text-xs opacity-30">Lv.{profile.level}</span>
              <span className="text-xs opacity-40">⌄</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <img src={profile.avatar_url} alt="" className="w-7 h-7 rounded-full border border-[var(--border)]" />
              <span className="font-bold">{profile.nickname}</span>
              <span className="text-xs opacity-30">Lv.{profile.level}</span>
            </div>
          )}

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            <button onClick={() => setModal('search')} className="text-lg opacity-60 hover:opacity-100" title={t.exploreTitle}>🔍</button>
            {isLoggedIn && !isOwn && (
              <button
                onClick={async () => {
                  const next = await waveSurf(username, currentUser!);
                  if (next) router.push(`/@${next}`);
                }}
                className="text-lg opacity-60 hover:opacity-100"
                title="Wave Surf"
              >
                🌊
              </button>
            )}
            <button onClick={() => setModal('share')} className="text-lg opacity-60 hover:opacity-100" title="Share">🔗</button>
            {!isLoggedIn && (
              <a href="/api/auth/login" className="text-xs bg-[var(--accent)] text-black px-3 py-1 rounded-full font-bold hover:opacity-90">
                {t.loginBtn}
              </a>
            )}
          </div>

          {/* Menu Dropdown */}
          {modal === 'menu' && currentUser && (
            <MenuDropdown
              currentUser={currentUser}
              onClose={() => setModal('none')}
              onOpenCharacter={() => setModal('character')}
            />
          )}
        </div>

        {/* 알림 배너 */}
        {isOwn && notifications && (notifications.visitor_count > 0 || notifications.water_received_count > 0) && (
          <div className="px-4 py-1.5 border-t border-[var(--border)] text-xs flex items-center gap-3 bg-[var(--card)]">
            {notifications.visitor_count > 0 && (
              <span>👣 <span className="font-bold">{notifications.visitor_count}</span></span>
            )}
            {notifications.water_received_count > 0 && (
              <span>💧 <span className="font-bold">{notifications.water_received_count}</span></span>
            )}
          </div>
        )}
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

        {/* Empty Farm Card */}
        {isEmpty && (
          <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--card)]">
            <div className="text-sm font-bold mb-1">🌱 {locale === 'ko' ? '농장 시작하기' : 'Get started'}</div>
            <p className="text-xs opacity-60 mb-2">{locale === 'ko' ? 'CLI를 설치하고 Claude Code를 쓰면 자동으로 자라요' : 'Install the CLI and code with Claude — your farm grows automatically'}</p>
            <code className="text-xs bg-[var(--bg)] rounded px-2 py-1 block">npm i -g claude-farmer && claude-farmer init</code>
          </div>
        )}

        {/* Status (editable for own farm) */}
        <div className="px-4 py-2 border-b border-[var(--border)] text-sm">
          {editingStatus ? (
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={statusDraft}
                onChange={e => setStatusDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleStatusSave(); if (e.key === 'Escape') setEditingStatus(false); }}
                maxLength={200}
                placeholder={t.setBubble}
                autoFocus
                className="bg-transparent border-b border-[var(--border)] outline-none text-sm py-1"
              />
              <input
                type="url"
                value={linkDraft}
                onChange={e => setLinkDraft(e.target.value)}
                placeholder="https://..."
                className="bg-transparent border-b border-[var(--border)] outline-none text-xs py-1 opacity-70"
              />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setEditingStatus(false)} className="text-xs opacity-40 px-2">✕</button>
                <button onClick={handleStatusSave} className="text-xs bg-[var(--accent)] text-black px-3 py-1 rounded font-bold">OK</button>
              </div>
            </div>
          ) : (
            <div
              className={`flex items-center gap-2 ${isOwn ? 'cursor-pointer hover:opacity-80' : ''}`}
              onClick={() => {
                if (!isOwn) return;
                setStatusDraft(profile.status_message?.text ?? '');
                setLinkDraft(profile.status_message?.link ?? '');
                setEditingStatus(true);
              }}
            >
              <span>💬</span>
              {profile.status_message?.text ? (
                <span className="flex-1">{profile.status_message.text}</span>
              ) : (
                <span className="opacity-40 flex-1">{isOwn ? t.setBubble : ''}</span>
              )}
              {profile.status_message?.link && /^https?:\/\//i.test(profile.status_message.link) && (
                <a href={profile.status_message.link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-xs text-[var(--accent)] hover:underline">
                  🔗
                </a>
              )}
              {isOwn && <span className="text-xs opacity-30">✏️</span>}
            </div>
          )}
        </div>

        {/* Action Bar */}
        <div className="flex gap-2 px-4 py-3 border-b border-[var(--border)]">
          {isOwn ? (
            <>
              <button onClick={() => setModal('share')} className="flex-1 text-xs font-bold py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors">
                🔗 {locale === 'ko' ? '공유' : 'Share'}
              </button>
              <button onClick={() => setModal('codex')} className="flex-1 text-xs font-bold py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors">
                📖 {locale === 'ko' ? '도감' : 'Codex'} {uniqueItems}/32
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
                <>
                  <button onClick={() => setModal('gift')} className="text-xs font-bold py-2 px-3 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-pink-400 transition-colors">
                    🎁
                  </button>
                  <button
                    onClick={handleToggleBookmark}
                    className={`text-xs font-bold py-2 px-3 rounded-lg border transition-colors ${
                      isBookmarked
                        ? 'bg-[var(--accent)] text-black border-[var(--accent)]'
                        : 'bg-[var(--card)] border-[var(--border)] hover:border-[var(--accent)]'
                    }`}
                  >
                    {isBookmarked ? '⭐' : '🔖'}
                  </button>
                </>
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

        {/* Compact Codex */}
        {isOwn && (profile.inventory ?? []).length > 0 && (
          <div className="px-4 py-2 border-t border-[var(--border)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold opacity-50">📖 {locale === 'ko' ? '수집' : 'Collected'}</span>
              <button onClick={() => setModal('codex')} className="text-xs text-[var(--accent)]">
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

      {/* Modals */}
      {modal === 'codex' && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={() => setModal('none')}>
          <div className="bg-[var(--bg)] w-full max-w-md rounded-t-xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-[var(--bg)] border-b border-[var(--border)] px-4 py-2 flex justify-between items-center">
              <span className="font-bold text-sm">📖 {locale === 'ko' ? '도감' : 'Codex'}</span>
              <button onClick={() => setModal('none')} className="text-xs opacity-40">✕</button>
            </div>
            <BagView inventory={profile.inventory ?? []} />
          </div>
        </div>
      )}

      {modal === 'gift' && (
        <GiftPicker inventory={userInventory} onGift={handleGift} onClose={() => setModal('none')} />
      )}

      {modal === 'search' && (
        <SearchModal currentUser={currentUser} onClose={() => setModal('none')} />
      )}

      {modal === 'share' && (
        <ShareModal username={username} nickname={profile.nickname} onClose={() => setModal('none')} />
      )}

      {modal === 'character' && isOwn && (
        <CharacterEditor
          current={profile.character}
          onSave={handleCharacterUpdate}
          onCancel={() => setModal('none')}
        />
      )}
    </div>
  );
}
