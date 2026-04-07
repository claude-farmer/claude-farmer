'use client';

import { useState } from 'react';
import { useLocale } from '@/lib/locale-context';
import Icon from './Icon';
import { GACHA_ITEMS, getItemCounts } from '@claude-farmer/shared';
import { RARITY_COLOR } from '@claude-farmer/shared';
import type { InventoryItem } from '@claude-farmer/shared';

interface GiftPickerProps {
  inventory: InventoryItem[];
  onGift: (itemId: string) => void;
  onClose: () => void;
}

export default function GiftPicker({ inventory, onGift, onClose }: GiftPickerProps) {
  const { t } = useLocale();
  const [sending, setSending] = useState(false);
  const counts = getItemCounts(inventory);

  const giftableItems = GACHA_ITEMS.filter(item => (counts.get(item.id) ?? 0) > 0);

  const handleGift = async (itemId: string) => {
    if (sending) return;
    setSending(true);
    onGift(itemId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[var(--card)] rounded-t-xl w-full max-w-md p-4 max-h-[60vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="font-bold text-sm flex items-center gap-2">
            <Icon name="redeem" size={18} />
            {t.giftPickerTitle}
          </span>
          <button onClick={onClose} className="opacity-40 hover:opacity-100">
            <Icon name="close" size={18} />
          </button>
        </div>

        {giftableItems.length === 0 ? (
          <div className="text-center py-6 opacity-40 text-sm">{t.giftPickerEmpty}</div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {giftableItems.map(item => {
              const count = counts.get(item.id) ?? 0;
              return (
                <button
                  key={item.id}
                  onClick={() => handleGift(item.id)}
                  disabled={sending}
                  className="flex flex-col items-center gap-1 p-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors disabled:opacity-40"
                >
                  <div
                    className="w-8 h-8 rounded flex items-center justify-center text-lg"
                    style={{ backgroundColor: RARITY_COLOR[item.rarity] + '20' }}
                  >
                    {item.name.slice(0, 2)}
                  </div>
                  <span className="text-xs truncate w-full text-center">{item.name}</span>
                  <span className="text-xs opacity-50">×{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
