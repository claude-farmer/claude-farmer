'use client';

import { useState, useEffect } from 'react';
import TabBar from '@/components/TabBar';
import FarmView from '@/components/FarmView';
import BagView from '@/components/BagView';
import ExploreView from '@/components/ExploreView';
import { fetchSession, fetchFarm, logout } from '@/lib/api';
import { MOCK_STATE, MOCK_NEIGHBORS } from '@/lib/mock-data';
import { useLocale } from '@/lib/locale-context';
import usePolling from '@/hooks/usePolling';
import type { LocalState, PublicProfile, FarmNotifications, Footprint } from '@claude-farmer/shared';

export default function FarmApp() {
  const { t } = useLocale();
  const [tab, setTab] = useState<'farm' | 'bag' | 'explore'>('farm');
  const [user, setUser] = useState<{ github_id: string; nickname: string; avatar_url: string } | null>(null);
  const [state, setState] = useState<LocalState>(MOCK_STATE);
  const [loading, setLoading] = useState(true);
  const [bookmarks, setBookmarks] = useState<PublicProfile[]>(MOCK_NEIGHBORS);
  const [footprints, setFootprints] = useState<Footprint[]>([]);

  // 30초 polling으로 알림 조회 (로그인 시)
  const { data: notifications } = usePolling<FarmNotifications>(
    user ? `/api/farm/${user.github_id}/notifications` : null,
    { interval: 30_000, enabled: !!user }
  );

  // 30초 polling으로 발자국 포함한 농장 데이터 조회 (로그인 시)
  const { data: farmPolled } = usePolling<PublicProfile & { footprints: Footprint[] }>(
    user ? `/api/farm/${user.github_id}` : null,
    { interval: 30_000, enabled: !!user }
  );

  // polling 결과로 footprints 업데이트
  useEffect(() => {
    if (farmPolled?.footprints) {
      setFootprints(farmPolled.footprints);
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
            },
            farm: profile.farm_snapshot,
            inventory: [],
            status_message: profile.status_message,
            bookmarks: [],
            activity: {
              today_input_chars: 0,
              today_harvests: 0,
              today_water_received: 0,
              today_water_given: 0,
              streak_days: 1,
              last_active_date: new Date().toISOString().slice(0, 10),
            },
            last_synced: profile.last_active,
          });
          setBookmarks([]);
        }
      }
      setLoading(false);
    }
    init();
  }, []);

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setState(MOCK_STATE);
    setBookmarks(MOCK_NEIGHBORS);
  };

  if (loading) {
    return (
      <div className="max-w-md mx-auto min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-bounce">🌱</div>
          <p className="opacity-60">{t.loading}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col bg-[var(--bg)]">
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        {user ? (
          <>
            <div className="flex items-center gap-2 text-sm">
              <img src={user.avatar_url} alt="" className="w-6 h-6 rounded-full" />
              <span className="font-bold">{user.nickname}</span>
            </div>
            <button onClick={handleLogout} className="text-xs opacity-40 hover:opacity-70">
              {t.logoutBtn}
            </button>
          </>
        ) : (
          <>
            <span className="text-xs opacity-40">{t.demoMode}</span>
            <a
              href="/api/auth/login"
              className="text-xs bg-[var(--accent)] text-black px-3 py-1 rounded-full font-bold hover:opacity-90"
            >
              {t.loginBtn}
            </a>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'farm' && <FarmView state={state} footprints={footprints} notifications={notifications} />}
        {tab === 'bag' && <BagView inventory={state.inventory} />}
        {tab === 'explore' && (
          <ExploreView
            bookmarks={bookmarks}
            currentUser={user?.github_id}
          />
        )}
      </div>
      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
