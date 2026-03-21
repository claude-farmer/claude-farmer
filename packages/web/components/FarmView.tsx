'use client';

import FarmCanvas from './FarmCanvas';
import { TOTAL_ITEMS, getTimeOfDay, TIME_GREETING, TIME_EMOJI } from '@claude-farmer/shared';
import type { LocalState } from '@claude-farmer/shared';

interface FarmViewProps {
  state: LocalState;
}

export default function FarmView({ state }: FarmViewProps) {
  const { farm, user, status_message, inventory, activity } = state;
  const hour = new Date().getHours();
  const tod = getTimeOfDay(hour);
  const uniqueItems = new Set(inventory.map(i => i.id)).size;

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* 상단 바 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🌱</span>
          <span className="font-bold">{user.nickname}</span>
          <span className="text-sm text-[var(--text)] opacity-50">Lv.{farm.level}</span>
        </div>
        <div className="text-sm opacity-75">
          {TIME_EMOJI[tod]} {TIME_GREETING[tod]}
        </div>
      </div>

      {/* 농장 캔버스 */}
      <div className="rounded-lg overflow-hidden border border-[var(--border)]">
        <FarmCanvas grid={farm.grid} />
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="bg-[var(--card)] rounded-lg p-3 border border-[var(--border)]">
          <span className="opacity-50">📦 도감</span>
          <span className="ml-2 font-bold">{uniqueItems}/{TOTAL_ITEMS}</span>
          <span className="text-xs opacity-40 ml-1">({Math.round(uniqueItems / TOTAL_ITEMS * 100)}%)</span>
        </div>
        <div className="bg-[var(--card)] rounded-lg p-3 border border-[var(--border)]">
          <span className="opacity-50">🪙 수확</span>
          <span className="ml-2 font-bold">{farm.total_harvests}회</span>
        </div>
        <div className="bg-[var(--card)] rounded-lg p-3 border border-[var(--border)]">
          <span className="opacity-50">💧 받은 물</span>
          <span className="ml-2 font-bold">{activity.today_water_received}회</span>
        </div>
        <div className="bg-[var(--card)] rounded-lg p-3 border border-[var(--border)]">
          <span className="opacity-50">🔥 연속</span>
          <span className="ml-2 font-bold">{activity.streak_days}일</span>
        </div>
      </div>

      {/* 말풍선 */}
      <div className="bg-[var(--card)] rounded-lg p-3 border border-[var(--border)]">
        <div className="flex items-center gap-2">
          <span>💬</span>
          {status_message?.text ? (
            <span>{status_message.text}</span>
          ) : (
            <span className="opacity-40">말풍선을 설정해보세요</span>
          )}
        </div>
        {status_message?.link && (
          <a
            href={status_message.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--accent)] mt-1 block hover:underline"
          >
            🔗 {status_message.link}
          </a>
        )}
      </div>
    </div>
  );
}
