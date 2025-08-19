import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

interface UseGuestRejoinOptions {
  eventId: string;
  onRejoinSuccess?: () => void;
}

interface UseGuestRejoinReturn {
  rejoinEvent: () => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook for handling guest event rejoin functionality (RSVP-Lite)
 * Uses the atomic guest_rejoin_event RPC that clears declined_at and sets sms_opt_out = FALSE
 */
export function useGuestRejoin({
  eventId,
  onRejoinSuccess
}: UseGuestRejoinOptions): UseGuestRejoinReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rejoinEvent = useCallback(async () => {
    if (!eventId) {
      const errorMsg = 'Event ID is required';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }

    setIsLoading(true);
    setError(null);

    try {
      logger.api('Rejoining event', { eventId });

      const { data, error: rpcError } = await supabase.rpc('guest_rejoin_event', {
        p_event_id: eventId
      });

      if (rpcError) {
        logger.databaseError('Error rejoining event', rpcError);
        throw new Error(rpcError.message);
      }

      const success = data as boolean;
      
      if (!success) {
        logger.error('RPC returned failure', { data });
        throw new Error('Failed to rejoin event');
      }

      logger.api('Successfully rejoined event', { 
        eventId
      });

      onRejoinSuccess?.();

      return { success: true };

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to rejoin event';
      setError(errorMsg);
      logger.error('Guest rejoin error', err);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, [eventId, onRejoinSuccess]);

  return {
    rejoinEvent,
    isLoading,
    error
  };
}
