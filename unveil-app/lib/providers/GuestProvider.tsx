'use client';

import { ReactNode } from 'react';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import dynamic from 'next/dynamic';

// Lazy load ReactQueryProvider to reduce shared chunk size
const ReactQueryProvider = dynamic(
  () => import('@/lib/react-query-client').then((mod) => ({ default: mod.ReactQueryProvider })),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-100dvh">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
      </div>
    )
  }
);

// Lazy load AuthProvider to reduce shared chunk size
const AuthProvider = dynamic(
  () => import('@/lib/auth/AuthProvider').then((mod) => ({ default: mod.AuthProvider })),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-100dvh">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
      </div>
    )
  }
);

// Lazy load SubscriptionProvider for realtime functionality needed by guest pages
const SubscriptionProvider = dynamic(
  () => import('@/lib/realtime/SubscriptionProvider').then((mod) => ({ default: mod.SubscriptionProvider })),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-100dvh">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }
);

interface GuestProviderProps {
  children: ReactNode;
}

/**
 * Provider for guest routes with essential functionality
 * Includes realtime subscriptions for guest event updates
 * All heavy providers are lazy loaded to reduce shared chunk
 */
export function GuestProvider({ children }: GuestProviderProps) {
  return (
    <ErrorBoundary>
      <ReactQueryProvider>
        <AuthProvider>
          <SubscriptionProvider>
            {children}
          </SubscriptionProvider>
        </AuthProvider>
      </ReactQueryProvider>
    </ErrorBoundary>
  );
}
