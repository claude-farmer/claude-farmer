'use client';

import { useState, useEffect, useRef } from 'react';
import FarmCanvas, { type FarmCanvasHandle } from './FarmCanvas';
import GuestbookPanel from './GuestbookPanel';
import GiftPicker from './GiftPicker';
import { fetchFarmWithFootprints, waterUser, visitFarm, sendGift, waveSurf } from '@/lib/api';
import { useLocale } from '@/lib/locale-context';
import { WATER_COOLDOWN_SECONDS, GRID_SIZE, getFarmerTitle, GACHA_ITEMS, getItemCounts } from '@claude-farmer/shared';
import type { PublicProfile, Footprint, InventoryItem } from '@claude-farmer/shared';

interface FarmVisitViewProps {
  targetId: string;
  currentUserId: string;
  onBack: () => void;
  isBookmarked: boolean;
  onToggleBookmark: (targetId: string) => void;
  onNicknameLoaded?: (nickname: string) => void;
  isDemo?: boolean;
  userInventory?: InventoryItem[];
  onWaveSurf?: (targetId: string) => void;
}

export default function FarmVisitView({
  targetId,
  currentUserId,
  onBack,
  isBookmarked,
  onToggleBookmark,
  onNicknameLoaded,
  isDemo,
  userInventory = [],
  onWaveSurf,
}: FarmVisitViewProps) {
  const { t, locale } = useLocale();
  const canvasRef = useRef<FarmCanvasHandle>(null);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [footprints, setFootprints] = useState<Footprint[]>([]);
  const [cooldownLeft, setCooldownLeft] = useState(0); // seconds remaining
  const [watering, setWatering] = useState(false);
  const [waterFeedback, setWaterFeedback] = useState<string | null>(null);
  const [guestbookKey, setGuestbookKey] = useState(0);
  const [showGiftPicker, setShowGiftPicker] = useState(false);
  const [giftFeedback, setGiftFeedback] = useState(false);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const cooldownIntervalRef = useRef<ReturnType<typeof setInterval>>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    visitFarm(targetId);
    fetchFarmWithFootprints(targetId).then(data => {
      if (cancelled) return;
      if (data) {
        setProfile(data);
        setFootprints(data.footprints ?? []);
        onNicknameLoaded?.(data.nickname);
      }
    });

    return () => {
      cancelled = true;
      mountedRef.current = false;
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
    };
  }, [targetId]);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldownLeft <= 0) {
      if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
      return;
    }
    cooldownIntervalRef.current = setInterval(() => {
      setCooldownLeft(prev => {
        if (prev <= 1) {
          clearInterval(cooldownIntervalRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
    };
  }, [cooldownLeft]);

  const formatCooldown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleWater = async () => {
    if (cooldownLeft > 0 || watering) return;
    setWatering(true);
    const result = await waterUser(targetId);
    if (!mountedRef.current) return;

    if (result.ok) {
      setCooldownLeft(result.cooldown_seconds ?? WATER_COOLDOWN_SECONDS);
      // 랜덤 슬롯에 물 주기 애니메이션
      const occupiedSlots = profile?.farm_snapshot.grid
        .map((slot, i) => slot ? i : -1)
        .filter(i => i >= 0) ?? [];
      const slot = occupiedSlots.length > 0
        ? occupiedSlots[Math.floor(Math.random() * occupiedSlots.length)]
        : Math.floor(Math.random() * GRID_SIZE);
      canvasRef.current?.triggerWaterAnim(slot);
      setWaterFeedback('+1');
      setGuestbookKey(prev => prev + 1); // refresh guestbook
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => {
        if (mountedRef.current) setWaterFeedback(null);
      }, 1200);
    } else if (result.cooldown_remaining) {
      setCooldownLeft(result.cooldown_remaining);
    } else if (result.error) {
      setWaterFeedback('❌');
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => {
        if (mountedRef.current) setWaterFeedback(null);
      }, 1500);
    }
    setWatering(false);
  };

  const handleGift = async (itemId: string) => {
    const result = await sendGift(targetId, itemId);
    if (result.ok) {
      setShowGiftPicker(false);
      setGiftFeedback(true);
      setGuestbookKey(prev => prev + 1);
      setTimeout(() => setGiftFeedback(false), 1500);
    } else {
      setShowGiftPicker(false);
      setWaterFeedback('❌');
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => {
        if (mountedRef.current) setWaterFeedback(null);
      }, 1500);
    }
  };

  // 방문 대상 인벤토리에서 장식 계산
  const visitItemCounts = profile ? getItemCounts(profile.inventory ?? []) : new Map();
  const visitDecorations = profile ? GACHA_ITEMS
    .filter(item => (visitItemCounts.get(item.id) ?? 0) > 0)
    .map(item => ({ itemId: item.id, count: visitItemCounts.get(item.id) ?? 0, rarity: item.rarity })) : [];

  if (!profile) {
    return (
      <div className="flex flex-col gap-3 p-3">
        <div className="text-center py-12 opacity-40">{t.loading}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between">
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
          decorations={visitDecorations}
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

      {!isDemo && (
        <div className="flex gap-2">
          <button
            onClick={handleWater}
            disabled={cooldownLeft > 0 || watering}
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
            ) : cooldownLeft > 0 ? (
              `💧 ${formatCooldown(cooldownLeft)}`
            ) : (
              `💧 ${t.visitWater}`
            )}
          </button>
          <button
            onClick={() => setShowGiftPicker(true)}
            className="px-4 rounded-lg py-3 font-bold border bg-[var(--card)] border-[var(--border)] hover:border-pink-400 transition-colors"
          >
            {giftFeedback ? '✨' : `🎁 ${t.giftBtn}`}
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
      )}

      {/* 파도타기 */}
      {!isDemo && onWaveSurf && (
        <button
          onClick={async () => {
            const next = await waveSurf(targetId, currentUserId);
            if (next) onWaveSurf(next);
          }}
          className="w-full py-2 text-sm font-bold rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-blue-400 transition-colors"
        >
          🌊 {t.waveSurfBtn}
        </button>
      )}

      {/* 방명록 */}
      <GuestbookPanel farmId={targetId} refreshKey={guestbookKey} />

      {/* 선물 선택 모달 */}
      {showGiftPicker && (
        <GiftPicker
          inventory={userInventory}
          onGift={handleGift}
          onClose={() => setShowGiftPicker(false)}
        />
      )}
    </div>
  );
}
