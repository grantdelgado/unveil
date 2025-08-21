/**
 * Unified Guest Counts Hook
 * 
 * Single source of truth for guest counts used by both Host Dashboard 
 * and Guest Management to ensure consistency.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
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
 * Uses the get_event_guest_counts RPC to ensure consistency
 */
export function useUnifiedGuestCounts(eventId: string): UseUnifiedGuestCountsReturn {
  const [counts, setCounts] = useState<UnifiedGuestCounts>({
    total_guests: 0,
    total_invited: 0,
    attending: 0,
    declined: 0,
    not_invited: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // TODO(grant): Add memoization to prevent recursive guest count fetches
  const fetchInFlightRef = useRef(false);
  const lastFetchTimeRef = useRef(0);
  const STALE_TIME = 30000; // 30 seconds stale time

  const fetchCounts = useCallback(async () => {
    if (!eventId) {
      logger.warn('useUnifiedGuestCounts: No eventId provided');
      return;
    }

    // TODO(grant): Prevent duplicate fetches and implement stale-while-revalidate pattern
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTimeRef.current;
    
    if (fetchInFlightRef.current) {
      return; // Fetch already in progress
    }
    
    if (timeSinceLastFetch < STALE_TIME && counts.total_guests > 0) {
      return; // Data is still fresh
    }

    try {
      fetchInFlightRef.current = true;
      setLoading(true);
      setError(null);
      lastFetchTimeRef.current = now;

      const { data, error: rpcError } = await supabase
        .rpc('get_event_guest_counts', { p_event_id: eventId });

      if (rpcError) {
        throw new Error(`Failed to fetch guest counts: ${rpcError.message}`);
      }

      if (data && Array.isArray(data) && data.length > 0) {
        const result = data[0];
        setCounts({
          total_guests: result.total_guests || 0,
          total_invited: result.total_invited || 0,
          attending: result.attending || 0,
          declined: result.declined || 0,
          not_invited: result.not_invited || 0,
        });
      } else {
        // No data returned, set all to 0
        setCounts({
          total_guests: 0,
          total_invited: 0,
          attending: 0,
          declined: 0,
          not_invited: 0,
        });
      }

      logger.info('Successfully fetched unified guest counts', { 
        eventId, 
        counts: Array.isArray(data) ? data[0] : null
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      logger.error('Error fetching unified guest counts', { eventId, error: errorMessage });
      
      setError(errorMessage);
      // Keep previous counts on error rather than resetting to 0
    } finally {
      fetchInFlightRef.current = false;
      setLoading(false);
    }
  }, [eventId, counts.total_guests]); // TODO(grant): Added counts.total_guests to dependency for stale-time check

  // Initial fetch on mount and when eventId changes
  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  return {
    counts,
    loading,
    error,
    refresh: fetchCounts,
  };
}
