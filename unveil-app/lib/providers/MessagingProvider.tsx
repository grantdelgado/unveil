'use client';

import { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { useAfterPaint } from '@/lib/utils/performance';

// Dynamic import SubscriptionProvider to defer realtime until after paint
const SubscriptionProvider = dynamic(
  () => import('@/lib/realtime/SubscriptionProvider').then((mod) => ({ default: mod.SubscriptionProvider })),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-4">
        <div className="animate-pulse space-y-2 w-full">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    )
  }
);

interface MessagingProviderProps {
  children: ReactNode;
}

/**
 * Messaging-specific provider that includes realtime subscriptions
 * Only mounted on routes that require messaging functionality
 * 
 * Performance optimizations:
 * - Defers SubscriptionProvider until after first paint
 * - Reduces initial JavaScript on non-messaging routes
 * - Maintains full messaging functionality with delayed initialization
 */
export function MessagingProvider({ children }: MessagingProviderProps) {
  const afterPaint = useAfterPaint();

  // Performance marks for observability (dev only)
  if (process.env.NODE_ENV === 'development' && afterPaint) {
    performance.mark('perf:realtime:init');
  }

  // Always provide SubscriptionProvider to prevent hook errors
  // The provider will be ready after paint, hooks will wait for readiness
  return (
    <SubscriptionProvider>
      {children}
    </SubscriptionProvider>
  );
}
