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
}

export default function MenuDropdown({ currentUser, isOwnFarm, onClose, onOpenEdit, onOpenCharacter, onOpenAbout }: MenuDropdownProps) {
  const { locale, setLocale } = useLocale();
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

  if (isOwnFarm) {
    // 자기 농장: 정보 수정 + 캐릭터 + 소개 + 언어 + 로그아웃
    items.push({
      icon: 'edit',
      label: locale === 'ko' ? '정보 수정' : 'Edit Profile',
      // onOpenEdit이 setModal('edit')을 호출 → 메뉴는 자동으로 닫힘 (modal !== 'menu')
      onClick: onOpenEdit,
    });
    items.push({
      icon: 'face',
      label: locale === 'ko' ? '캐릭터' : 'Character',
      onClick: onOpenCharacter,
    });
  } else {
    // 방문 시: 내 농장 + 소개 + 언어 + 로그아웃
    items.push({
      icon: 'home',
      label: locale === 'ko' ? '내 농장' : 'My Farm',
      onClick: () => { router.push(`/@${currentUser}`); onClose(); },
    });
  }

  items.push({
    icon: 'info',
    label: locale === 'ko' ? '소개' : 'About',
    onClick: onOpenAbout,
    divider: true,
  });

  items.push({
    icon: 'language',
    label: locale === 'ko' ? 'English' : '한국어',
    // 언어 토글은 메뉴를 닫지 않고 그대로 둠
    onClick: () => setLocale(locale === 'ko' ? 'en' : 'ko'),
  });

  items.push({
    icon: 'logout',
    label: locale === 'ko' ? '로그아웃' : 'Logout',
    onClick: handleLogout,
    divider: true,
    danger: true,
  });

  return (
    <div
      ref={ref}
      className="absolute top-full right-2 mt-1 w-48 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-2xl overflow-hidden z-50"
    >
      {items.map((item, i) => (
        <button
          key={i}
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
  );
}
