'use client';

import { useState, useEffect } from 'react';
import TabBar from '@/components/TabBar';
import FarmView from '@/components/FarmView';
import BagView from '@/components/BagView';
import ExploreView from '@/components/ExploreView';
import { fetchSession, fetchFarm, logout } from '@/lib/api';
import { MOCK_STATE, MOCK_NEIGHBORS } from '@/lib/mock-data';
import type { LocalState, PublicProfile } from '@claude-farmer/shared';

export default function FarmApp() {
  const [tab, setTab] = useState<'farm' | 'bag' | 'explore'>('farm');
  const [user, setUser] = useState<{ github_id: string; nickname: string; avatar_url: string } | null>(null);
  const [state, setState] = useState<LocalState>(MOCK_STATE);
  const [loading, setLoading] = useState(true);
  const [bookmarks, setBookmarks] = useState<PublicProfile[]>(MOCK_NEIGHBORS);

  useEffect(() => {
    async function init() {
      const session = await fetchSession();
      if (session) {
        setUser(session);
        // 실제 프로필 데이터 로드
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
          <p className="opacity-60">농장 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col bg-[var(--bg)]">
      {/* 인증 상태 헤더 */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        {user ? (
          <>
            <div className="flex items-center gap-2 text-sm">
              <img src={user.avatar_url} alt="" className="w-6 h-6 rounded-full" />
              <span className="font-bold">{user.nickname}</span>
            </div>
            <button onClick={handleLogout} className="text-xs opacity-40 hover:opacity-70">
              로그아웃
            </button>
          </>
        ) : (
          <>
            <span className="text-xs opacity-40">데모 모드</span>
            <a
              href="/api/auth/login"
              className="text-xs bg-[var(--accent)] text-black px-3 py-1 rounded-full font-bold hover:opacity-90"
            >
              GitHub 로그인
            </a>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'farm' && <FarmView state={state} />}
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
