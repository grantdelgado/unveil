/**
 * Unified Guest Counts Hook
 * 
 * Single source of truth for guest counts used by both Host Dashboard 
 * and Guest Management to ensure consistency.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

export interface UnifiedGuestCounts {
  total_guests: number;
  total_invited: number;
  attending: number;
  declined: number;
  not_invited: number;
}

interface UseUnifiedGuestCountsReturn {
  counts: UnifiedGuestCounts;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook that provides unified guest counts for an event
 * Uses React Query with the get_event_guest_counts RPC to ensure consistency
 * and automatic invalidation when guests are added/removed
 */
export function useUnifiedGuestCounts(eventId: string): UseUnifiedGuestCountsReturn {
  const queryClient = useQueryClient();

  const { data: counts, isLoading: loading, error, refetch } = useQuery({
    queryKey: ['unified-guest-counts', eventId],
    queryFn: async (): Promise<UnifiedGuestCounts> => {
      if (!eventId) {
        logger.warn('useUnifiedGuestCounts: No eventId provided');
        return {
          total_guests: 0,
          total_invited: 0,
          attending: 0,
          declined: 0,
          not_invited: 0,
        };
      }

      logger.info('Fetching unified guest counts', { eventId });

      const { data, error: rpcError } = await supabase
        .rpc('get_event_guest_counts', { p_event_id: eventId });

      if (rpcError) {
        throw new Error(`Failed to fetch guest counts: ${rpcError.message}`);
      }

      if (data && Array.isArray(data) && data.length > 0) {
        const result = data[0];
        const counts = {
          total_guests: result.total_guests || 0,
          total_invited: result.total_invited || 0,
          attending: result.attending || 0,
          declined: result.declined || 0,
          not_invited: result.not_invited || 0,
        };

        logger.info('Successfully fetched unified guest counts', { 
          eventId, 
          counts
        });

        return counts;
      } else {
        // No data returned, set all to 0
        logger.info('No guest count data returned, defaulting to zeros', { eventId });
        return {
          total_guests: 0,
          total_invited: 0,
          attending: 0,
          declined: 0,
          not_invited: 0,
        };
      }
    },
    enabled: !!eventId,
    staleTime: 30000, // 30 seconds stale time
    gcTime: 5 * 60 * 1000, // 5 minutes garbage collection time
  });

  const refresh = async () => {
    await refetch();
  };

  return {
    counts: counts || {
      total_guests: 0,
      total_invited: 0,
      attending: 0,
      declined: 0,
      not_invited: 0,
    },
    loading,
    error: error ? (error as Error).message : null,
    refresh,
  };
}