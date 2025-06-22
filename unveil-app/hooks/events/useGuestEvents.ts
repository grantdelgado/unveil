import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import {
  type Event,
  type EventParticipantWithEvent,
} from '@/lib/supabase/types';
// import { getParticipantEvents } from '@/services/events'
import { logError, type AppError } from '@/lib/error-handling';
import { withErrorHandling } from '@/lib/error-handling';

interface UseParticipantEventsReturn {
  participantEvents: Event[];
  loading: boolean;
  error: AppError | null;
  refetch: () => Promise<void>;
}

export function useParticipantEvents(
  userId: string | null,
): UseParticipantEventsReturn {
  const [participantEvents, setParticipantEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);

  const fetchParticipantEvents = useCallback(async () => {
    const wrappedFetch = withErrorHandling(async () => {
      if (!userId) {
        setParticipantEvents([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      // Fetch participant events
      const { data: participantData, error: participantError } = await supabase
        .from('event_participants')
        .select(
          `
          *,
          events:events(*)
        `,
        )
        .eq('user_id', userId);

      if (participantError) {
        throw participantError;
      }

      // Format participant events data
      const formattedParticipantEvents = (
        (participantData as EventParticipantWithEvent[]) || []
      )
        .map((p) => p.events)
        .filter((e): e is Event => e !== null)
        .sort(
          (a, b) =>
            new Date(a.event_date).getTime() - new Date(b.event_date).getTime(),
        );

      setParticipantEvents(formattedParticipantEvents);
      setLoading(false);
    }, 'useParticipantEvents.fetchParticipantEvents');

    const result = await wrappedFetch();
    if (result?.error) {
      setError(result.error);
      logError(result.error, 'useParticipantEvents.fetchParticipantEvents');
      setLoading(false);
    }
    return result;
  }, [userId]);

  const refetch = useCallback(async () => {
    await fetchParticipantEvents();
  }, [fetchParticipantEvents]);

  useEffect(() => {
    if (userId !== null) {
      fetchParticipantEvents();
    } else {
      setLoading(false);
    }
  }, [fetchParticipantEvents, userId]);

  return {
    participantEvents,
    loading,
    error,
    refetch,
  };
}

// Legacy alias removed - use useParticipantEvents instead
