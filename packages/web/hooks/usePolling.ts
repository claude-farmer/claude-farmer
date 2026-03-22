'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface PollingOptions {
  interval: number;   // ms
  enabled: boolean;
}

export default function usePolling<T>(
  url: string | null,
  options: PollingOptions
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const urlRef = useRef(url);
  urlRef.current = url;

  const poll = useCallback(async () => {
    const currentUrl = urlRef.current;
    if (!currentUrl) return;
    try {
      const res = await fetch(currentUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      setData(result);
      setError(null);
    } catch (e) {
      setError(e as Error);
    }
  }, []);

  useEffect(() => {
    if (!options.enabled || !url) return;

    // 첫 로드 즉시
    poll();

    const id = setInterval(() => {
      // 탭이 비활성이면 스킵
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      poll();
    }, options.interval);

    return () => clearInterval(id);
  }, [poll, options.interval, options.enabled, url]);

  return { data, error, refetch: poll };
}
