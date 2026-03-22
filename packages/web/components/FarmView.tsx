'use client';

import { useRef, useEffect, useState } from 'react';
import FarmCanvas, { type FarmCanvasHandle } from './FarmCanvas';
import { TOTAL_ITEMS, getTimeOfDay, getFarmerTitle } from '@claude-farmer/shared';
import type { LocalState, Footprint, FarmNotifications } from '@claude-farmer/shared';
import { useLocale } from '@/lib/locale-context';

interface FarmViewProps {
  state: LocalState;
  footprints?: Footprint[];
  notifications?: FarmNotifications | null;
  serverUniqueItems?: number;
  isLoggedIn?: boolean;
  onStatusUpdate?: (text: string) => void;
}

export default function FarmView({ state, footprints, notifications, serverUniqueItems, isLoggedIn, onStatusUpdate }: FarmViewProps) {
  const { t, locale } = useLocale();
  const canvasRef = useRef<FarmCanvasHandle>(null);
  const prevWaterCountRef = useRef<number | null>(null);
  const [editingStatus, setEditingStatus] = useState(false);
  const [statusDraft, setStatusDraft] = useState('');
  const statusInputRef = useRef<HTMLInputElement>(null);
  const { farm, user, status_message, inventory, activity } = state;

  // 물 받을 때 캔버스 이펙트 트리거
  useEffect(() => {
    const count = notifications?.water_received_count ?? 0;
    if (prevWaterCountRef.current !== null && count > prevWaterCountRef.current) {
      // 새로운 물 → 랜덤 슬롯에 이펙트
      const occupied = farm.grid
        .map((s, i) => s ? i : -1)
        .filter(i => i >= 0);
      const slot = occupied.length > 0
        ? occupied[Math.floor(Math.random() * occupied.length)]
        : 0;
      const latest = notifications?.water_received?.[0];
      canvasRef.current?.triggerWaterReceivedEffect(slot, latest?.from_nickname);
    }
    prevWaterCountRef.current = count;
  }, [notifications?.water_received_count, notifications?.water_received, farm.grid]);
  const hour = new Date().getHours();
  const tod = getTimeOfDay(hour);
  const localUniqueItems = new Set(inventory.map(i => i.id)).size;
  const uniqueItems = localUniqueItems > 0 ? localUniqueItems : (serverUniqueItems ?? 0);
  const waterReceivedCount = notifications?.water_received_count ?? activity.today_water_received;
  const farmerTitle = getFarmerTitle(activity.today_input_chars);

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
          {farmerTitle.emoji} {locale === 'ko' ? farmerTitle.ko : farmerTitle.en}
        </div>
      </div>

      <div className="rounded-lg overflow-hidden border border-[var(--border)]">
        <FarmCanvas ref={canvasRef} grid={farm.grid} footprints={footprints} farmOwnerId={state.user.github_id} />
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
          <span className="ml-2 font-bold">{waterReceivedCount}{t.times}</span>
        </div>
        <div className="bg-[var(--card)] rounded-lg p-3 border border-[var(--border)]">
          <span className="opacity-50">🔥 {t.streak}</span>
          <span className="ml-2 font-bold">{activity.streak_days}{t.days}</span>
        </div>
      </div>

      <div className="bg-[var(--card)] rounded-lg p-3 border border-[var(--border)]">
        {editingStatus ? (
          <div className="flex items-center gap-2">
            <span>💬</span>
            <input
              ref={statusInputRef}
              type="text"
              value={statusDraft}
              onChange={e => setStatusDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  onStatusUpdate?.(statusDraft);
                  setEditingStatus(false);
                } else if (e.key === 'Escape') {
                  setEditingStatus(false);
                }
              }}
              maxLength={200}
              placeholder={t.setBubble}
              className="flex-1 bg-transparent border-b border-[var(--border)] outline-none text-sm px-1 py-0.5"
              autoFocus
            />
            <button
              onClick={() => {
                onStatusUpdate?.(statusDraft);
                setEditingStatus(false);
              }}
              className="text-xs bg-[var(--accent)] text-black px-2 py-1 rounded font-bold hover:opacity-90"
            >
              OK
            </button>
            <button
              onClick={() => setEditingStatus(false)}
              className="text-xs opacity-40 hover:opacity-70 px-1"
            >
              ✕
            </button>
          </div>
        ) : (
          <div
            className={`flex items-center gap-2 ${isLoggedIn ? 'cursor-pointer hover:opacity-80' : ''}`}
            onClick={() => {
              if (!isLoggedIn) return;
              setStatusDraft(status_message?.text ?? '');
              setEditingStatus(true);
            }}
          >
            <span>💬</span>
            {status_message?.text ? (
              <span>{status_message.text}</span>
            ) : (
              <span className="opacity-40">{t.setBubble}</span>
            )}
            {isLoggedIn && <span className="ml-auto text-xs opacity-30">✏️</span>}
          </div>
        )}
        {!editingStatus && status_message?.link && (
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
