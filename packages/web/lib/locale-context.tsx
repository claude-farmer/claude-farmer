'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { detectLocale, getDict, type Locale, type Dict } from './i18n';

const LocaleContext = createContext<{ locale: Locale; t: Dict; setLocale: (l: Locale) => void }>({
  locale: 'en',
  t: getDict('en'),
  setLocale: () => {},
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>('en');

  useEffect(() => {
    const detected = detectLocale();
    setLocale(detected);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = detected === 'ko' ? 'ko-KR' : 'en-US';
    }
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale === 'ko' ? 'ko-KR' : 'en-US';
    }
  }, [locale]);

  const t = getDict(locale);

  return (
    <LocaleContext.Provider value={{ locale, t, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
