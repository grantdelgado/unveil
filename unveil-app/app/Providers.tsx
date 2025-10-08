'use client';

import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { RumCollectorWrapper } from '@/components/common/RumCollectorWrapper';
import { qk } from '@/lib/queryKeys';
import { initQueryObservability } from '@/lib/queryObservability';

// Import full-featured AuthProvider for complete functionality
import { AuthProvider } from '@/lib/auth/AuthProvider';

// Create a singleton QueryClient to avoid recreating on re-renders
let queryClient: QueryClient | undefined;

function getQueryClient() {
  if (!queryClient) {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          // Stale time: How long data is considered fresh
          staleTime: 5 * 60 * 1000, // 5 minutes for most data

          // Cache time: How long data stays in cache when not being used
          gcTime: 10 * 60 * 1000, // 10 minutes (renamed from cacheTime)

          // Retry configuration
          retry: (failureCount, error: unknown) => {
            // Don't retry on 4xx errors (client errors)
            const errorWithStatus = error as { status?: number };
            if (
              errorWithStatus?.status &&
              errorWithStatus.status >= 400 &&
              errorWithStatus.status < 500
            ) {
              return false;
            }
            // Retry up to 3 times for other errors
            return failureCount < 3;
          },

          // Retry delay with exponential backoff
          retryDelay: (attemptIndex) =>
            Math.min(1000 * 2 ** attemptIndex, 30000),

          // Disable refetch on window focus to reduce unnecessary API calls
          refetchOnWindowFocus: false,

          // Don't refetch on reconnect for cached data
          refetchOnReconnect: 'always',
        },
        mutations: {
          // Retry mutations once on network error
          retry: (failureCount, error: unknown) => {
            const errorWithStatus = error as { status?: number };
            if (
              errorWithStatus?.status &&
              errorWithStatus.status >= 400 &&
              errorWithStatus.status < 500
            ) {
              return false;
            }
            return failureCount < 1;
          },
        },
      },
    });

    // Set per-domain query defaults using canonical keys
    // Messages - realtime data, short stale time
    queryClient.setQueryDefaults(qk.messages.list('placeholder'), {
      staleTime: 30_000, // 30 seconds
      gcTime: 5 * 60_000, // 5 minutes
      refetchOnWindowFocus: false, // Rely on realtime updates
    });

    // Media - longer stale time as content doesn't change frequently
    queryClient.setQueryDefaults(qk.media.feed('placeholder'), {
      staleTime: 10 * 60_000, // 10 minutes 
      gcTime: 20 * 60_000, // 20 minutes
      refetchOnWindowFocus: false,
    });

    // Guest lists - moderate stale time, important for RSVP accuracy
    queryClient.setQueryDefaults(qk.eventGuests.list('placeholder'), {
      staleTime: 60_000, // 1 minute
      gcTime: 10 * 60_000, // 10 minutes
      refetchOnWindowFocus: false, // Rely on realtime for RSVP changes
    });

    // Guest counts - need immediate updates for dashboard accuracy
    queryClient.setQueryDefaults(qk.eventGuests.counts('placeholder'), {
      staleTime: 30_000, // 30 seconds
      gcTime: 5 * 60_000, // 5 minutes
      refetchOnWindowFocus: false,
    });

    // Scheduled messages - immediate freshness for host management
    queryClient.setQueryDefaults(qk.scheduledMessages.list('placeholder'), {
      staleTime: 0, // Always stale, always fresh
      gcTime: 10 * 60_000, // 10 minutes
      refetchOnWindowFocus: true, // Refetch for immediate state
      refetchOnMount: 'always',
    });

    // Analytics - longer cache as calculations are expensive
    queryClient.setQueryDefaults(qk.analytics.event('placeholder'), {
      staleTime: 15 * 60_000, // 15 minutes
      gcTime: 30 * 60_000, // 30 minutes
      refetchOnWindowFocus: false,
    });

    // Events - static data, long cache
    queryClient.setQueryDefaults(qk.events.listMine(), {
      staleTime: 15 * 60_000, // 15 minutes
      gcTime: 30 * 60_000, // 30 minutes
      refetchOnWindowFocus: false,
    });

    // User data - very static, long cache
    queryClient.setQueryDefaults(qk.users.me(), {
      staleTime: 60 * 60_000, // 1 hour
      gcTime: 24 * 60 * 60_000, // 24 hours
      refetchOnWindowFocus: false,
    });

    // Auto-initialize observability (noop in production)
    initQueryObservability(queryClient);
  }

  return queryClient;
}

interface ProvidersProps {
  children: ReactNode;
}

/**
 * 🚀 DETERMINISTIC FIRST PAINT: Minimal synchronous providers
 * 
 * This provider uses ONLY static imports to ensure deterministic first paint on iOS:
 * - No next/dynamic imports that cause CSR bailouts
 * - Singleton QueryClient to prevent recreation
 * - Browser APIs are guarded inside useEffect in child components
 * - Minimal JavaScript bundle for critical rendering path
 * 
 * Performance optimizations:
 * - Static imports only - no code splitting at root level
 * - Singleton pattern for QueryClient
 * - Lightweight error boundary and RUM collection
 * - Auth provider guards browser APIs internally
 */
export function Providers({ children }: ProvidersProps) {
  // Log provider mount for observability (PII-safe, dev only)
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.info('[Providers] mounted');
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={getQueryClient()}>
        <AuthProvider>
          <RumCollectorWrapper />
          {children}
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
