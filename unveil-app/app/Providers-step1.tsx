'use client';

import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create a singleton QueryClient to avoid recreating on re-renders
let queryClient: QueryClient | undefined;

function getQueryClient() {
  if (!queryClient) {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 5 * 60 * 1000, // 5 minutes
          gcTime: 10 * 60 * 1000, // 10 minutes
          retry: (failureCount, error: unknown) => {
            const errorWithStatus = error as { status?: number };
            if (
              errorWithStatus?.status &&
              errorWithStatus.status >= 400 &&
              errorWithStatus.status < 500
            ) {
              return false;
            }
            return failureCount < 3;
          },
          retryDelay: (attemptIndex) =>
            Math.min(1000 * 2 ** attemptIndex, 30000),
          refetchOnWindowFocus: false,
          refetchOnReconnect: 'always',
        },
        mutations: {
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
  }
  return queryClient;
}

interface ProvidersStep1Props {
  children: ReactNode;
}

/**
 * STEP 1: QueryClient only
 * Minimal provider with just React Query for data fetching
 */
export function ProvidersStep1({ children }: ProvidersStep1Props) {
  // Log provider mount for observability (PII-safe, dev only)
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.info('[ProvidersStep1] mounted - QueryClient only');
  }

  return (
    <QueryClientProvider client={getQueryClient()}>
      {children}
    </QueryClientProvider>
  );
}
