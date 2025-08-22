import { useState, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import type { EventWithHost, EventGuestWithUser } from '@/lib/supabase/types';
import { logError, type AppError } from '@/lib/error-handling';
import { withErrorHandling } from '@/lib/error-handling';
import { getEventById } from '@/lib/services/events';
import { smartInvalidation } from '@/lib/queryUtils';
import { logger } from '@/lib/logger';

import { isValidUUID } from '@/lib/utils/validation';
import { useEventSubscription } from '@/hooks/realtime';

interface UseEventWithGuestReturn {
  event: EventWithHost | null;
  guestInfo: EventGuestWithUser | null;
  loading: boolean;
  error: AppError | null;
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
        throw new Error(
          eventResult.error instanceof Error
            ? eventResult.error.message
            : 'Failed to fetch event',
        );
      }

      if (eventResult.data) {
        setEvent(eventResult.data);
      }

      // Fetch guest information with proper RLS handling
      // Only include guests who haven't been removed from the event
      const { data: guestData, error: guestError } = await supabase
        .from('event_guests')
        .select(
          `
          *,
          users:user_id(*)
        `,
        )
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .is('removed_at', null) // Only include guests who haven't been removed
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

  const refetch = useCallback(async () => {
    await fetchEventData();
  }, [fetchEventData]);

  // Trigger fetch when dependencies change
  useEffect(() => {
    fetchEventData();
  }, [fetchEventData]);

  // Realtime: keep guestInfo in sync for this specific user's guest record
  // Only subscribe if we have both eventId and userId to minimize unnecessary subscriptions
  useEventSubscription({
    eventId: eventId,
    table: 'event_guests',
    event: '*',
    // Filter to only this user's guest record to reduce noise
    filter:
      eventId && userId
        ? `event_id=eq.${eventId}.and.user_id=eq.${userId}`
        : undefined,
    onDataChange: useCallback(
      (payload) => {
        try {
          // This subscription is already filtered to the current user's row
          const updated = payload.new as unknown as {
            id?: string;
            event_id?: string;
            user_id?: string;
            declined_at?: string;
            decline_reason?: string;
          };
          if (
            !updated ||
            updated.event_id !== eventId ||
            updated.user_id !== userId
          )
            return;

          logger.realtime('Guest info updated via realtime', {
            eventId,
            userId,
            declined: !!updated.declined_at,
          });

          // Merge minimal fields into guestInfo; realtime payload has flat record
          setGuestInfo((prev) => ({
            ...(prev || ({} as EventGuestWithUser)),
            ...(updated as Partial<EventGuestWithUser>),
          }));
        } catch (err) {
          logger.realtimeError('Failed to apply realtime guest update', err);
        }
      },
      [eventId, userId],
    ),
    onError: useCallback((err: Error) => {
      logger.realtimeError('Guest realtime subscription error', err);
    }, []),
    enabled: Boolean(eventId && userId),
    performanceOptions: { enablePooling: true, eventId: eventId || undefined },
  });

  return {
    event,
    guestInfo,
    loading,
    error,
    refetch,
  };
}
