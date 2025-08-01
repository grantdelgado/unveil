import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { logError, type AppError } from '@/lib/error-handling';
import { withErrorHandling } from '@/lib/error-handling';
import type { Database } from '@/app/reference/supabase.types';

// Type definitions based on MCP schema
type GetUserEventsReturn =
  Database['public']['Functions']['get_user_events']['Returns'][0];

interface UserEvent {
  event_id: string;
  title: string;
  event_date: string;
  location: string | null;
  user_role: string;
  rsvp_status: string | null;
  is_primary_host: boolean;
}

interface UseUserEventsReturn {
  events: UserEvent[];
  loading: boolean;
  error: AppError | null;
  refetch: () => Promise<void>;
}

/**
 * Modern replacement for useUserEventsSorted
 * Follows current architecture patterns with proper error handling
 */
export function useUserEvents(): UseUserEventsReturn {
  const [rawEvents, setRawEvents] = useState<GetUserEventsReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);

  // Memoized sorting logic to prevent unnecessary re-computations
  const events = useMemo(() => {
    // Sort events: Host events first, then guest events by date (ascending)
    const sortedEvents = (rawEvents || []).sort(
      (a: GetUserEventsReturn, b: GetUserEventsReturn) => {
        // If both are host events or both are guest events, sort by date
        if (a.role === b.role) {
          return (
            new Date(a.event_date).getTime() -
            new Date(b.event_date).getTime()
          );
        }

        // Host events always come first
        if (a.role === 'host' && b.role !== 'host') {
          return -1;
        }
        if (b.role === 'host' && a.role !== 'host') {
          return 1;
        }

        // If neither is host, sort by date
        return (
          new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
        );
      },
    ).map((event: GetUserEventsReturn): UserEvent => ({
      event_id: event.id, // Map database 'id' to frontend 'event_id'
      title: event.title,
      event_date: event.event_date,
      location: event.location,
      user_role: event.role, // Map database 'role' to frontend 'user_role'
      rsvp_status: event.rsvp_status,
      is_primary_host: event.is_host, // Map database 'is_host' to frontend 'is_primary_host'
    }));

    return sortedEvents;
  }, [rawEvents]);

  const fetchUserEvents = useCallback(async () => {
    const wrappedFetch = withErrorHandling(async () => {
      setLoading(true);
      setError(null);

      // Get current user first
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('Authentication required');
      }

      // Fetch events using the RLS function
      const { data: userEvents, error: eventsError } =
        await supabase.rpc('get_user_events');

      if (eventsError) {
        throw new Error(eventsError.message || 'Failed to load your events');
      }

      // Store raw events - sorting will be handled by memoized logic
      setRawEvents(userEvents || []);
      setLoading(false);
    }, 'useUserEvents.fetchUserEvents');

    const result = await wrappedFetch();
    if (result?.error) {
      setError(result.error);
      logError(result.error, 'useUserEvents.fetchUserEvents');
      setLoading(false);
    }
  }, []);

  const refetch = useCallback(async () => {
    await fetchUserEvents();
  }, [fetchUserEvents]);

  useEffect(() => {
    fetchUserEvents();
  }, [fetchUserEvents]);

  return {
    events,
    loading,
    error,
    refetch,
  };
} 