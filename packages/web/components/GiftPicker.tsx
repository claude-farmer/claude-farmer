'use client';

import { useState } from 'react';
import { useLocale } from '@/lib/locale-context';
import { ITEM_EMOJI } from '@/lib/items';
import Icon from './Icon';
import { GACHA_ITEMS, getItemCounts, RARITY_COLOR, RARITY_LABEL } from '@claude-farmer/shared';
import type { InventoryItem } from '@claude-farmer/shared';

interface GiftPickerProps {
  inventory: InventoryItem[];
  onGift: (itemId: string) => void;
  onClose: () => void;
}

export default function GiftPicker({ inventory, onGift, onClose }: GiftPickerProps) {
  const { t, locale } = useLocale();
  const [sending, setSending] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const counts = getItemCounts(inventory);

  const giftableItems = GACHA_ITEMS.filter(item => (counts.get(item.id) ?? 0) > 0);

  const handleConfirm = async () => {
    if (!selected || sending) return;
    setSending(true);
    onGift(selected);
  };

  const selectedItem = selected ? GACHA_ITEMS.find(i => i.id === selected) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[var(--card)] rounded-t-2xl w-full max-w-md flex flex-col"
        style={{ maxHeight: '75vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[var(--border)] shrink-0">
          <span className="font-bold text-sm flex items-center gap-2">
            <Icon name="redeem" size={18} />
            {t.giftPickerTitle}
          </span>
          <button onClick={onClose} className="opacity-40 hover:opacity-100 transition-opacity">
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Item grid */}
        <div className="overflow-y-auto flex-1 p-3">
          {giftableItems.length === 0 ? (
            <div className="text-center py-10 opacity-40 text-sm">{t.giftPickerEmpty}</div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {giftableItems.map(item => {
                const count = counts.get(item.id) ?? 0;
                const isSelected = selected === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelected(isSelected ? null : item.id)}
                    disabled={sending}
                    className="flex flex-col items-center gap-1 p-2 rounded-xl border transition-all disabled:opacity-40 relative"
                    style={{
                      backgroundColor: isSelected ? RARITY_COLOR[item.rarity] + '20' : 'var(--bg)',
                      borderColor: isSelected ? RARITY_COLOR[item.rarity] : 'var(--border)',
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-2xl"
                      style={{ backgroundColor: RARITY_COLOR[item.rarity] + '15' }}
                    >
                      {ITEM_EMOJI[item.id] ?? item.name.charAt(0)}
                    </div>
                    <span className="text-[11px] leading-tight text-center w-full truncate opacity-80">
                      {item.name}
                    </span>
                    <span className="text-[10px] opacity-40">×{count}</span>
                    {isSelected && (
                      <div
                        className="absolute top-1 right-1 w-3 h-3 rounded-full"
                        style={{ backgroundColor: RARITY_COLOR[item.rarity] }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer: confirm button */}
        <div className="px-4 pb-5 pt-3 border-t border-[var(--border)] shrink-0">
          {selectedItem ? (
            <button
              onClick={handleConfirm}
              disabled={sending}
              className="w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              style={{
                backgroundColor: RARITY_COLOR[selectedItem.rarity],
                color: selectedItem.rarity === 'legendary' ? '#000' : '#fff',
              }}
            >
              <span className="text-lg">{ITEM_EMOJI[selectedItem.id] ?? selectedItem.name.charAt(0)}</span>
              {sending
                ? (locale === 'ko' ? '보내는 중…' : 'Sending…')
                : (locale === 'ko'
                    ? `${selectedItem.name} 보내기`
                    : `Send ${selectedItem.name}`)}
            </button>
          ) : (
            <div className="w-full py-3 rounded-xl text-sm text-center opacity-30 border border-[var(--border)]">
              {locale === 'ko' ? '선물할 아이템을 선택하세요' : 'Select an item to gift'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
