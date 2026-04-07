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
import AboutModal from '@/components/AboutModal';
import StatusEditModal from '@/components/StatusEditModal';
import DiscoverCarousel from '@/components/DiscoverCarousel';
import Icon from '@/components/Icon';
import {
  fetchSession, fetchFarmWithFootprints, waterUser, visitFarm, sendGift,
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

type ActiveModal = 'none' | 'menu' | 'search' | 'share' | 'codex' | 'character' | 'gift' | 'about' | 'edit';

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
  const [myAvatarUrl, setMyAvatarUrl] = useState<string>('');

  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [watering, setWatering] = useState(false);
  const [modal, setModal] = useState<ActiveModal>('none');
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
          if (myFarm?.avatar_url) setMyAvatarUrl(myFarm.avatar_url);
          visitFarm(username);
        } else {
          setUserInventory(data.inventory ?? []);
          setMyAvatarUrl(data.avatar_url);
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

  const handleStatusSave = async (text: string, link?: string) => {
    if (!isOwn) return;
    const newStatus = text.trim()
      ? { text: text.trim().slice(0, 200), link, updated_at: new Date().toISOString() }
      : null;
    setProfile(p => p ? { ...p, status_message: newStatus } : p);
    await updateStatus(newStatus);
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
        <div className="flex items-center gap-2 px-3 py-2 relative">
          {/* LEFT: 탐색 액션 (검색 + 공유) */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button onClick={() => setModal('search')} aria-label={t.exploreTitle} className="p-1.5 opacity-60 hover:opacity-100">
              <Icon name="search" size={20} />
            </button>
            <button onClick={() => setModal('share')} aria-label="Share" className="p-1.5 opacity-60 hover:opacity-100">
              <Icon name="share" size={20} />
            </button>
          </div>

          {/* CENTER: 방문 농장 프로필 (아바타 + 닉네임 + 배지) */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <img src={profile.avatar_url} alt="" className="w-9 h-9 rounded-full border border-[var(--border)] shrink-0" />
            <div className="flex flex-col min-w-0 leading-tight">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-bold text-sm truncate">{profile.nickname}</span>
                <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--card)] border border-[var(--border)] opacity-70">
                  Lv.{profile.level}
                </span>
              </div>
              {/* 자기 농장: 오늘 신규 배지 */}
              {isOwn && notifications && (notifications.visitor_count > 0 || notifications.water_received_count > 0) && (
                <div className="flex items-center gap-1 mt-0.5">
                  {notifications.visitor_count > 0 && (
                    <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--card)] border border-[var(--border)] text-[var(--accent)]">
                      <Icon name="directions_walk" size={11} />
                      {notifications.visitor_count}+
                    </span>
                  )}
                  {notifications.water_received_count > 0 && (
                    <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--card)] border border-[var(--border)] text-blue-400">
                      <Icon name="water_drop" size={11} filled />
                      {notifications.water_received_count}+
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT END: 계정 아바타 (메뉴 트리거) — GitHub 스타일 */}
          {isLoggedIn ? (
            <button
              onClick={() => setModal(modal === 'menu' ? 'none' : 'menu')}
              aria-label="Account"
              className="shrink-0 p-0.5 rounded-full hover:opacity-80 ml-auto"
            >
              <img src={myAvatarUrl || profile.avatar_url} alt="" className="w-8 h-8 rounded-full border border-[var(--border)]" />
            </button>
          ) : (
            <a href="/api/auth/login" className="shrink-0 text-[11px] bg-[var(--accent)] text-black px-2.5 py-1 rounded-full font-bold hover:opacity-90 ml-auto">
              {t.loginBtn}
            </a>
          )}

          {/* Menu Dropdown */}
          {modal === 'menu' && currentUser && (
            <MenuDropdown
              currentUser={currentUser}
              isOwnFarm={isOwn}
              onClose={() => setModal('none')}
              onOpenEdit={() => setModal('edit')}
              onOpenCharacter={() => setModal('character')}
              onOpenAbout={() => setModal('about')}
            />
          )}
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

        {/* Empty Farm Card */}
        {isEmpty && (
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
              <div className="text-sm font-bold mb-1 flex items-center gap-1.5">
                <Icon name="rocket_launch" size={16} />
                {locale === 'ko' ? '농장 시작하기' : 'Get started'}
              </div>
              <p className="text-xs opacity-60 mb-2">{locale === 'ko' ? 'CLI를 설치하고 Claude Code를 쓰면 자동으로 자라요' : 'Install the CLI and code with Claude — your farm grows automatically'}</p>
              <code className="text-xs bg-[var(--bg)] rounded px-2 py-1 block">npm i -g claude-farmer && claude-farmer init</code>
            </div>
          </div>
        )}

        {/* Status — 카드 형태 */}
        {(profile.status_message?.text || isOwn) && (
          <div className="px-4 pt-3">
            <div
              className={`bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 flex items-center gap-2 text-sm ${isOwn ? 'cursor-pointer hover:border-[var(--accent)] transition-colors' : ''}`}
              onClick={() => { if (isOwn) setModal('edit'); }}
            >
              <Icon name="chat_bubble" size={16} className="opacity-50" />
              {profile.status_message?.text ? (
                <span className="flex-1">{profile.status_message.text}</span>
              ) : (
                <span className="opacity-40 flex-1">{isOwn ? t.setBubble : ''}</span>
              )}
              {profile.status_message?.link && /^https?:\/\//i.test(profile.status_message.link) && (
                <a href={profile.status_message.link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-[var(--accent)]">
                  <Icon name="link" size={14} />
                </a>
              )}
              {isOwn && <Icon name="edit" size={14} className="opacity-30" />}
            </div>
          </div>
        )}

        {/* Action Bar */}
        <div className="flex gap-2 px-4 py-3 border-b border-[var(--border)]">
          {isOwn ? (
            <>
              <button
                onClick={() => setModal('share')}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-2.5 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors"
              >
                <Icon name="share" size={16} />
                {locale === 'ko' ? '공유' : 'Share'}
              </button>
              <button
                onClick={() => setModal('codex')}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-2.5 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors"
              >
                <Icon name="menu_book" size={16} />
                {locale === 'ko' ? '도감' : 'Codex'} {uniqueItems}/32
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleWater}
                disabled={cooldownLeft > 0 || watering || !isLoggedIn}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-2.5 rounded-lg bg-blue-500 text-white disabled:opacity-40 transition-all"
              >
                <Icon name="water_drop" size={16} filled />
                {cooldownLeft > 0
                  ? `${Math.floor(cooldownLeft/60)}:${(cooldownLeft%60).toString().padStart(2,'0')}`
                  : t.visitWater}
              </button>
              {isLoggedIn && (
                <>
                  <button
                    onClick={() => setModal('gift')}
                    className="text-xs font-bold py-2.5 px-3 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-pink-400 transition-colors"
                    title={locale === 'ko' ? '선물' : 'Gift'}
                  >
                    <Icon name="redeem" size={18} />
                  </button>
                  <button
                    onClick={handleToggleBookmark}
                    className={`text-xs font-bold py-2.5 px-3 rounded-lg border transition-colors ${
                      isBookmarked
                        ? 'bg-[var(--accent)] text-black border-[var(--accent)]'
                        : 'bg-[var(--card)] border-[var(--border)] hover:border-[var(--accent)]'
                    }`}
                    title={isBookmarked ? t.visitBookmarked : t.visitBookmark}
                  >
                    <Icon name="bookmark" size={18} filled={isBookmarked} />
                  </button>
                </>
              )}
              {!isLoggedIn && (
                <a href="/api/auth/login" className="flex-1 text-xs font-bold py-2.5 rounded-lg bg-[var(--accent)] text-black text-center">
                  {t.loginBtn}
                </a>
              )}
            </>
          )}
        </div>

        {/* Identity strip — 농부 칭호 + 스트릭 */}
        <div className="px-4 pt-3">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5">
              <span>{farmerTitle.emoji}</span>
              <span className="font-bold">{locale === 'ko' ? farmerTitle.ko : farmerTitle.en}</span>
            </span>
            {(profile.streak_days ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-xs">
                <Icon name="local_fire_department" size={14} className="text-orange-400" filled />
                <span className="font-bold">{profile.streak_days}{locale === 'ko' ? '일' : 'd'}</span>
              </span>
            )}
          </div>
        </div>

        {/* Lifetime 카드 — 기록 */}
        <div className="px-4 pt-3">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
            <div className="text-xs font-bold opacity-60 mb-2 flex items-center gap-1.5">
              <Icon name="bar_chart" size={14} />
              {locale === 'ko' ? '기록' : 'Records'}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <Icon name="agriculture" size={16} className="opacity-60" />
                <div className="leading-tight">
                  <div className="text-sm font-bold">{profile.total_harvests}</div>
                  <div className="text-[10px] opacity-50">{locale === 'ko' ? '총 수확' : 'Harvests'}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Icon name="inventory_2" size={16} className="opacity-60" />
                <div className="leading-tight">
                  <div className="text-sm font-bold">{uniqueItems}/32</div>
                  <div className="text-[10px] opacity-50">{locale === 'ko' ? '도감' : 'Codex'}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Icon name="groups" size={16} className="opacity-60" />
                <div className="leading-tight">
                  <div className="text-sm font-bold">{profile.total_visitors ?? 0}</div>
                  <div className="text-[10px] opacity-50">{locale === 'ko' ? '누적 방문자' : 'Visitors'}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Icon name="water_drop" size={16} className="opacity-60 text-blue-400" filled />
                <div className="leading-tight">
                  <div className="text-sm font-bold">{profile.total_water_received ?? 0}</div>
                  <div className="text-[10px] opacity-50">{locale === 'ko' ? '누적 물' : 'Watered'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Today 카드 (자기 농장만, 활동 있을 때만) */}
        {isOwn && ((profile.today_input_chars ?? 0) > 0 || (profile.today_harvests ?? 0) > 0 || (profile.today_water_given ?? 0) > 0) && (
          <div className="px-4 pt-3">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 border-l-4" style={{ borderLeftColor: 'var(--accent)' }}>
              <div className="text-xs font-bold opacity-60 mb-2 flex items-center gap-1.5">
                <Icon name="today" size={14} />
                {locale === 'ko' ? '오늘' : 'Today'}
              </div>
              <div className="flex items-center justify-around text-xs">
                <div className="flex items-center gap-1.5">
                  <Icon name="keyboard" size={14} className="opacity-60" />
                  <span className="font-bold">{((profile.today_input_chars ?? 0) / 1000).toFixed(1)}k</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Icon name="eco" size={14} className="opacity-60" />
                  <span className="font-bold">{profile.today_harvests ?? 0}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Icon name="water_drop" size={14} className="opacity-60" />
                  <span className="font-bold">{profile.today_water_given ?? 0}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Compact Codex — 카드 */}
        {isOwn && (profile.inventory ?? []).length > 0 && (
          <div className="px-4 pb-3">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold opacity-60 flex items-center gap-1.5">
                  <Icon name="inventory_2" size={14} />
                  {locale === 'ko' ? '수집' : 'Collected'}
                </span>
                <button onClick={() => setModal('codex')} className="text-xs text-[var(--accent)] flex items-center gap-0.5">
                  {locale === 'ko' ? '전체보기' : 'View all'}
                  <Icon name="chevron_right" size={14} />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {GACHA_ITEMS.filter(item => itemCounts.has(item.id)).slice(0, 16).map(item => (
                  <span key={item.id} className="text-base" title={item.name}>
                    {ITEM_EMOJI[item.id] ?? '?'}
                  </span>
                ))}
                {uniqueItems > 16 && <span className="text-xs opacity-40 self-center">+{uniqueItems - 16}</span>}
              </div>
            </div>
          </div>
        )}

        {/* Guestbook */}
        <div className="px-4 pt-3 pb-3">
          <GuestbookPanel
            farmId={username}
            refreshKey={guestbookKey}
            onVisitUser={(id) => router.push(`/@${id}`)}
          />
        </div>

        {/* 다른 농장 (방명록 다음) */}
        <div className="pb-4">
          <DiscoverCarousel
            currentUser={currentUser}
            viewedUsername={username}
            isOwn={isOwn}
            onOpenSearch={() => setModal('search')}
          />
        </div>
      </div>

      {/* Modals */}
      {modal === 'codex' && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={() => setModal('none')}>
          <div className="bg-[var(--bg)] w-full max-w-md rounded-t-xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()} style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-[var(--border)]" />
            </div>
            <div className="sticky top-0 bg-[var(--bg)] border-b border-[var(--border)] px-4 py-2 flex justify-between items-center">
              <span className="font-bold text-sm flex items-center gap-2">
                <Icon name="menu_book" size={18} />
                {locale === 'ko' ? '도감' : 'Codex'}
              </span>
              <button onClick={() => setModal('none')} className="opacity-40 hover:opacity-100">
                <Icon name="close" size={18} />
              </button>
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

      {modal === 'about' && (
        <AboutModal onClose={() => setModal('none')} />
      )}

      {modal === 'edit' && isOwn && (
        <StatusEditModal
          current={profile.status_message}
          onSave={handleStatusSave}
          onClose={() => setModal('none')}
        />
      )}
    </div>
  );
}
