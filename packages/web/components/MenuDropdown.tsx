'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { logout } from '@/lib/api';
import { useLocale } from '@/lib/locale-context';

interface MenuDropdownProps {
  currentUser: string;
  onClose: () => void;
  onOpenCharacter: () => void;
}

export default function MenuDropdown({ currentUser, onClose, onOpenCharacter }: MenuDropdownProps) {
  const { locale, setLocale } = useLocale();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleEsc(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  return (
    <div
      ref={ref}
      className="absolute top-full left-2 mt-1 w-44 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-2xl overflow-hidden z-50"
    >
      <Link
        href={`/@${currentUser}`}
        onClick={onClose}
        className="block px-3 py-2 text-sm hover:bg-[var(--bg)] transition-colors"
      >
        🏠 {locale === 'ko' ? '내 농장' : 'My Farm'}
      </Link>
      <button
        onClick={() => { onOpenCharacter(); onClose(); }}
        className="block w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg)] transition-colors"
      >
        ✏️ {locale === 'ko' ? '캐릭터' : 'Character'}
      </button>
      <Link
        href="/"
        onClick={onClose}
        className="block px-3 py-2 text-sm hover:bg-[var(--bg)] transition-colors border-t border-[var(--border)]"
      >
        🌱 {locale === 'ko' ? '소개' : 'About'}
      </Link>
      <button
        onClick={() => { setLocale(locale === 'ko' ? 'en' : 'ko'); }}
        className="block w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg)] transition-colors"
      >
        🌐 {locale === 'ko' ? 'English' : '한국어'}
      </button>
      <button
        onClick={handleLogout}
        className="block w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg)] transition-colors border-t border-[var(--border)] text-red-400"
      >
        🚪 {locale === 'ko' ? '로그아웃' : 'Logout'}
      </button>
    </div>
  );
}
