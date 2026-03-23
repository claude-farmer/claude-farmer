'use client';

import { useState, useEffect } from 'react';
import type { Rarity, InventoryItem } from '@claude-farmer/shared';
import { GACHA_ITEMS, RARITY_LABEL, RARITY_COLOR, TOTAL_ITEMS, getEvolutionTier, getNextEvolutionThreshold, EVOLUTION_TIERS } from '@claude-farmer/shared';
import { getItemCounts } from '@claude-farmer/shared';
import { useLocale } from '@/lib/locale-context';

interface BagViewProps {
  inventory: InventoryItem[];
}

export default function BagView({ inventory }: BagViewProps) {
  const { t, locale } = useLocale();
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const ownedIds = new Set(inventory.map(i => i.id));
  const uniqueCount = ownedIds.size;
  const itemCounts = getItemCounts(inventory);

  const rarities: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

  const selected = selectedItem ? GACHA_ITEMS.find(i => i.id === selectedItem) : null;
  const selectedInv = selectedItem ? inventory.find(i => i.id === selectedItem) : null;

  // Escape key to close modal
  useEffect(() => {
    if (!selectedItem) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedItem(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedItem]);

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">📖 {t.bagTitle}</h2>
        <span className="text-sm opacity-60">{uniqueCount}/{TOTAL_ITEMS}</span>
      </div>

      {rarities.map(rarity => {
        const pool = GACHA_ITEMS.filter(i => i.rarity === rarity);
        const owned = pool.filter(i => ownedIds.has(i.id));
        const pct = pool.length > 0 ? (owned.length / pool.length) * 100 : 0;

        return (
          <div key={rarity}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold" style={{ color: RARITY_COLOR[rarity] }}>
                {RARITY_LABEL[rarity]}
              </span>
              <span className="text-xs opacity-50">{owned.length}/{pool.length}</span>
            </div>

            {/* 프로그레스 바 */}
            <div className="w-full h-1.5 bg-[var(--border)] rounded-full mb-3 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: RARITY_COLOR[rarity] }}
              />
            </div>

            {/* 아이템 그리드 */}
            <div className="flex flex-wrap gap-2">
              {pool.map(item => {
                const isOwned = ownedIds.has(item.id);
                const count = itemCounts.get(item.id) || 0;
                const tier = getEvolutionTier(count);
                return (
                  <button
                    key={item.id}
                    onClick={() => isOwned ? setSelectedItem(item.id) : undefined}
                    className={`w-12 h-12 rounded-lg border flex items-center justify-center text-xs transition-all relative ${
                      isOwned
                        ? 'bg-[var(--card)] border-[var(--border)] hover:border-[var(--accent)] cursor-pointer'
                        : 'bg-[var(--bg)] border-[var(--border)] opacity-30 cursor-default'
                    }`}
                  >
                    {isOwned ? (
                      <>
                        <span className="text-center leading-tight">{item.name}</span>
                        {count > 1 && (
                          <span className="absolute top-0.5 right-1 text-[9px] opacity-50">
                            ×{count}
                          </span>
                        )}
                        {tier.stars > 0 && (
                          <span className="absolute bottom-0.5 left-0.5 text-[8px]" style={{ color: RARITY_COLOR[item.rarity] }}>
                            {tier.label}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-lg">?</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* 아이템 상세 팝업 */}
      {selected && (() => {
        const count = itemCounts.get(selected.id) || 0;
        const tier = getEvolutionTier(count);
        const nextThreshold = getNextEvolutionThreshold(count);
        const maxThreshold = EVOLUTION_TIERS[EVOLUTION_TIERS.length - 1].threshold;

        return (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedItem(null)}
          >
            <div
              className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 max-w-xs w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="text-center">
                <div className="w-16 h-16 rounded-lg mx-auto mb-3 flex items-center justify-center text-2xl"
                  style={{ backgroundColor: RARITY_COLOR[selected.rarity] + '20', border: `2px solid ${RARITY_COLOR[selected.rarity]}` }}>
                  {selected.name.charAt(0)}
                </div>
                <h3 className="font-bold text-lg">
                  {selected.name} {tier.label && <span style={{ color: RARITY_COLOR[selected.rarity] }}>{tier.label}</span>}
                </h3>
                <p className="text-sm mt-1" style={{ color: RARITY_COLOR[selected.rarity] }}>
                  {RARITY_LABEL[selected.rarity]}
                </p>
                <p className="text-xs opacity-50 mt-2">{selected.description}</p>

                {/* 보유 수량 */}
                <p className="text-sm font-bold mt-3 opacity-70">×{count}</p>

                {/* 진화 진행 바 */}
                <div className="mt-2">
                  <div className="w-full h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (count / maxThreshold) * 100)}%`,
                        backgroundColor: RARITY_COLOR[selected.rarity],
                      }}
                    />
                  </div>
                  <p className="text-[10px] opacity-40 mt-1">
                    {nextThreshold
                      ? t.bagNextEvolution.replace('{needed}', String(nextThreshold - count))
                      : t.bagMaxEvolution}
                  </p>
                </div>

                {selectedInv && (
                  <p className="text-xs opacity-40 mt-2">
                    {new Date(selectedInv.obtained_at).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US')}
                  </p>
                )}
                <button
                  onClick={() => setSelectedItem(null)}
                  className="mt-4 px-4 py-2 bg-[var(--border)] rounded-lg text-sm hover:bg-[var(--accent)] hover:text-black transition-colors"
                >
                  {locale === 'ko' ? '닫기' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
