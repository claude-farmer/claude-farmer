'use client';

import { useLocale } from '@/lib/locale-context';

interface TabBarProps {
  active: 'farm' | 'bag' | 'explore';
  onChange: (tab: 'farm' | 'bag' | 'explore') => void;
}

export default function TabBar({ active, onChange }: TabBarProps) {
  const { t } = useLocale();

  const tabs = [
    { id: 'farm' as const, icon: '🏠', label: t.tabFarm },
    { id: 'bag' as const, icon: '📖', label: t.tabBag },
    { id: 'explore' as const, icon: '🌍', label: t.tabExplore },
  ];

  return (
    <nav className="flex border-t border-[var(--border)] bg-[var(--card)]">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex-1 py-2 text-center text-sm transition-colors ${
            active === tab.id
              ? 'text-[var(--accent)]'
              : 'text-[var(--text)] opacity-50 hover:opacity-75'
          }`}
        >
          <div className="text-base">{tab.icon}</div>
          <div>{tab.label}</div>
        </button>
      ))}
    </nav>
  );
}
