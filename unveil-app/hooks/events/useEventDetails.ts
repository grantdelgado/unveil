import { useEffect, useState, useCallback } from 'react';

import type {
  EventWithHost,
  EventParticipantWithUser,
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
  const [participantInfo, setParticipantInfo] =
    useState<EventParticipantWithUser | null>(null);
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
          .from('public_user_profiles')
          .select('*')
          .eq('id', eventData.host_user_id)
          .single();

        if (!hostError) {
          hostData = hostInfo;
        }
      } catch {
        // Silently handle host fetch failures
      }

      // Check if user is a participant of this event (fetch without join first)
      const { data: participantDataSimple, error: participantSimpleError } =
        await supabase
          .from('event_participants')
          .select('*')
          .eq('event_id', eventId)
          .eq('user_id', userId)
          .single();

      if (participantSimpleError) {
        console.error(
          '🔍 Simple participant fetch error:',
          participantSimpleError,
        );
        console.error('🔍 Simple participant error details:', {
          code: participantSimpleError.code,
          message: participantSimpleError.message,
          details: participantSimpleError.details,
          hint: participantSimpleError.hint,
        });
        throw new Error('You are not invited to this event');
      }

      // Try to fetch the user profile for the participant separately
      let participantUserProfile = null;
      try {
        const { data: userProfile, error: userProfileError } = await supabase
          .from('public_user_profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (!userProfileError) {
          participantUserProfile = userProfile;
        }
      } catch {
        // Silently handle profile fetch failures
      }

      // Combine participant data with user profile
      const participantData = {
        ...participantDataSimple,
        user: participantUserProfile,
      };

      // Combine event data with host info
      const eventWithHost = {
        ...eventData,
        host: hostData,
      };

      setEvent(eventWithHost as EventWithHost);
      setParticipantInfo(participantData as EventParticipantWithUser);
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
      if (!participantInfo) {
        const validationError = createDatabaseError(
          'NOT_NULL_VIOLATION',
          'No participant info available',
          undefined,
          { operation: 'updateRSVP', status },
        );
        return { success: false, error: validationError };
      }

      const wrappedUpdate = withErrorHandling(async () => {
        const { error } = await supabase
          .from('event_participants')
          .update({ rsvp_status: status })
          .eq('id', participantInfo.id);

        if (error) {
          throw new Error('Failed to update RSVP');
        }

        // Update local state
        setParticipantInfo({ ...participantInfo, rsvp_status: status });
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
            participantId: participantInfo.id,
            status,
          },
        );
        logGenericError('useEventDetails.updateRSVP', result.error);
        return { success: false, error: dbError };
      }
      return { success: true, error: null };
    },
    [participantInfo],
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
    participantInfo,
    loading,
    error,
    updateRSVP,
    refetch,
    isHost: !!event && !!userId && event.host_user_id === userId,
    isParticipant: !!participantInfo,
    canEdit: !!event && !!userId && event.host_user_id === userId,
    data: { event, participantInfo },
  };
}
