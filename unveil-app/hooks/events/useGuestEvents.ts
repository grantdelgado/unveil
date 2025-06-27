import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import {
  type Event,
  type EventGuestWithEvent,
} from '@/lib/supabase/types';
// import { getGuestEvents } from '@/services/events'
import { logError, type AppError } from '@/lib/error-handling';
import { withErrorHandling } from '@/lib/error-handling';

interface UseGuestEventsReturn {
  guestEvents: Event[];
  loading: boolean;
  error: AppError | null;
  refetch: () => Promise<void>;
}

// Backward compatibility


export function useGuestEvents(
  userId: string | null,
): UseGuestEventsReturn {
  const [guestEvents, setGuestEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);

  const fetchGuestEvents = useCallback(async () => {
    const wrappedFetch = withErrorHandling(async () => {
      if (!userId) {
        setGuestEvents([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      // Fetch guest events
      const { data: guestData, error: guestError } = await supabase
        .from('event_guests')
        .select(
          `
          *,
          events:events(*)
        `,
        )
        .eq('user_id', userId);

      if (guestError) {
        throw guestError;
      }

      // Format guest events data
      const formattedGuestEvents = (
        (guestData as EventGuestWithEvent[]) || []
      )
        .map((g) => g.events)
        .filter((e): e is Event => e !== null)
        .sort(
          (a, b) =>
            new Date(a.event_date).getTime() - new Date(b.event_date).getTime(),
        );

      setGuestEvents(formattedGuestEvents);
      setLoading(false);
    }, 'useGuestEvents.fetchGuestEvents');

    const result = await wrappedFetch();
    if (result?.error) {
      setError(result.error);
      logError(result.error, 'useGuestEvents.fetchGuestEvents');
      setLoading(false);
    }
    return result;
  }, [userId]);

  const refetch = useCallback(async () => {
    await fetchGuestEvents();
  }, [fetchGuestEvents]);

  useEffect(() => {
    if (userId !== null) {
      fetchGuestEvents();
    } else {
      setLoading(false);
    }
  }, [fetchGuestEvents, userId]);

  return {
    guestEvents,

    loading,
    error,
    refetch,
  };
}

// Backward compatibility
// Guest events hook implementation above
