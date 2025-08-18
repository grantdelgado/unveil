'use client';

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

interface UseGuestDeclineOptions {
  eventId: string;
  onDeclineSuccess?: () => void;
}

interface UseGuestDeclineReturn {
  declineEvent: (reason?: string) => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook for handling guest event decline functionality (RSVP-Lite)
 */
export function useGuestDecline({
  eventId,
  onDeclineSuccess
}: UseGuestDeclineOptions): UseGuestDeclineReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const declineEvent = useCallback(async (reason?: string) => {
    if (!eventId) {
      const errorMsg = 'Event ID is required';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }

    setIsLoading(true);
    setError(null);

    try {
      logger.api('Declining event', { eventId, hasReason: !!reason });

      const { data, error: rpcError } = await supabase.rpc('guest_decline_event', {
        p_event_id: eventId,
        p_decline_reason: reason || undefined
      });

      if (rpcError) {
        logger.databaseError('Error declining event', rpcError);
        throw new Error(rpcError.message);
      }

      const result = data as { success?: boolean; error?: string; declined_at?: string; decline_reason?: string };
      
      if (!result?.success) {
        const errorMsg = result?.error || 'Failed to decline event';
        logger.error('RPC returned failure', { data });
        throw new Error(errorMsg);
      }

      logger.api('Successfully declined event', { 
        eventId, 
        declined_at: result.declined_at,
        hasReason: !!result.decline_reason 
      });

      onDeclineSuccess?.();

      return { success: true };

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to decline event';
      setError(errorMsg);
      logger.error('Guest decline error', err);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, [eventId, onDeclineSuccess]);

  return {
    declineEvent,
    isLoading,
    error
  };
}
