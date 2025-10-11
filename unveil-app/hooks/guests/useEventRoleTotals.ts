/**
 * Hook for fetching accurate total counts of hosts and guests for an event
 * Returns true totals regardless of pagination or filtering
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

interface UseEventRoleTotalsReturn {
  hostsTotal: number;
  guestsTotal: number;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to get accurate total counts for hosts and guests in an event
 * These counts are independent of pagination and represent the true totals
 */
export function useEventRoleTotals(eventId: string): UseEventRoleTotalsReturn {
  const [hostsTotal, setHostsTotal] = useState(0);
  const [guestsTotal, setGuestsTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTotals = useCallback(async () => {
    if (!eventId) {
      setHostsTotal(0);
      setGuestsTotal(0);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Fetch hosts count
      const { count: hostsCount, error: hostsError } = await supabase
        .from('event_guests')
        .select('user_id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('role', 'host')
        .is('removed_at', null); // Only count active hosts

      if (hostsError) {
        throw new Error(`Failed to fetch hosts count: ${hostsError.message}`);
      }

      // Fetch guests count
      const { count: guestsCount, error: guestsError } = await supabase
        .from('event_guests')
        .select('user_id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('role', 'guest')
        .is('removed_at', null); // Only count active guests

      if (guestsError) {
        throw new Error(`Failed to fetch guests count: ${guestsError.message}`);
      }

      const finalHostsTotal = hostsCount || 0;
      const finalGuestsTotal = guestsCount || 0;

      setHostsTotal(finalHostsTotal);
      setGuestsTotal(finalGuestsTotal);

      // PII-safe logging
      console.info('ui.guests.role_totals', {
        hosts: finalHostsTotal,
        guests: finalGuestsTotal,
        event_id: eventId,
      });

    } catch (fetchError) {
      const errorMessage = fetchError instanceof Error 
        ? fetchError 
        : new Error('Failed to fetch role totals');
      
      setError(errorMessage);
      logger.error('Failed to fetch event role totals', {
        eventId,
        error: errorMessage.message,
      });
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  // Refetch function for external use
  const refetch = useCallback(async () => {
    await fetchTotals();
  }, [fetchTotals]);

  // Initial fetch and when eventId changes
  useEffect(() => {
    fetchTotals();
  }, [fetchTotals]);

  return {
    hostsTotal,
    guestsTotal,
    isLoading,
    error,
    refetch,
  };
}
