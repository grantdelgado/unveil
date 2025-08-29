/**
 * Hook for fetching current audience count for scheduled messages
 * 
 * Provides live audience counts for Upcoming Announcement cards,
 * replacing historical snapshots with current eligible recipients.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

export interface UseCurrentAudienceCountReturn {
  count: number | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook that provides current eligible audience count for a scheduled message
 * 
 * @param scheduledMessageId - ID of the scheduled message
 * @param options - Configuration options
 * @returns Current audience count with loading states
 */
export function useCurrentAudienceCount(
  scheduledMessageId: string | null,
  options: {
    enabled?: boolean;
    staleTime?: number;
    gcTime?: number;
  } = {}
): UseCurrentAudienceCountReturn {
  const {
    enabled = true,
    staleTime = 30_000, // 30 seconds
    gcTime = 5 * 60_000, // 5 minutes
  } = options;

  const {
    data: count,
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['current-audience', scheduledMessageId],
    queryFn: async (): Promise<number> => {
      if (!scheduledMessageId) {
        return 0;
      }

      const startTime = performance.now();
      
      try {
        const { data, error: rpcError } = await supabase.rpc(
          'current_announcement_audience_count' as any,
          { p_scheduled_message_id: scheduledMessageId }
        );

        if (rpcError) {
          throw new Error(`Failed to fetch current audience count: ${rpcError.message}`);
        }

        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);

        const count = typeof data === 'number' ? data : 0;

        // Log successful fetch (PII-safe)
        if (process.env.NODE_ENV === 'development') {
          logger.info('Current audience count fetched', {
            scheduledMessageId,
            count,
            durationMs: duration,
          });
        }

        return count;
      } catch (err) {
        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);

        logger.error('Failed to fetch current audience count', {
          scheduledMessageId,
          error: err instanceof Error ? err.message : 'Unknown error',
          durationMs: duration,
        });

        throw err;
      }
    },
    enabled: !!scheduledMessageId && enabled,
    staleTime,
    gcTime,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

  const handleRefetch = async () => {
    await refetch();
  };

  return {
    count: count ?? null,
    loading,
    error: error ? (error as Error).message : null,
    refetch: handleRefetch,
  };
}
