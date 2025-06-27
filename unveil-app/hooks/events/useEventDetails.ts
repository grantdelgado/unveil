import { useEffect, useState, useCallback } from 'react';

import type {
  EventWithHost,
  EventGuestWithUser,
  EventDetailsHookResult,
  DatabaseError,
} from '@/lib/types';
import { createDatabaseError } from '@/lib/types';
import { supabase } from '@/lib/supabase/client';
import { withErrorHandling } from '@/lib/error-handling';
import { logGenericError } from '@/lib/logger';

export function useEventDetails(
  eventId: string | null,
  userId: string | null,
): EventDetailsHookResult {
  const [event, setEvent] = useState<EventWithHost | null>(null);
  const [guestInfo, setGuestInfo] =
    useState<EventGuestWithUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<DatabaseError | null>(null);

  const fetchEventData = useCallback(async () => {
    const wrappedFetch = withErrorHandling(async () => {
      if (!eventId || !userId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      // Fetch event details first (without host join to avoid RLS issues)
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (eventError) {
        throw new Error('Failed to load event details');
      }

      // Try to fetch host information separately (may fail due to RLS)
      let hostData = null;
      try {
        const { data: hostInfo, error: hostError } = await supabase
          .from('users')
          .select('*')
          .eq('id', eventData.host_user_id)
          .single();

        if (!hostError) {
          hostData = hostInfo;
        }
      } catch {
        // Silently handle host fetch failures
      }

      // Check if user is a guest of this event (fetch without join first)
      const { data: guestDataSimple, error: guestSimpleError } =
        await supabase
          .from('event_guests')
          .select('*')
          .eq('event_id', eventId)
          .eq('user_id', userId)
          .single();

      if (guestSimpleError) {
        console.error(
          '🔍 Simple guest fetch error:',
          guestSimpleError,
        );
        console.error('🔍 Simple guest error details:', {
          code: guestSimpleError.code,
          message: guestSimpleError.message,
          details: guestSimpleError.details,
          hint: guestSimpleError.hint,
        });
        throw new Error('You are not invited to this event');
      }

      // Try to fetch the user profile for the guest separately
      let guestUserProfile = null;
      try {
        const { data: userProfile, error: userProfileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();

        if (!userProfileError) {
          guestUserProfile = userProfile;
        }
      } catch {
        // Silently handle profile fetch failures
      }

      // Combine guest data with user profile
      const guestData = {
        ...guestDataSimple,
        users: guestUserProfile,
      };

      // Combine event data with host info
      const eventWithHost = {
        ...eventData,
        host: hostData,
      };

      setEvent(eventWithHost as EventWithHost);
      setGuestInfo(guestData as EventGuestWithUser);
      setLoading(false);
    }, 'useEventDetails.fetchEventData');

    const result = await wrappedFetch();
    if (result?.error) {
      const dbError = createDatabaseError(
        'QUERY_FAILED',
        'Failed to fetch event details',
        result.error,
        { operation: 'fetchEventData', eventId, userId },
      );
      setError(dbError);
      logGenericError('useEventDetails.fetchEventData', result.error);
      setLoading(false);
    }
    return result;
  }, [eventId, userId]);

  const updateRSVP = useCallback(
    async (status: string) => {
      if (!guestInfo) {
        const validationError = createDatabaseError(
          'NOT_NULL_VIOLATION',
          'No guest info available',
          undefined,
          { operation: 'updateRSVP', status },
        );
        return { success: false, error: validationError };
      }

      const wrappedUpdate = withErrorHandling(async () => {
        const { error } = await supabase
          .from('event_guests')
          .update({ rsvp_status: status })
          .eq('id', guestInfo.id);

        if (error) {
          throw new Error('Failed to update RSVP');
        }

        // Update local state
        setGuestInfo({ ...guestInfo, rsvp_status: status });
        return { success: true, error: null };
      }, 'useEventDetails.updateRSVP');

      const result = await wrappedUpdate();
      if (result?.error) {
        const dbError = createDatabaseError(
          'QUERY_FAILED',
          'Failed to update RSVP status',
          result.error,
          {
            operation: 'updateRSVP',
            guestId: guestInfo.id,
            status,
          },
        );
        logGenericError('useEventDetails.updateRSVP', result.error);
        return { success: false, error: dbError };
      }
      return { success: true, error: null };
    },
    [guestInfo],
  );

  const refetch = useCallback(async () => {
    if (eventId && userId) {
      await fetchEventData();
    }
  }, [fetchEventData, eventId, userId]);

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
    isHost: !!event && !!userId && event.host_user_id === userId,
    isGuest: !!guestInfo,
    canEdit: !!event && !!userId && event.host_user_id === userId,
    data: { event, guestInfo },
  };
}
