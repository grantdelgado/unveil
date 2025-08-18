'use client';

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

interface UseHostGuestDeclineOptions {
  eventId: string;
  onDeclineClearSuccess?: (guestUserId: string) => void;
}

interface UseHostGuestDeclineReturn {
  clearGuestDecline: (guestUserId: string) => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook for host to clear guest event declines (RSVP-Lite)
 */
export function useHostGuestDecline({
  eventId,
  onDeclineClearSuccess
}: UseHostGuestDeclineOptions): UseHostGuestDeclineReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearGuestDecline = useCallback(async (guestUserId: string) => {
    if (!eventId || !guestUserId) {
      const errorMsg = 'Event ID and guest user ID are required';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }

    setIsLoading(true);
    setError(null);

    try {
      logger.api('Clearing guest decline', { eventId, guestUserId });

      const { data, error: rpcError } = await supabase.rpc('host_clear_guest_decline', {
        p_event_id: eventId,
        p_guest_user_id: guestUserId
      });

      if (rpcError) {
        logger.databaseError('Error clearing guest decline', rpcError);
        throw new Error(rpcError.message);
      }

      const result = data as { success?: boolean; error?: string; message?: string };
      
      if (!result?.success) {
        const errorMsg = result?.error || 'Failed to clear guest decline';
        logger.error('RPC returned failure', { data });
        throw new Error(errorMsg);
      }

      logger.api('Successfully cleared guest decline', { 
        eventId, 
        guestUserId,
        message: result.message 
      });

      onDeclineClearSuccess?.(guestUserId);

      return { success: true };

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to clear guest decline';
      setError(errorMsg);
      logger.error('Host clear decline error', err);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, [eventId, onDeclineClearSuccess]);

  return {
    clearGuestDecline,
    isLoading,
    error
  };
}
