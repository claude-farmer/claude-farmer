'use client';

import FarmCanvas from './FarmCanvas';
import { TOTAL_ITEMS, getTimeOfDay } from '@claude-farmer/shared';
import type { LocalState, Footprint, FarmNotifications } from '@claude-farmer/shared';
import { useLocale } from '@/lib/locale-context';

interface FarmViewProps {
  state: LocalState;
  footprints?: Footprint[];
  notifications?: FarmNotifications | null;
}

export default function FarmView({ state, footprints, notifications }: FarmViewProps) {
  const { t } = useLocale();
  const { farm, user, status_message, inventory, activity } = state;
  const hour = new Date().getHours();
  const tod = getTimeOfDay(hour);
  const uniqueItems = new Set(inventory.map(i => i.id)).size;

  const greetingMap = {
    morning: t.greeting_morning,
    afternoon: t.greeting_afternoon,
    evening: t.greeting_evening,
    night: t.greeting_night,
  };
  const emojiMap = { morning: '☀️', afternoon: '☀️', evening: '🌅', night: '🌙' };

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🌱</span>
          <span className="font-bold">{user.nickname}</span>
          <span className="text-sm text-[var(--text)] opacity-50">Lv.{farm.level}</span>
        </div>
        <div className="text-sm opacity-75">
          {emojiMap[tod]} {greetingMap[tod]}
        </div>
      </div>

      <div className="rounded-lg overflow-hidden border border-[var(--border)]">
        <FarmCanvas grid={farm.grid} footprints={footprints} farmOwnerId={state.user.github_id} />
      </div>

      {notifications && notifications.visitor_count > 0 && (
        <div className="bg-[var(--card)] rounded-lg p-3 border border-[var(--border)] text-sm">
          <span className="opacity-50">👣</span>
          <span className="ml-2">
            {notifications.visitor_count}{t.times} {t.times === '' ? 'visitor(s)' : '명 방문'}
          </span>
          {notifications.water_received_count > 0 && (
            <span className="ml-3">
              💧 {notifications.water_received_count}{t.times} {t.times === '' ? 'watered' : '물 받음'}
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="bg-[var(--card)] rounded-lg p-3 border border-[var(--border)]">
          <span className="opacity-50">📦 {t.codex}</span>
          <span className="ml-2 font-bold">{uniqueItems}/{TOTAL_ITEMS}</span>
          <span className="text-xs opacity-40 ml-1">({Math.round(uniqueItems / TOTAL_ITEMS * 100)}%)</span>
        </div>
        <div className="bg-[var(--card)] rounded-lg p-3 border border-[var(--border)]">
          <span className="opacity-50">🪙 {t.harvests}</span>
          <span className="ml-2 font-bold">{farm.total_harvests}{t.times}</span>
        </div>
        <div className="bg-[var(--card)] rounded-lg p-3 border border-[var(--border)]">
          <span className="opacity-50">💧 {t.waterReceived}</span>
          <span className="ml-2 font-bold">{activity.today_water_received}{t.times}</span>
        </div>
        <div className="bg-[var(--card)] rounded-lg p-3 border border-[var(--border)]">
          <span className="opacity-50">🔥 {t.streak}</span>
          <span className="ml-2 font-bold">{activity.streak_days}{t.days}</span>
        </div>
      </div>

      <div className="bg-[var(--card)] rounded-lg p-3 border border-[var(--border)]">
        <div className="flex items-center gap-2">
          <span>💬</span>
          {status_message?.text ? (
            <span>{status_message.text}</span>
          ) : (
            <span className="opacity-40">{t.setBubble}</span>
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
