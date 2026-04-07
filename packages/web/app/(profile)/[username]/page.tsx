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
import RankingsModal from '@/components/RankingsModal';
import DiscoverCarousel from '@/components/DiscoverCarousel';
import Card from '@/components/Card';
import Icon from '@/components/Icon';
import {
  fetchSession, fetchFarmWithFootprints, waterUser, visitFarm, sendGift,
  fetchBookmarks, toggleBookmark, updateStatus, updateCharacter, fetchWaterCooldown,
} from '@/lib/api';
import usePolling from '@/hooks/usePolling';
import { useLocale } from '@/lib/locale-context';
import {
  WATER_COOLDOWN_SECONDS, GRID_SIZE, getFarmerTitle, GACHA_ITEMS, getItemCounts, generateDefaultAppearance,
} from '@claude-farmer/shared';
import type { PublicProfile, Footprint, InventoryItem, CharacterAppearance, FarmNotifications } from '@claude-farmer/shared';

const ITEM_EMOJI: Record<string, string> = {
  c01: '🪨', c02: '🌿', c03: '🌾', c04: '🪱', c05: '🚿', c06: '🏗️', c07: '🧱', c08: '🌱', c09: '🍄',
  c10: '🐤', c11: '💥', c12: '📝',
  r01: '🐱', r02: '🐶', r03: '🌸', r04: '💧', r05: '🪑', r06: '📮', r07: '🔦', r08: '🤖', r09: '☕',
  e01: '⛲', e02: '🌀', e03: '🍎', e04: '🐰', e05: '🌈', e06: '📚', e07: '🌳',
  l01: '🌻', l02: '🦄', l03: '🌌', l04: '✨',
};

type ActiveModal = 'none' | 'menu-app' | 'menu-account' | 'search' | 'share' | 'codex' | 'character' | 'gift' | 'about' | 'edit' | 'rankings';

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
  const [rankingsTab, setRankingsTab] = useState<'water' | 'gifts'>('water');

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
        // 기존 물주기 쿨다운 동기화 (다른 농장에서 이미 물 줬을 수 있음)
        if (session.github_id !== username) {
          fetchWaterCooldown().then(remaining => {
            if (remaining > 0) setCooldownLeft(remaining);
          });
        }
        const bm = await fetchBookmarks();
        setBookmarkIds(bm.map(b => b.github_id));

        if (session.github_id !== username) {
          const myFarm = await fetchFarmWithFootprints(session.github_id);
          if (myFarm?.inventory) setUserInventory(myFarm.inventory);
          if (myFarm?.avatar_url) setMyAvatarUrl(myFarm.avatar_url);
          // 방문 기록 + 낙관적 카운트 증가
          visitFarm(username).then(ok => {
            if (ok) setProfile(p => p ? { ...p, total_visitors: (p.total_visitors ?? 0) + 1 } : p);
          });
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

  function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t.guestbookJustNow;
    if (mins < 60) return `${mins}${t.guestbookMinAgo}`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}${t.guestbookHourAgo}`;
    const days = Math.floor(hours / 24);
    return `${days}${t.guestbookDayAgo}`;
  }

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

  // 모달 열렸을 때 배경 스크롤 락
  useEffect(() => {
    if (modal === 'none') return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [modal]);

  // 페이지 unmount 시 보장: 잔존 락 제거
  useEffect(() => () => { document.body.style.overflow = ''; }, []);

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
    const cleanLink = link && link.trim() ? link.trim() : undefined;
    const newStatus = text.trim()
      ? { text: text.trim().slice(0, 200), link: cleanLink, updated_at: new Date().toISOString() }
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
    const willBookmark = !bookmarkIds.includes(username);
    // 낙관적 업데이트
    setBookmarkIds(prev =>
      willBookmark ? [...prev, username] : prev.filter(id => id !== username)
    );
    setProfile(p =>
      p ? { ...p, total_bookmarks: Math.max(0, (p.total_bookmarks ?? 0) + (willBookmark ? 1 : -1)) } : p
    );
    const newIds = await toggleBookmark(username, willBookmark ? 'add' : 'remove');
    if (newIds.length > 0 || !willBookmark) setBookmarkIds(newIds);
  };

  // ── Not Found ──
  if (notFound) {
    return (
      <div className="max-w-md mx-auto min-h-screen flex flex-col bg-[var(--bg)] shadow-2xl border-x border-[var(--border)]">
        <header className="sticky top-0 z-50 bg-[var(--bg)] border-b border-[var(--border)] px-4 py-2">
          <Link href="/" className="text-sm font-bold flex items-center gap-1.5">
            <img src="/favicon.svg" alt="" className="w-5 h-5" />
            Claude Farmer
          </Link>
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
          {/* LEFT: 햄버거(앱 메뉴) */}
          <button
            type="button"
            onClick={() => setModal(modal === 'menu-app' ? 'none' : 'menu-app')}
            aria-label={t.menuAriaLabel}
            aria-expanded={modal === 'menu-app'}
            className={`shrink-0 h-8 w-8 flex items-center justify-center border rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
              modal === 'menu-app'
                ? 'bg-[var(--card)] border-[var(--accent)]'
                : 'border-[var(--border)] hover:bg-[var(--card)] hover:border-[var(--accent)]'
            }`}
          >
            <Icon name="menu" size={18} />
          </button>

          {/* LEFT: 방문 농장 프로필 (아바타 + 닉네임 + 배지) */}
          <div className="flex items-center gap-2 min-w-0 flex-1 h-8">
            <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-lg border border-[var(--border)] shrink-0 object-cover" />
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-bold text-sm truncate">{profile.nickname}</span>
              <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--card)] border border-[var(--border)] opacity-70">
                Lv.{profile.level}
              </span>
              {isOwn && notifications && notifications.visitor_count > 0 && (
                <span className="hidden sm:inline-flex shrink-0 items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--card)] border border-[var(--border)] text-[var(--accent)]">
                  <Icon name="directions_walk" size={11} />
                  {notifications.visitor_count}+
                </span>
              )}
              {isOwn && notifications && notifications.water_received_count > 0 && (
                <span className="hidden sm:inline-flex shrink-0 items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--card)] border border-[var(--border)] text-blue-400">
                  <Icon name="water_drop" size={11} filled />
                  {notifications.water_received_count}+
                </span>
              )}
            </div>
          </div>

          {/* RIGHT: 검색 + 공유 */}
          <button
            type="button"
            onClick={() => setModal('search')}
            aria-label={t.exploreTitle}
            className="shrink-0 h-8 w-8 flex items-center justify-center border border-[var(--border)] rounded-lg hover:bg-[var(--card)] hover:border-[var(--accent)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <Icon name="search" size={18} />
          </button>
          <button
            type="button"
            onClick={() => setModal('share')}
            aria-label={t.shareAriaLabel}
            className="shrink-0 h-8 w-8 flex items-center justify-center border border-[var(--border)] rounded-lg hover:bg-[var(--card)] hover:border-[var(--accent)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <Icon name="share" size={18} />
          </button>

          {/* RIGHT END: 내 아바타 (계정 메뉴) 또는 로그인 */}
          {isLoggedIn ? (
            <button
              type="button"
              onClick={() => setModal(modal === 'menu-account' ? 'none' : 'menu-account')}
              aria-label={t.accountAriaLabel}
              aria-expanded={modal === 'menu-account'}
              className={`shrink-0 h-8 w-8 rounded-lg border overflow-hidden transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                modal === 'menu-account' ? 'border-[var(--accent)]' : 'border-[var(--border)] hover:border-[var(--accent)]'
              }`}
            >
              <img src={myAvatarUrl || profile.avatar_url} alt="" className="w-full h-full object-cover" />
            </button>
          ) : (
            <a
              href="/api/auth/login"
              className="shrink-0 h-8 inline-flex items-center text-xs font-bold px-3 rounded-lg border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black transition-colors"
            >
              {t.loginBtn}
            </a>
          )}

          {/* App Menu Dropdown (좌측 햄버거) */}
          {modal === 'menu-app' && (
            <MenuDropdown
              variant="app"
              anchor="left"
              currentUser={currentUser ?? ''}
              isOwnFarm={isOwn}
              onClose={() => setModal('none')}
              onOpenEdit={() => setModal('edit')}
              onOpenCharacter={() => setModal('character')}
              onOpenAbout={() => setModal('about')}
            />
          )}

          {/* Account Menu Dropdown (우측 아바타) */}
          {modal === 'menu-account' && currentUser && (
            <MenuDropdown
              variant="account"
              anchor="right"
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
            ownerCharacter={profile.character ?? generateDefaultAppearance(username)}
            ownerAvatarUrl={profile.avatar_url}
            decorations={GACHA_ITEMS.filter(item => (itemCounts.get(item.id) ?? 0) > 0).map(item => ({ itemId: item.id, count: itemCounts.get(item.id) ?? 0, rarity: item.rarity }))}
            streakDays={profile.streak_days}
          />
        </div>

        {/* Today 카드 (자기 농장만, 활동 있을 때만) — 최상단 */}
        {isOwn && ((profile.today_input_chars ?? 0) > 0 || (profile.today_harvests ?? 0) > 0 || (profile.today_water_given ?? 0) > 0) && (
          <div className="px-4 pt-3">
            <Card header={<><Icon name="today" size={14} />{locale === 'ko' ? '오늘' : 'Today'}</>}>
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
            </Card>
          </div>
        )}

        {/* Empty Farm Card */}
        {isEmpty && (
          <div className="px-4 pt-3">
            <Card
              header={<><Icon name="rocket_launch" size={14} />{locale === 'ko' ? '농장 시작하기' : 'Get started'}</>}
            >
              <p className="text-xs opacity-60 mb-2">{locale === 'ko' ? 'CLI를 설치하고 Claude Code를 쓰면 자동으로 자라요' : 'Install the CLI and code with Claude — your farm grows automatically'}</p>
              <code className="text-xs bg-[var(--bg)] rounded px-2 py-1 block">npm i -g claude-farmer && claude-farmer init</code>
            </Card>
          </div>
        )}

        {/* 프로필 카드 — Identity + Status + Actions */}
        <div className="px-4 pt-3">
          <Card
            header={
              <>
                <span>{farmerTitle.emoji}</span>
                <span>{locale === 'ko' ? farmerTitle.ko : farmerTitle.en}</span>
                {(profile.streak_days ?? 0) > 0 && (
                  <span className="ml-1 inline-flex items-center gap-0.5 text-orange-400">
                    <Icon name="local_fire_department" size={12} filled />
                    {profile.streak_days}{locale === 'ko' ? '일' : 'd'}
                  </span>
                )}
              </>
            }
            headerRight={
              !isOwn && isLoggedIn ? (
                <button
                  onClick={handleToggleBookmark}
                  title={isBookmarked ? t.visitBookmarked : t.visitBookmark}
                  className={`-my-2 -mr-3 ml-2 self-stretch h-full px-3 flex items-center gap-1 border-l border-[var(--border)] transition-colors ${
                    isBookmarked ? 'text-[var(--accent)]' : 'opacity-60 hover:opacity-100 hover:bg-[var(--bg)]'
                  }`}
                >
                  <Icon name="bookmark" size={16} filled={isBookmarked} />
                  <span className="text-[11px] font-bold tabular-nums">{profile.total_bookmarks ?? 0}</span>
                </button>
              ) : (profile.total_bookmarks ?? 0) > 0 ? (
                <span className="flex items-center gap-1 opacity-60">
                  <Icon name="bookmark" size={14} filled />
                  <span className="text-[11px] font-bold tabular-nums">{profile.total_bookmarks}</span>
                </span>
              ) : null
            }
            bodyClassName="px-3 py-3"
            footer={
              isOwn ? (
                <button
                  type="button"
                  onClick={() => setModal('edit')}
                  className="block w-full h-11 text-xs font-bold opacity-70 hover:opacity-100 hover:bg-[var(--bg)] transition-colors flex items-center justify-center gap-1.5"
                >
                  <Icon name="edit" size={14} />
                  {locale === 'ko' ? '수정하기' : 'Edit'}
                </button>
              ) : null
            }
          >
            <div className="flex gap-2.5 items-start">
              <img
                src={profile.avatar_url}
                alt=""
                className="w-9 h-9 rounded-full border border-[var(--border)] flex-shrink-0 object-cover"
              />
              <div className="flex-1 min-w-0">
                <div className="inline-block max-w-full bg-[var(--bg)] border border-[var(--border)] rounded-2xl rounded-tl-sm overflow-hidden">
                  <div className="px-4 py-3 break-words text-sm leading-relaxed">
                    {profile.status_message?.text || (
                      <span className="opacity-40">{isOwn ? t.setBubble : (locale === 'ko' ? '소개가 없어요' : 'No bio')}</span>
                    )}
                  </div>
                  {profile.status_message?.link && /^https?:\/\//i.test(profile.status_message.link) && (
                    <a
                      href={profile.status_message.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-4 py-2.5 border-t border-[var(--border)] text-xs text-[var(--accent)] hover:bg-[var(--card)] transition-colors"
                    >
                      <Icon name="open_in_new" size={12} className="shrink-0" />
                      <span className="truncate">{profile.status_message.link.replace(/^https?:\/\//, '')}</span>
                    </a>
                  )}
                </div>
                {profile.status_message?.updated_at && (
                  <div className="mt-1.5 ml-1 text-[10px] opacity-40">
                    {timeAgo(profile.status_message.updated_at)}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Records 카드 — 4-col */}
        <div className="px-4 pt-3">
          <Card header={<><Icon name="bar_chart" size={14} />{locale === 'ko' ? '기록' : 'Records'}</>}>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="flex flex-col items-center gap-2">
                <div className="text-base font-bold leading-none">{profile.total_harvests}</div>
                <div className="text-[10px] opacity-50 inline-flex items-center gap-0.5">
                  <Icon name="agriculture" size={11} />
                  {locale === 'ko' ? '수확' : 'Harvests'}
                </div>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="text-base font-bold leading-none">{Math.round((uniqueItems / 32) * 100)}%</div>
                <div className="text-[10px] opacity-50 inline-flex items-center gap-0.5">
                  <Icon name="inventory_2" size={11} />
                  {locale === 'ko' ? '도감' : 'Codex'}
                </div>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="text-base font-bold leading-none">{profile.total_visitors ?? 0}</div>
                <div className="text-[10px] opacity-50 inline-flex items-center gap-0.5">
                  <Icon name="groups" size={11} />
                  {locale === 'ko' ? '방문자' : 'Visitors'}
                </div>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="text-base font-bold leading-none">{profile.total_water_received ?? 0}</div>
                <div className="text-[10px] opacity-50 inline-flex items-center gap-0.5">
                  <Icon name="water_drop" size={11} className="text-blue-400" filled />
                  {locale === 'ko' ? '물' : 'Watered'}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Compact Codex — 카드 */}
        {isOwn && (profile.inventory ?? []).length > 0 && (
          <div className="px-4 pt-3">
            <Card
              header={<><Icon name="inventory_2" size={14} />{locale === 'ko' ? '수집' : 'Collected'}</>}
              headerRight={
                <button onClick={() => setModal('codex')} className="text-[var(--accent)] flex items-center gap-0.5">
                  {locale === 'ko' ? '전체보기' : 'View all'}
                  <Icon name="chevron_right" size={14} />
                </button>
              }
            >
              {(() => {
                const collected = GACHA_ITEMS.filter(item => itemCounts.has(item.id));
                const visible = collected.slice(0, 10);
                const overflow = uniqueItems - visible.length;
                return (
                  <div className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap">
                    {visible.map(item => (
                      <span key={item.id} className="text-base shrink-0" title={item.name}>
                        {ITEM_EMOJI[item.id] ?? '?'}
                      </span>
                    ))}
                    {overflow > 0 && <span className="text-xs opacity-40 shrink-0">+{overflow}</span>}
                  </div>
                );
              })()}
            </Card>
          </div>
        )}

        {/* Guestbook */}
        <div className="px-4 pt-3 pb-3">
          <GuestbookPanel
            farmId={username}
            refreshKey={guestbookKey}
            onVisitUser={(id) => router.push(`/@${id}`)}
            onOpenRankings={(tab) => { setRankingsTab(tab); setModal('rankings'); }}
            hint={
              !isOwn ? (
                locale === 'ko'
                  ? '물을 주거나 선물을 보내면 방명록에 흔적이 남아요'
                  : 'Watering or gifting leaves a trace here'
              ) : null
            }
            footer={
              !isOwn ? (
                isLoggedIn ? (
                  <div className="flex divide-x divide-[var(--border)]">
                    <button
                      onClick={handleWater}
                      disabled={cooldownLeft > 0 || watering}
                      className="flex-1 h-11 flex items-center justify-center gap-1.5 text-xs font-bold text-blue-400 hover:bg-[var(--bg)] disabled:opacity-40 transition-colors"
                    >
                      <Icon name="water_drop" size={16} filled />
                      {cooldownLeft > 0
                        ? `${Math.floor(cooldownLeft/60)}:${(cooldownLeft%60).toString().padStart(2,'0')}`
                        : t.visitWater}
                    </button>
                    <button
                      onClick={() => setModal('gift')}
                      className="flex-1 h-11 flex items-center justify-center gap-1.5 text-xs font-bold hover:bg-[var(--bg)] transition-colors"
                    >
                      <Icon name="redeem" size={16} />
                      {locale === 'ko' ? '선물' : 'Gift'}
                    </button>
                  </div>
                ) : (
                  <a
                    href="/api/auth/login"
                    className="block h-11 leading-[44px] text-center text-xs font-bold bg-[var(--accent)] text-black"
                  >
                    {t.loginBtn}
                  </a>
                )
              ) : null
            }
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
          <div className="bg-[var(--bg)] w-full max-w-md rounded-t-xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()} style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <div className="shrink-0 flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-[var(--border)]" />
            </div>
            <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]">
              <span className="h-8 flex items-center gap-2 text-sm font-bold flex-1 min-w-0">
                <Icon name="menu_book" size={18} />
                {locale === 'ko' ? '도감' : 'Codex'}
              </span>
              <button
                type="button"
                onClick={() => setModal('none')}
                aria-label="Close"
                className="shrink-0 h-8 w-8 flex items-center justify-center border border-[var(--border)] rounded-lg hover:bg-[var(--card)] hover:border-[var(--accent)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <BagView inventory={profile.inventory ?? []} />
            </div>
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

      {modal === 'rankings' && (
        <RankingsModal farmId={username} initialTab={rankingsTab} onClose={() => setModal('none')} />
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
