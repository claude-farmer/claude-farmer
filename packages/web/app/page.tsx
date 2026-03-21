'use client';

import { useState } from 'react';
import TabBar from '@/components/TabBar';
import FarmView from '@/components/FarmView';
import BagView from '@/components/BagView';
import ExploreView from '@/components/ExploreView';
import { MOCK_STATE, MOCK_NEIGHBORS } from '@/lib/mock-data';

export default function Home() {
  const [tab, setTab] = useState<'farm' | 'bag' | 'explore'>('farm');

  // TODO: 실제 API에서 데이터 가져오기
  const state = MOCK_STATE;

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col bg-[var(--bg)]">
      {/* 콘텐츠 */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'farm' && <FarmView state={state} />}
        {tab === 'bag' && <BagView inventory={state.inventory} />}
        {tab === 'explore' && <ExploreView bookmarks={MOCK_NEIGHBORS} />}
      </div>

      {/* 하단 탭 */}
      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
