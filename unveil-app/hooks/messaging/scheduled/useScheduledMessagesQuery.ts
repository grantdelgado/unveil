/**
 * useScheduledMessagesQuery Hook
 *
 * Handles React Query logic for scheduled messages.
 * Extracted from the original useScheduledMessages hook for better separation of concerns.
 */

import { useQuery } from '@tanstack/react-query';
import { useMessages } from '@/hooks/useMessages';
import type { Tables } from '@/app/reference/supabase.types';
import type { ScheduledMessageFilters } from '@/lib/types/messaging';
import { getScheduledMessages } from '@/lib/services/messaging';

type ScheduledMessage = Tables<'scheduled_messages'>;

export interface UseScheduledMessagesQueryOptions {
  eventId: string;
  filters?: ScheduledMessageFilters;
  autoRefresh?: boolean;
  enabled?: boolean;
}

export interface UseScheduledMessagesQueryReturn {
  messages: ScheduledMessage[];
  loading: boolean;
  error: Error | null;
  queryKey: (string | ScheduledMessageFilters | undefined)[];
  refetch: () => Promise<any>;
}

/**
 * Hook for React Query logic of scheduled messages
 *
 * Responsibilities:
 * - Data fetching via React Query
 * - Cache management and invalidation
 * - Background refresh configuration
 * - Query error handling and retries
 */
export function useScheduledMessagesQuery({
  eventId,
  filters,
  autoRefresh = true,
  enabled = true,
}: UseScheduledMessagesQueryOptions): UseScheduledMessagesQueryReturn {
  // Enhanced query key including filters for better caching
  const queryKey = ['scheduled-messages', eventId, filters];

  // React Query for scheduled messages with optimized settings
  const {
    data: messages = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      const messageFilters: ScheduledMessageFilters = {
        eventId,
        ...filters,
      };

      const result = await getScheduledMessages(messageFilters);
      if (!result.success) {
        throw new Error(
          result.error instanceof Error
            ? result.error.message
            : 'Failed to fetch scheduled messages',
        );
      }

      return result.data || [];
    },
    enabled: !!eventId && enabled,
    // Hotfix: Align React Query settings to prevent refetch loops
    staleTime: 60000, // 1 minute - aligned with useMessages
    gcTime: 1000 * 60 * 10, // 10 minutes
    refetchOnWindowFocus: false, // Disabled to prevent refetch loops
    refetchInterval: false, // Disabled - let realtime handle freshness
    refetchIntervalInBackground: false, // Only when tab is active
    retry: (failureCount, error) => {
      // Only retry on network errors
      if (error instanceof Error && error.message.includes('permission')) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  return {
    messages,
    loading,
    error: queryError,
    queryKey,
    refetch,
  };
}
