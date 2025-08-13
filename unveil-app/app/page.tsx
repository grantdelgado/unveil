'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { LoadingSpinner } from '@/components/ui';
import { UnveilHeader } from '@/components/shared';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const waitMinDisplay = () =>
      new Promise<void>((resolve) => {
        timeoutId = setTimeout(() => resolve(), 1500);
      });

    const load = async () => {
      try {
        const [{ data: { session } }] = await Promise.all([
          supabase.auth.getSession(),
          waitMinDisplay(),
        ]);
        if (!isMounted) return;
        router.replace(session ? '/select-event' : '/login');
      } catch {
        if (!isMounted) return;
        router.replace('/login');
      }
    };

    load();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [router]);

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col items-center justify-center px-6 text-gray-900" aria-busy="true" aria-live="polite">
      <UnveilHeader size="lg" showTagline />
      <div className="mt-8">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    </div>
  );
}
