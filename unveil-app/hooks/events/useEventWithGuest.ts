import { useState, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import type { EventWithHost, EventGuestWithUser } from '@/lib/supabase/types';
import { logError, type AppError } from '@/lib/error-handling';
import { withErrorHandling } from '@/lib/error-handling';
import { getEventById } from '@/lib/services/events';
import { smartInvalidation } from '@/lib/queryUtils';
import { logger } from '@/lib/logger';
import { RSVP_STATUS, type RSVPStatus } from '@/lib/types/rsvp';
import { isValidUUID } from '@/lib/utils/validation';
import { useEventSubscription } from '@/hooks/realtime';

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

    // Validate identifiers before making request
    if (!isValidUUID(eventId) || !isValidUUID(userId)) {
      logger.apiError('Invalid UUIDs provided for RSVP update', undefined, 'useEventWithGuest.updateRSVP');
      return { success: false, error: 'Invalid event or user identifier' };
    }

    // Normalize and validate status against allowed set
    const normalizedStatus = (status || '').toLowerCase() as RSVPStatus;
    const allowedStatuses = new Set<RSVPStatus>([
      RSVP_STATUS.ATTENDING,
      RSVP_STATUS.MAYBE,
      RSVP_STATUS.DECLINED,
      RSVP_STATUS.PENDING,
    ]);
    if (!allowedStatuses.has(normalizedStatus)) {
      logger.validation?.('Invalid RSVP status provided', { status }, 'useEventWithGuest.updateRSVP');
      return { success: false, error: 'Invalid RSVP status' };
    }

    const wrappedUpdate = withErrorHandling(async () => {
      // Debug visibility: log request details
      logger.api(
        'Submitting RSVP update',
        {
          query: `event_id=eq.${eventId}&user_id=eq.${userId}`,
          payload: { rsvp_status: normalizedStatus },
        },
        'useEventWithGuest.updateRSVP',
      );

      const { error: updateError } = await supabase
        .from('event_guests')
        .update({ rsvp_status: normalizedStatus })
        .eq('event_id', eventId)
        .eq('user_id', userId);

      if (updateError) {
        // Include more context in error logs
        logger.databaseError('RSVP update failed', updateError, 'useEventWithGuest.updateRSVP');
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
      
      logger.api('RSVP updated successfully', { eventId, userId, rsvp_status: normalizedStatus }, 'useEventWithGuest.updateRSVP');
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

  // Realtime: keep guestInfo in sync for this event (and user)
  useEventSubscription({
    eventId: eventId,
    table: 'event_guests',
    event: '*',
    // Scope realtime at the channel level for efficiency
    // Note: We still guard in the handler as a safety net
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    filter: eventId ? `event_id=eq.${eventId}` : undefined,
    onDataChange: useCallback((payload) => {
      try {
        // Narrow to the current user's row
        const updated = payload.new as unknown as { id?: string; event_id?: string; user_id?: string; rsvp_status?: string };
        if (!updated || updated.event_id !== eventId) return;
        if (userId && updated.user_id !== userId) return;

        // Merge minimal fields into guestInfo; realtime payload has flat record
        setGuestInfo((prev) => ({
          ...(prev || ({} as EventGuestWithUser)),
          ...(updated as Partial<EventGuestWithUser>),
        }));
      } catch (err) {
        logger.realtimeError('Failed to apply realtime RSVP update', err);
      }
    }, [eventId, userId]),
    onError: useCallback((err: Error) => {
      logger.realtimeError('RSVP realtime subscription error', err);
    }, []),
    enabled: Boolean(eventId),
    performanceOptions: { enablePooling: true, eventId: eventId || undefined },
  });

  return {
    event,
    guestInfo,
    loading,
    error,
    updateRSVP,
    refetch,
  };
} 