'use client';

import { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ReactQueryProvider } from '@/lib/react-query-client';
import { AuthProvider } from '@/lib/auth/AuthProvider';

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
 * Host-specific provider with heavy features loaded dynamically
 * Includes realtime subscriptions and performance monitoring
 */
export function HostProvider({ children }: HostProviderProps) {
  return (
    <ReactQueryProvider>
      <AuthProvider>
        <SubscriptionProvider>
          <ErrorBoundary>
            <PerformanceMonitor>
              {children}
            </PerformanceMonitor>
          </ErrorBoundary>
        </SubscriptionProvider>
      </AuthProvider>
    </ReactQueryProvider>
  );
}
