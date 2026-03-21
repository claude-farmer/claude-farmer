'use client';

interface TabBarProps {
  active: 'farm' | 'bag' | 'explore';
  onChange: (tab: 'farm' | 'bag' | 'explore') => void;
}

const TABS = [
  { id: 'farm' as const, icon: '🏠', label: '농장' },
  { id: 'bag' as const, icon: '📖', label: '도감' },
  { id: 'explore' as const, icon: '🌍', label: '탐험' },
];

export default function TabBar({ active, onChange }: TabBarProps) {
  return (
    <nav className="flex border-t border-[var(--border)] bg-[var(--card)]">
      {TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex-1 py-3 text-center text-sm transition-colors ${
            active === tab.id
              ? 'text-[var(--accent)]'
              : 'text-[var(--text)] opacity-50 hover:opacity-75'
          }`}
        >
          <div className="text-lg">{tab.icon}</div>
          <div>{tab.label}</div>
        </button>
      ))}
    </nav>
  );
}
