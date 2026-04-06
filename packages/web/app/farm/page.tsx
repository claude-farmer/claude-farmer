'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchSession } from '@/lib/api';

function FarmRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    async function init() {
      // ?visit=X → /@X 리다이렉트
      const visitParam = searchParams.get('visit');
      if (visitParam) {
        router.replace(`/@${visitParam}`);
        return;
      }

      // 로그인 → /@my-id, 비로그인 → /
      const session = await fetchSession();
      if (session) {
        router.replace(`/@${session.github_id}`);
      } else {
        router.replace('/');
      }
    }
    init();
  }, [router, searchParams]);

  return (
    <div className="max-w-md mx-auto min-h-screen flex items-center justify-center bg-[var(--bg)]">
      <div className="text-4xl animate-bounce">🌱</div>
    </div>
  );
}

export default function FarmPage() {
  return (
    <Suspense fallback={
      <div className="max-w-md mx-auto min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="text-4xl animate-bounce">🌱</div>
      </div>
    }>
      <FarmRedirect />
    </Suspense>
  );
}
