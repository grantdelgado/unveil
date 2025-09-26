'use client';

import { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useAfterPaint } from '@/lib/utils/performance';

// Lazy load React Query provider  
const ReactQueryProvider = dynamic(
  () => import('@/lib/react-query-client').then((mod) => ({ default: mod.ReactQueryProvider })),
  { ssr: false }
);

// Lazy load Auth provider
const AuthProvider = dynamic(
  () => import('@/lib/auth/AuthProvider').then((mod) => ({ default: mod.AuthProvider })),
  { ssr: false }
);

// Lazy load heavy providers only needed for host functionality
const SubscriptionProvider = dynamic(
  () => import('@/lib/realtime/SubscriptionProvider').then((mod) => ({ default: mod.SubscriptionProvider })),
  { ssr: false }
);

const PerformanceMonitor = dynamic(
  () => import('@/components/monitoring/PerformanceMonitor').then((mod) => ({ default: mod.PerformanceMonitor })),
  { ssr: false }
);

interface HostProviderProps {
  children: ReactNode;
}

/**
 * Host-specific provider with heavy features loaded after paint
 * Includes realtime subscriptions and performance monitoring deferred for LCP
 */
export function HostProvider({ children }: HostProviderProps) {
  const afterPaint = useAfterPaint();

  // Performance marks for observability (dev only)
  if (process.env.NODE_ENV === 'development' && afterPaint) {
    performance.mark('perf:realtime:init');
  }

  return (
    <ReactQueryProvider>
      <AuthProvider>
        {afterPaint ? (
          <SubscriptionProvider>
            <ErrorBoundary>
              <PerformanceMonitor>
                {children}
              </PerformanceMonitor>
            </ErrorBoundary>
          </SubscriptionProvider>
        ) : (
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        )}
      </AuthProvider>
    </ReactQueryProvider>
  );
}
