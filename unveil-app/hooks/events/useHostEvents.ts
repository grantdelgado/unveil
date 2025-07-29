import { useEffect, useState, useCallback } from 'react';
import { type Event } from '@/lib/supabase/types';
import { useEvents } from '@/hooks/useEvents';
import { logError, type AppError } from '@/lib/error-handling';
import { withErrorHandling } from '@/lib/error-handling';
import { getHostEvents } from '@/lib/services/events';

interface UseHostEventsReturn {
  hostedEvents: Event[];
  loading: boolean;
  error: AppError | null;
  refetch: () => Promise<void>;
}

export function useHostEvents(userId: string | null): UseHostEventsReturn {
  const [hostedEvents, setHostedEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);

  const fetchHostedEvents = useCallback(async () => {
    const wrappedFetch = withErrorHandling(async () => {
      if (!userId) {
        setHostedEvents([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      // Fetch hosted events
      const hostResult = await getHostEvents(userId);

      if (!hostResult.success && hostResult.error) {
        throw new Error(hostResult.error instanceof Error ? hostResult.error.message : 'Failed to fetch hosted events');
      }

      setHostedEvents(hostResult.success ? hostResult.data || [] : []);
      setLoading(false);
    }, 'useHostEvents.fetchHostedEvents');

    const result = await wrappedFetch();
    if (result?.error) {
      setError(result.error);
      logError(result.error, 'useHostEvents.fetchHostedEvents');
      setLoading(false);
    }
    return result;
  }, [userId]);

  const refetch = useCallback(async () => {
    await fetchHostedEvents();
  }, [fetchHostedEvents]);

  useEffect(() => {
    if (userId !== null) {
      fetchHostedEvents();
    } else {
      setLoading(false);
    }
  }, [fetchHostedEvents, userId]);

  return {
    hostedEvents,
    loading,
    error,
    refetch,
  };
}
