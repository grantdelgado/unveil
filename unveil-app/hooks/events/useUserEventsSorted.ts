'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/app/reference/supabase.types';

// Type definitions based on MCP schema
type GetUserEventsReturn =
  Database['public']['Functions']['get_user_events']['Returns'][0];

interface SortedUserEvent {
  event_id: string;
  title: string;
  event_date: string;
  location: string | null;
  user_role: string;
  rsvp_status: string | null;
  is_primary_host: boolean;
}

interface UseUserEventsSortedReturn {
  events: SortedUserEvent[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useUserEventsSorted(): UseUserEventsSortedReturn {
  const [events, setEvents] = useState<SortedUserEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAndSortEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current user first
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError('Authentication required');
        setLoading(false);
        return;
      }

      // Fetch events using the RLS function
      const { data: userEvents, error: eventsError } =
        await supabase.rpc('get_user_events');

      if (eventsError) {
        console.error('Error fetching events:', eventsError);
        setError('Failed to load your events. Please try again.');
        setLoading(false);
        return;
      }

      // Sort events: Host events first, then guest events by date (ascending)
      const sortedEvents = (userEvents || []).sort(
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
      ).map((event: GetUserEventsReturn): SortedUserEvent => ({
        event_id: event.id, // Map database 'id' to frontend 'event_id'
        title: event.title,
        event_date: event.event_date,
        location: event.location,
        user_role: event.role, // Map database 'role' to frontend 'user_role'
        rsvp_status: event.rsvp_status,
        is_primary_host: event.is_host, // Map database 'is_host' to frontend 'is_primary_host'
      }));

      setEvents(sortedEvents);
      setLoading(false);
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  }, []);

  const refetch = useCallback(async () => {
    await fetchAndSortEvents();
  }, [fetchAndSortEvents]);

  useEffect(() => {
    fetchAndSortEvents();
  }, [fetchAndSortEvents]);

  return {
    events,
    loading,
    error,
    refetch,
  };
}
