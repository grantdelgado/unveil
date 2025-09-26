'use client';

import { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

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

// Performance monitoring for host routes
const PerformanceMonitor = dynamic(
  () => import('@/components/monitoring/PerformanceMonitor').then((mod) => ({ default: mod.PerformanceMonitor })),
  { ssr: false }
);

interface LeanHostProviderProps {
  children: ReactNode;
}

/**
 * Lean host provider without realtime subscriptions
 * Used for host routes that don't need messaging (dashboard, guests, etc.)
 * SubscriptionProvider is added only on messaging routes
 */
export function LeanHostProvider({ children }: LeanHostProviderProps) {
  return (
    <ReactQueryProvider>
      <AuthProvider>
        <ErrorBoundary>
          <PerformanceMonitor>
            {children}
          </PerformanceMonitor>
        </ErrorBoundary>
      </AuthProvider>
    </ReactQueryProvider>
  );
}
