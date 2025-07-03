import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface EventInsights {
  eventId: string;
  totalGuests: number;
  attendingCount: number;
  declinedCount: number;
  pendingCount: number;
  maybeCount: number;
  responseRate: number;
  lastActivity: string | null;
  recentChanges: Array<{
    userName: string;
    status: string;
    timestamp: string;
  }>;
}

interface UseEventInsightsResult {
  insights: Record<string, EventInsights>;
  loading: boolean;
  error: string | null;
  fetchInsights: (eventIds: string[]) => Promise<void>;
}

export function useEventInsights(): UseEventInsightsResult {
  const [insights, setInsights] = useState<Record<string, EventInsights>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = useCallback(async (eventIds: string[]) => {
    // Filter out any undefined or null eventIds
    const validEventIds = eventIds.filter(id => id != null && id !== undefined && id !== '');
    
    if (validEventIds.length === 0) {
      console.warn('No valid event IDs provided to fetchInsights');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch guest data for all events with proper relationship syntax
      const { data: guestsData, error: guestsError } = await supabase
        .from('event_guests')
        .select(`
          event_id,
          rsvp_status,
          created_at,
          guest_name,
          users!user_id(full_name)
        `)
        .in('event_id', validEventIds)
        .order('created_at', { ascending: false });

      if (guestsError) {
        throw guestsError;
      }

      // Process insights for each event
      const newInsights: Record<string, EventInsights> = {};

      for (const eventId of validEventIds) {
        const eventGuests = guestsData?.filter(g => g.event_id === eventId) || [];
        
        // Count RSVPs
        const totalGuests = eventGuests.length;
        const attendingCount = eventGuests.filter(g => g.rsvp_status === 'attending').length;
        const declinedCount = eventGuests.filter(g => g.rsvp_status === 'declined').length;
        const maybeCount = eventGuests.filter(g => g.rsvp_status === 'maybe').length;
        const pendingCount = totalGuests - attendingCount - declinedCount - maybeCount;

        // Calculate response rate
        const responseRate = totalGuests > 0 ? ((totalGuests - pendingCount) / totalGuests) * 100 : 0;

        // Get recent activity
        const recentActivity = eventGuests
          .filter(g => g.rsvp_status && g.rsvp_status !== 'pending')
          .slice(0, 3)
          .map(g => ({
            userName: g.users?.full_name || g.guest_name || 'Someone',
            status: g.rsvp_status || 'pending',
            timestamp: g.created_at || '',
          }));

        const lastActivity = recentActivity.length > 0 ? recentActivity[0].timestamp : null;

        newInsights[eventId] = {
          eventId,
          totalGuests,
          attendingCount,
          declinedCount,
          pendingCount,
          maybeCount,
          responseRate,
          lastActivity,
          recentChanges: recentActivity,
        };
      }

      setInsights(newInsights);
    } catch (err) {
      console.error('Error fetching event insights:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch insights');
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    insights,
    loading,
    error,
    fetchInsights,
  };
} 