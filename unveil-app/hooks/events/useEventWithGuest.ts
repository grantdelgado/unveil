import { useState, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import type { EventWithHost, EventGuestWithUser } from '@/lib/supabase/types';
import { logError, type AppError } from '@/lib/error-handling';
import { withErrorHandling } from '@/lib/error-handling';
import { getEventById } from '@/lib/services/events';
import { smartInvalidation } from '@/lib/queryUtils';

interface UseEventWithGuestReturn {
  event: EventWithHost | null;
  guestInfo: EventGuestWithUser | null;
  loading: boolean;
  error: AppError | null;
  updateRSVP: (status: string) => Promise<{ success: boolean; error?: string }>;
  refetch: () => Promise<void>;
}

/**
 * Modern replacement for useEventDetails
 * Follows current architecture patterns with proper error handling and React Query integration
 */
export function useEventWithGuest(
  eventId: string | null,
  userId: string | null,
): UseEventWithGuestReturn {
  const [event, setEvent] = useState<EventWithHost | null>(null);
  const [guestInfo, setGuestInfo] = useState<EventGuestWithUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const queryClient = useQueryClient();

  const fetchEventData = useCallback(async () => {
    if (!eventId || !userId) {
      setEvent(null);
      setGuestInfo(null);
      setLoading(false);
      return;
    }

    const wrappedFetch = withErrorHandling(async () => {
      setLoading(true);
      setError(null);

      // Fetch event data using the service function
      const eventResult = await getEventById(eventId);
      
      if (!eventResult.success) {
        throw new Error(eventResult.error instanceof Error ? eventResult.error.message : 'Failed to fetch event');
      }

      if (eventResult.data) {
        setEvent(eventResult.data);
      }

      // Fetch guest information with proper RLS handling
      const { data: guestData, error: guestError } = await supabase
        .from('event_guests')
        .select(`
          *,
          users:user_id(*)
        `)
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .maybeSingle(); // Use maybeSingle to handle case where guest doesn't exist

      if (guestError) {
        logError(guestError, 'useEventWithGuest.fetchGuestInfo');
        // Don't throw for guest errors - user might not be in guest list
      } else if (guestData) {
        setGuestInfo(guestData);
      }

      setLoading(false);
    }, 'useEventWithGuest.fetchEventData');

    const result = await wrappedFetch();
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }, [eventId, userId]);

  const updateRSVP = useCallback(async (status: string) => {
    if (!eventId || !userId) {
      return { success: false, error: 'Missing event or user ID' };
    }

    const wrappedUpdate = withErrorHandling(async () => {
      const { error: updateError } = await supabase
        .from('event_guests')
        .update({ rsvp_status: status })
        .eq('event_id', eventId)
        .eq('user_id', userId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      // Refresh guest info
      await fetchEventData();
      
      // Use centralized smart invalidation for RSVP updates
      await smartInvalidation({
        queryClient,
        mutationType: 'rsvp',
        eventId,
        userId
      });
      
      return { success: true };
    }, 'useEventWithGuest.updateRSVP');

    const result = await wrappedUpdate();
    
    if (result?.error) {
      return { success: false, error: result.error.message };
    }
    
    return { success: true };
  }, [eventId, userId, fetchEventData]);

  const refetch = useCallback(async () => {
    await fetchEventData();
  }, [fetchEventData]);

  // Trigger fetch when dependencies change
  useEffect(() => {
    fetchEventData();
  }, [fetchEventData]);

  return {
    event,
    guestInfo,
    loading,
    error,
    updateRSVP,
    refetch,
  };
} 