'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { logout } from '@/lib/api';
import { useLocale } from '@/lib/locale-context';
import Icon from './Icon';

interface MenuDropdownProps {
  currentUser: string;
  isOwnFarm: boolean;
  onClose: () => void;
  onOpenEdit: () => void;
  onOpenCharacter: () => void;
  onOpenAbout: () => void;
  variant?: 'app' | 'account';
  anchor?: 'left' | 'right';
}

export default function MenuDropdown({ currentUser, isOwnFarm, onClose, onOpenEdit, onOpenCharacter, onOpenAbout, variant = 'account', anchor = 'right' }: MenuDropdownProps) {
  const { locale, setLocale, t } = useLocale();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleEsc(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    // Delay to avoid immediate close from the same click that opened it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    document.addEventListener('keydown', handleEsc);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  const handleLogout = async () => {
    onClose();
    await logout();
    router.push('/');
  };

  // 메뉴 항목 빌더
  const items: Array<{ icon: string; label: string; onClick: () => void; danger?: boolean; divider?: boolean }> = [];

  if (variant === 'app') {
    items.push({ icon: 'info', label: t.aboutMenuItem, onClick: onOpenAbout });
    items.push({
      icon: 'language',
      label: locale === 'ko' ? 'English' : '한국어',
      onClick: () => setLocale(locale === 'ko' ? 'en' : 'ko'),
    });
  } else {
    if (isOwnFarm) {
      items.push({ icon: 'edit', label: t.editProfileMenuItem, onClick: onOpenEdit });
      items.push({ icon: 'face', label: t.characterMenuItem, onClick: onOpenCharacter });
    } else {
      items.push({
        icon: 'home',
        label: t.myFarmMenuItem,
        onClick: () => { router.push(`/@${currentUser}`); onClose(); },
      });
    }
    items.push({
      icon: 'logout',
      label: t.logoutBtn,
      onClick: handleLogout,
      divider: true,
      danger: true,
    });
  }

  return (
    <>
      <div className="fixed inset-0 z-40 backdrop-blur-sm bg-black/20" onClick={onClose} />
    <div
      ref={ref}
      className={`absolute top-full mt-1 w-48 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-2xl overflow-hidden z-50 ${anchor === 'left' ? 'left-2' : 'right-2'}`}
    >
      {items.map((item, i) => (
        <button
          key={i}
          type="button"
          onClick={item.onClick}
          className={`flex items-center gap-3 w-full text-left px-3 py-2.5 text-sm hover:bg-[var(--bg)] transition-colors ${
            item.divider ? 'border-t border-[var(--border)]' : ''
          } ${item.danger ? 'text-red-400' : ''}`}
        >
          <Icon name={item.icon} size={18} />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
    </>
  );
}
