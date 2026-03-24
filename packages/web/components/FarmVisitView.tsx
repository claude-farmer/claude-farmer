'use client';

import { useState, useEffect, useRef } from 'react';
import FarmCanvas, { type FarmCanvasHandle } from './FarmCanvas';
import { fetchFarmWithFootprints, waterUser, visitFarm } from '@/lib/api';
import { useLocale } from '@/lib/locale-context';
import { DAILY_WATER_LIMIT, GRID_SIZE, getFarmerTitle } from '@claude-farmer/shared';
import type { PublicProfile, Footprint } from '@claude-farmer/shared';

interface FarmVisitViewProps {
  targetId: string;
  currentUserId: string;
  onBack: () => void;
  isBookmarked: boolean;
  onToggleBookmark: (targetId: string) => void;
}

export default function FarmVisitView({
  targetId,
  currentUserId,
  onBack,
  isBookmarked,
  onToggleBookmark,
}: FarmVisitViewProps) {
  const { t, locale } = useLocale();
  const canvasRef = useRef<FarmCanvasHandle>(null);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [footprints, setFootprints] = useState<Footprint[]>([]);
  const [waterRemaining, setWaterRemaining] = useState(DAILY_WATER_LIMIT);
  const [watering, setWatering] = useState(false);
  const [waterFeedback, setWaterFeedback] = useState<string | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    // 방문 기록 + 프로필 로드
    visitFarm(targetId);
    fetchFarmWithFootprints(targetId).then(data => {
      if (cancelled) return;
      if (data) {
        setProfile(data);
        setFootprints(data.footprints ?? []);
      }
    });

    return () => {
      cancelled = true;
      mountedRef.current = false;
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, [targetId]);

  const handleWater = async () => {
    if (waterRemaining <= 0 || watering) return;
    setWatering(true);
    const result = await waterUser(targetId);
    if (!mountedRef.current) return;
    if (result.ok && result.remaining != null) {
      setWaterRemaining(result.remaining);
      // 랜덤 슬롯에 물 주기 애니메이션
      const occupiedSlots = profile?.farm_snapshot.grid
        .map((slot, i) => slot ? i : -1)
        .filter(i => i >= 0) ?? [];
      const slot = occupiedSlots.length > 0
        ? occupiedSlots[Math.floor(Math.random() * occupiedSlots.length)]
        : Math.floor(Math.random() * GRID_SIZE);
      canvasRef.current?.triggerWaterAnim(slot);
      setWaterFeedback('+1');
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => {
        if (mountedRef.current) setWaterFeedback(null);
      }, 1200);
    } else if (result.remaining === 0) {
      setWaterRemaining(0);
    }
    setWatering(false);
  };

  if (!profile) {
    return (
      <div className="flex flex-col gap-3 p-3">
        <button onClick={onBack} className="text-sm opacity-60 self-start">
          ← {t.visitBack}
        </button>
        <div className="text-center py-12 opacity-40">{t.loading}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm opacity-60">
          ← {t.visitBack}
        </button>
        <div className="flex items-center gap-2">
          <span className="font-bold">{profile.nickname}</span>
          <span className="text-sm opacity-50">{t.visitLevel}{profile.level}</span>
        </div>
      </div>

      <div className="rounded-lg overflow-hidden border border-[var(--border)]">
        <FarmCanvas
          ref={canvasRef}
          grid={profile.farm_snapshot.grid}
          footprints={footprints}
          farmOwnerId={targetId}
          clickToMove={false}
          ownerNickname={profile.nickname}
          ownerLevel={profile.level}
          ownerStatusText={profile.status_message?.text}
          ownerStatusLink={profile.status_message?.link}
          ownerTotalHarvests={profile.total_harvests}
          ownerUniqueItems={profile.unique_items}
          ownerCharacter={profile.character}
          ownerAvatarUrl={profile.avatar_url}
        />
      </div>

      {profile.status_message?.text && (
        <div className="bg-[var(--card)] rounded-lg p-3 border border-[var(--border)]">
          <span>💬 {profile.status_message.text}</span>
          {profile.status_message.link && /^https?:\/\//i.test(profile.status_message.link) && (
            <a
              href={profile.status_message.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[var(--accent)] mt-1 block hover:underline"
            >
              🔗 {profile.status_message.link}
            </a>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="bg-[var(--card)] rounded-lg p-3 border border-[var(--border)]">
          <span className="opacity-50">🪙 {t.harvests}</span>
          <span className="ml-2 font-bold">{profile.total_harvests}{t.times}</span>
        </div>
        <div className="bg-[var(--card)] rounded-lg p-3 border border-[var(--border)]">
          {(() => {
            const title = getFarmerTitle(profile.today_input_chars ?? 0);
            return (
              <span>
                <span className="opacity-50">{title.emoji}</span>
                <span className="ml-2 font-bold">{locale === 'ko' ? title.ko : title.en}</span>
              </span>
            );
          })()}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleWater}
          disabled={waterRemaining <= 0 || watering}
          className={`flex-1 font-bold rounded-lg py-3 transition-all disabled:opacity-40 ${
            watering
              ? 'bg-blue-400 text-white scale-95'
              : 'bg-blue-500 text-white hover:opacity-90'
          }`}
        >
          {watering ? (
            <span className="inline-block animate-bounce">💧</span>
          ) : waterFeedback ? (
            <span className="text-yellow-200 font-bold animate-pulse">{waterFeedback} 💧 {t.visitWater}!</span>
          ) : waterRemaining > 0 ? (
            `💧 ${t.visitWater} (${waterRemaining}/${DAILY_WATER_LIMIT})`
          ) : (
            t.visitWaterDone
          )}
        </button>
        <button
          onClick={() => onToggleBookmark(targetId)}
          className={`px-4 rounded-lg py-3 font-bold border transition-colors ${
            isBookmarked
              ? 'bg-[var(--accent)] text-black border-[var(--accent)]'
              : 'bg-[var(--card)] border-[var(--border)] hover:border-[var(--accent)]'
          }`}
        >
          {isBookmarked ? `⭐ ${t.visitBookmarked}` : `🔖 ${t.visitBookmark}`}
        </button>
      </div>
    </div>
  );
}
