'use client';

import { ReactNode } from 'react';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import dynamic from 'next/dynamic';

// Only load essential providers for routing and error handling
const ReactQueryProvider = dynamic(
  () => import('@/lib/react-query-client').then((mod) => ({ default: mod.ReactQueryProvider })),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
      </div>
    )
  }
);

const AuthProvider = dynamic(
  () => import('@/lib/auth/AuthProvider').then((mod) => ({ default: mod.AuthProvider })),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
      </div>
    )
  }
);

interface LeanRootProviderProps {
  children: ReactNode;
}

/**
 * Lean root provider that only includes essential functionality
 * Heavy providers (SubscriptionProvider, PerformanceMonitor) are route-specific
 * 
 * Performance optimizations:
 * - No realtime subscriptions at root level
 * - No performance monitoring unless needed
 * - Minimal JavaScript for critical routes
 */
export function LeanRootProvider({ children }: LeanRootProviderProps) {
  return (
    <ErrorBoundary>
      <ReactQueryProvider>
        <AuthProvider>
          {children}
        </AuthProvider>
      </ReactQueryProvider>
    </ErrorBoundary>
  );
}
