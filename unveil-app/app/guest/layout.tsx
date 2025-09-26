'use client';

import { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { useAfterPaint } from '@/lib/utils/performance';

// Load SubscriptionProvider after paint to maintain performance
const SubscriptionProvider = dynamic(
  () => import('@/lib/realtime/SubscriptionProvider').then((mod) => ({ default: mod.SubscriptionProvider })),
  { 
    ssr: false,
    loading: () => null, // Don't show loading for provider
  }
);

interface GuestLayoutProps {
  children: ReactNode;
}

/**
 * Guest layout with safe SubscriptionProvider
 * Provider loads after paint to maintain LCP performance
 * Ensures hooks like useEventWithGuest have provider context
 */
export default function GuestLayout({ children }: GuestLayoutProps) {
  const afterPaint = useAfterPaint();

  return (
    <>
      {afterPaint ? (
        <SubscriptionProvider>
          {children}
        </SubscriptionProvider>
      ) : (
        children
      )}
    </>
  );
}
