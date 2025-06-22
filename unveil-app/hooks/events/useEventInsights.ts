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
    if (eventIds.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch participant data for all events
      const { data: participantsData, error: participantsError } = await supabase
        .from('event_participants')
        .select(`
          event_id,
          rsvp_status,
          created_at,
          user:public_user_profiles(full_name)
        `)
        .in('event_id', eventIds)
        .order('created_at', { ascending: false });

      if (participantsError) {
        throw participantsError;
      }

      // Process insights for each event
      const newInsights: Record<string, EventInsights> = {};

      for (const eventId of eventIds) {
        const eventParticipants = participantsData?.filter(p => p.event_id === eventId) || [];
        
        // Count RSVPs
        const totalGuests = eventParticipants.length;
        const attendingCount = eventParticipants.filter(p => p.rsvp_status === 'attending').length;
        const declinedCount = eventParticipants.filter(p => p.rsvp_status === 'declined').length;
        const maybeCount = eventParticipants.filter(p => p.rsvp_status === 'maybe').length;
        const pendingCount = totalGuests - attendingCount - declinedCount - maybeCount;

        // Calculate response rate
        const responseRate = totalGuests > 0 ? ((totalGuests - pendingCount) / totalGuests) * 100 : 0;

        // Get recent activity
        const recentActivity = eventParticipants
          .filter(p => p.rsvp_status && p.rsvp_status !== 'pending')
          .slice(0, 3)
          .map(p => ({
            userName: p.user?.full_name || 'Someone',
            status: p.rsvp_status || 'pending',
            timestamp: p.created_at || '',
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