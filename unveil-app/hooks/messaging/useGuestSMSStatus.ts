import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

interface UseGuestSMSStatusProps {
  eventId: string;
  userId: string | null;
}

interface UseGuestSMSStatusReturn {
  smsOptOut: boolean;
  loading: boolean;
  error: string | null;
  refreshStatus: () => Promise<void>;
}

/**
 * Hook to fetch and track the current guest's SMS opt-out status
 */
export function useGuestSMSStatus({
  eventId,
  userId,
}: UseGuestSMSStatusProps): UseGuestSMSStatusReturn {
  const [smsOptOut, setSmsOptOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSMSStatus = useCallback(async () => {
    if (!userId || !eventId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: guest, error: fetchError } = await supabase
        .from('event_guests')
        .select('sms_opt_out')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          // No guest record found - default to opted in (false)
          setSmsOptOut(false);
        } else {
          throw fetchError;
        }
      } else {
        setSmsOptOut(Boolean(guest?.sms_opt_out));
      }

      logger.info('Fetched guest SMS status', {
        eventId,
        userId,
        smsOptOut: guest?.sms_opt_out,
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Failed to fetch SMS notification status';
      setError(errorMessage);

      logger.error('Failed to fetch guest SMS status', {
        error: err,
        eventId,
        userId,
      });
    } finally {
      setLoading(false);
    }
  }, [eventId, userId]);

  // Initial fetch
  useEffect(() => {
    fetchSMSStatus();
  }, [fetchSMSStatus]);

  return {
    smsOptOut,
    loading,
    error,
    refreshStatus: fetchSMSStatus,
  };
}
