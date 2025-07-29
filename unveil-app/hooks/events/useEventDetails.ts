import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { EventWithHost, EventGuestWithUser } from '@/lib/supabase/types';
import { DatabaseErrorHandler } from '@/lib/error-handling/database';
import { logGenericError } from '@/lib/logger';
// Note: getUserById functionality moved to useAuth hook
import { useEvents } from '@/hooks/useEvents';
import { getEventById } from '@/lib/services/events';

interface EventDetailsHookResult {
  event: EventWithHost | null;
  guestInfo: EventGuestWithUser | null;
  loading: boolean;
  error: Error | null;
  updateRSVP: (status: string) => Promise<{ success: boolean; error?: string }>;
}

export function useEventDetails(
  eventId: string | null,
  userId: string | null,
): EventDetailsHookResult {
  const [event, setEvent] = useState<EventWithHost | null>(null);
  const [guestInfo, setGuestInfo] = useState<EventGuestWithUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchEventData = useCallback(async () => {
    if (!eventId || !userId) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch event data using service function that handles RLS gracefully
      const eventResult = await getEventById(eventId);
      
      if (!eventResult) {
        throw new Error('Failed to fetch event');
      }

      // Handle service return format
      if (!eventResult.success && eventResult.error) {
        throw new Error(eventResult.error instanceof Error ? eventResult.error.message : 'Failed to fetch event');
      }

      if (eventResult.success && eventResult.data) {
        setEvent(eventResult.data);
      }

      // Fetch guest information
      const { data: guestData, error: guestError } = await supabase
        .from('event_guests')
        .select(`
          *,
          users:user_id(*)
        `)
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .single();

      if (guestError && guestError.code !== 'PGRST116') {
        logGenericError('Failed to fetch guest info', guestError);
      } else if (guestData) {
        setGuestInfo(guestData);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch event details';
      setError(new Error(errorMessage));
      logGenericError('Error fetching event details', err);
    } finally {
      setLoading(false);
    }
  }, [eventId, userId]);

  const updateRSVP = useCallback(async (status: string) => {
    if (!eventId || !userId) {
      return { success: false, error: 'Missing event or user ID' };
    }

    try {
      const { error: updateError } = await supabase
        .from('event_guests')
        .update({ rsvp_status: status })
        .eq('event_id', eventId)
        .eq('user_id', userId);

      if (updateError) {
        DatabaseErrorHandler.handle(updateError, 'guests', {
          table: 'event_guests',
          operation: 'UPDATE',
        });
      }

      // Refresh guest info
      await fetchEventData();
      
      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update RSVP';
      return { success: false, error: errorMessage };
    }
  }, [eventId, userId, fetchEventData]);

  // Trigger fetch when dependencies change
  useEffect(() => {
    if (eventId && userId) {
      fetchEventData();
    }
  }, [eventId, userId, fetchEventData]);

  return {
    event,
    guestInfo,
    loading,
    error,
    updateRSVP,
  };
}
