'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import TabBar from '@/components/TabBar';
import FarmView from '@/components/FarmView';
import BagView from '@/components/BagView';
import ExploreView from '@/components/ExploreView';
import FarmVisitView from '@/components/FarmVisitView';
import { fetchSession, fetchFarm, logout, fetchBookmarks, toggleBookmark, updateStatus, updateCharacter } from '@/lib/api';
import { MOCK_STATE, MOCK_NEIGHBORS } from '@/lib/mock-data';
import { useLocale } from '@/lib/locale-context';
import usePolling from '@/hooks/usePolling';
import type { LocalState, PublicProfile, FarmNotifications, Footprint, CharacterAppearance } from '@claude-farmer/shared';

export default function FarmPage() {
  return (
    <Suspense fallback={
      <div className="max-w-md mx-auto min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="text-4xl animate-bounce">🌱</div>
      </div>
    }>
      <FarmApp />
    </Suspense>
  );
}

function FarmApp() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState<'farm' | 'bag' | 'explore'>('farm');
  const [user, setUser] = useState<{ github_id: string; nickname: string; avatar_url: string } | null>(null);
  const [state, setState] = useState<LocalState>(MOCK_STATE);
  const [loading, setLoading] = useState(true);
  const [bookmarks, setBookmarks] = useState<PublicProfile[]>(MOCK_NEIGHBORS);
  const [bookmarkIds, setBookmarkIds] = useState<string[]>([]);
  const [footprints, setFootprints] = useState<Footprint[]>([]);
  const [visitingId, setVisitingId] = useState<string | null>(null);
  const [visitingNickname, setVisitingNickname] = useState<string>('');
  const [isDemo, setIsDemo] = useState(false);
  const [serverUniqueItems, setServerUniqueItems] = useState<number>(0);

  // ── 방문 히스토리 스택 ──
  const [visitHistory, setVisitHistory] = useState<string[]>([]);
  const [prevTab, setPrevTab] = useState<'farm' | 'bag' | 'explore'>('farm');

  // 방문 시 (모든 방문 경로 통합)
  function handleVisitFarm(id: string) {
    // 자기 농장 → 자기 탭으로
    if (id === user?.github_id) {
      setVisitingId(null);
      setVisitHistory([]);
      setTab('farm');
      return;
    }
    // 이미 방문 중이면 히스토리에 push
    if (visitingId) {
      setVisitHistory(prev => [...prev, visitingId]);
    } else {
      setPrevTab(tab);
    }
    setVisitingId(id);
    setVisitingNickname('');
  }

  // 뒤로가기 (스택 pop)
  function handleBack() {
    const prev = visitHistory[visitHistory.length - 1];
    if (prev) {
      setVisitHistory(h => h.slice(0, -1));
      setVisitingId(prev);
      setVisitingNickname('');
    } else if (!user) {
      // 비로그인 → 브라우저 히스토리로 (/ 또는 이전 페이지)
      if (typeof window !== 'undefined' && window.history.length > 1) {
        router.back();
      } else {
        router.push('/');
      }
    } else {
      setVisitingId(null);
      setIsDemo(false);
      setTab(prevTab);
    }
  }

  // 30초 polling
  const { data: notifications } = usePolling<FarmNotifications>(
    user ? `/api/farm/${user.github_id}/notifications` : null,
    { interval: 30_000, enabled: !!user }
  );
  const { data: farmPolled } = usePolling<PublicProfile & { footprints: Footprint[] }>(
    user ? `/api/farm/${user.github_id}` : null,
    { interval: 30_000, enabled: !!user }
  );

  useEffect(() => {
    if (farmPolled) {
      if (farmPolled.footprints) setFootprints(farmPolled.footprints);
      if (typeof farmPolled.unique_items === 'number') setServerUniqueItems(farmPolled.unique_items);
      if (typeof farmPolled.streak_days === 'number') {
        setState(prev => ({
          ...prev,
          activity: { ...prev.activity, streak_days: farmPolled.streak_days ?? prev.activity.streak_days },
        }));
      }
    }
  }, [farmPolled]);

  useEffect(() => {
    async function init() {
      const session = await fetchSession();
      if (session) {
        setUser(session);
        const profile = await fetchFarm(session.github_id);
        if (profile) {
          setState({
            version: 1,
            user: {
              github_id: session.github_id,
              nickname: profile.nickname,
              avatar_url: profile.avatar_url,
              created_at: profile.last_active,
              character: profile.character,
            },
            farm: profile.farm_snapshot,
            inventory: profile.inventory ?? [],
            status_message: profile.status_message,
            bookmarks: [],
            activity: {
              today_input_chars: profile.today_input_chars ?? 0,
              today_harvests: profile.today_harvests ?? 0,
              today_water_received: 0,
              today_water_given: profile.today_water_given ?? 0,
              streak_days: profile.streak_days ?? 1,
              last_active_date: new Date().toISOString().slice(0, 10),
            },
            last_synced: profile.last_active,
          });
          setServerUniqueItems(profile.unique_items ?? 0);
          const bm = await fetchBookmarks();
          setBookmarks(bm);
          setBookmarkIds(bm.map(b => b.github_id));
        }
      }
      setLoading(false);

      // ?visit= 파라미터 처리
      const visitParam = searchParams.get('visit');
      if (visitParam) {
        setVisitingId(visitParam);
        if (!session) setIsDemo(true);
      } else if (!session) {
        // 비로그인 + visit 파람 없음 → 랜딩으로 리다이렉트
        router.replace('/');
        return;
      }
    }
    init();
  }, []);

  const handleVisit = (profile: PublicProfile & { github_id?: string }) => {
    const id = (profile as PublicProfile & { github_id: string }).github_id;
    if (id) handleVisitFarm(id);
  };

  const handleToggleBookmark = async (targetId: string) => {
    const action = bookmarkIds.includes(targetId) ? 'remove' : 'add';
    const newIds = await toggleBookmark(targetId, action);
    setBookmarkIds(newIds);
    const bm = await fetchBookmarks();
    setBookmarks(bm);
  };

  const handleStatusUpdate = async (text: string, link?: string) => {
    if (!user) return;
    const newStatus = text.trim()
      ? { text: text.trim().slice(0, 200), link: link?.slice(0, 500), updated_at: new Date().toISOString() }
      : null;
    setState(prev => ({ ...prev, status_message: newStatus }));
    await updateStatus(newStatus);
  };

  const handleCharacterUpdate = async (character: CharacterAppearance) => {
    if (!user) return;
    setState(prev => ({ ...prev, user: { ...prev.user, character } }));
    await updateCharacter(character);
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setState(MOCK_STATE);
    setBookmarks(MOCK_NEIGHBORS);
    setVisitingId(null);
    setVisitHistory([]);
  };

  if (loading) {
    return (
      <div className="max-w-md mx-auto min-h-screen flex items-center justify-center bg-[var(--bg)] shadow-2xl border-x border-[var(--border)]">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-bounce">🌱</div>
          <p className="opacity-60">{t.loading}</p>
        </div>
      </div>
    );
  }

  // 비로그인 + 방문 중 아님 → 홈 뷰 (캐러셀)
  // 비로그인 + 방문 없음 → init에서 이미 / 로 리다이렉트됨

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col bg-[var(--bg)] shadow-2xl border-x border-[var(--border)] relative">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[var(--bg)] border-b border-[var(--border)]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center justify-between px-4 py-2">
          {visitingId ? (
            <>
              <button onClick={handleBack} className="text-sm opacity-60 hover:opacity-100">
                ← {t.visitBack}
              </button>
              <span className="text-sm font-bold">{visitingNickname || ''}</span>
              <div className="w-16" />
            </>
          ) : user ? (
            <>
              <div className="flex items-center gap-2 text-sm">
                <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full border border-[var(--border)]" />
                <span className="font-bold">{user.nickname}</span>
              </div>
              <button onClick={handleLogout} className="text-xs opacity-40 hover:opacity-70">
                {t.logoutBtn}
              </button>
            </>
          ) : (
            <>
              <Link href="/" className="text-sm font-bold hover:opacity-80">🌱 Claude Farmer</Link>
              <a
                href="/api/auth/login"
                className="text-xs bg-[var(--accent)] text-black px-3 py-1 rounded-full font-bold hover:opacity-90"
              >
                {t.loginBtn}
              </a>
            </>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {visitingId ? (
          <>
            {isDemo && (
              <div className="bg-[var(--accent)] text-black text-center py-2 text-sm font-bold">
                🌱 {t.demoBanner}
                <a href="/api/auth/login" className="underline ml-2">{t.loginBtn}</a>
              </div>
            )}
            <FarmVisitView
              targetId={visitingId}
              currentUserId={user?.github_id ?? ''}
              onBack={handleBack}
              isBookmarked={bookmarkIds.includes(visitingId)}
              onToggleBookmark={handleToggleBookmark}
              onNicknameLoaded={setVisitingNickname}
              isDemo={isDemo}
              userInventory={state.inventory}
              onWaveSurf={handleVisitFarm}
            />
          </>
        ) : (
          <>
            {tab === 'farm' && (
              <FarmView
                state={state}
                footprints={footprints}
                notifications={notifications}
                serverUniqueItems={serverUniqueItems}
                isLoggedIn={!!user}
                onStatusUpdate={handleStatusUpdate}
                onCharacterUpdate={handleCharacterUpdate}
                onVisitUser={handleVisitFarm}
              />
            )}
            {tab === 'bag' && <BagView inventory={state.inventory} />}
            {tab === 'explore' && (
              <ExploreView
                bookmarks={bookmarks}
                currentUser={user?.github_id}
                onVisit={handleVisit}
              />
            )}
          </>
        )}
      </div>

      {/* TabBar — 방문 중이 아니고, 로그인 상태일 때만 */}
      {!visitingId && user && <TabBar active={tab} onChange={setTab} />}
    </div>
  );
}
