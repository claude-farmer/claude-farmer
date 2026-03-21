'use client';

import { useState } from 'react';
import type { Rarity, InventoryItem } from '@claude-farmer/shared';
import { GACHA_ITEMS, RARITY_LABEL, RARITY_COLOR, TOTAL_ITEMS } from '@claude-farmer/shared';

interface BagViewProps {
  inventory: InventoryItem[];
}

export default function BagView({ inventory }: BagViewProps) {
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const ownedIds = new Set(inventory.map(i => i.id));
  const uniqueCount = ownedIds.size;

  const rarities: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

  const selected = selectedItem ? GACHA_ITEMS.find(i => i.id === selectedItem) : null;
  const selectedInv = selectedItem ? inventory.find(i => i.id === selectedItem) : null;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">📖 도감</h2>
        <span className="text-sm opacity-60">{uniqueCount}/{TOTAL_ITEMS} 수집</span>
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
                return (
                  <button
                    key={item.id}
                    onClick={() => isOwned ? setSelectedItem(item.id) : undefined}
                    className={`w-14 h-14 rounded-lg border flex items-center justify-center text-xs transition-all ${
                      isOwned
                        ? 'bg-[var(--card)] border-[var(--border)] hover:border-[var(--accent)] cursor-pointer'
                        : 'bg-[var(--bg)] border-[var(--border)] opacity-30 cursor-default'
                    }`}
                  >
                    {isOwned ? (
                      <span className="text-center leading-tight">{item.name}</span>
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
      {selected && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 max-w-xs w-full"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="w-16 h-16 rounded-lg mx-auto mb-3 flex items-center justify-center text-2xl"
                style={{ backgroundColor: RARITY_COLOR[selected.rarity] + '20', border: `2px solid ${RARITY_COLOR[selected.rarity]}` }}>
                {selected.name.charAt(0)}
              </div>
              <h3 className="font-bold text-lg">{selected.name}</h3>
              <p className="text-sm mt-1" style={{ color: RARITY_COLOR[selected.rarity] }}>
                {RARITY_LABEL[selected.rarity]}
              </p>
              <p className="text-xs opacity-50 mt-2">{selected.description}</p>
              {selectedInv && (
                <p className="text-xs opacity-40 mt-2">
                  최초 획득: {new Date(selectedInv.obtained_at).toLocaleDateString('ko-KR')}
                </p>
              )}
              <button
                onClick={() => setSelectedItem(null)}
                className="mt-4 px-4 py-2 bg-[var(--border)] rounded-lg text-sm hover:bg-[var(--accent)] hover:text-black transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
