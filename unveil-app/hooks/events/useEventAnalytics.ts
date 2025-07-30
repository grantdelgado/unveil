import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { logError, type AppError } from '@/lib/error-handling';
import { withErrorHandling } from '@/lib/error-handling';
import { GuestFilterService, type GuestWithUser } from '@/lib/utils/guestFiltering';

interface EventAnalytics {
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

interface UseEventAnalyticsReturn {
  analytics: Record<string, EventAnalytics>;
  loading: boolean;
  error: AppError | null;
  fetchAnalytics: (eventIds: string[]) => Promise<void>;
  clearAnalytics: () => void;
}

/**
 * Modern replacement for useEventInsights
 * Provides comprehensive event analytics and guest statistics
 */
export function useEventAnalytics(): UseEventAnalyticsReturn {
  const [analytics, setAnalytics] = useState<Record<string, EventAnalytics>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  const fetchAnalytics = useCallback(async (eventIds: string[]) => {
    // Filter out invalid event IDs
    const validEventIds = eventIds.filter(id => id && id.trim() !== '');
    
    if (validEventIds.length === 0) {
      return;
    }

    const wrappedFetch = withErrorHandling(async () => {
      setLoading(true);
      setError(null);

      // Fetch guest data for all events with proper relationship syntax
      const { data: guestsData, error: guestsError } = await supabase
        .from('event_guests')
        .select(`
          id,
          event_id,
          user_id,
          guest_name,
          guest_email,
          phone,
          rsvp_status,
          notes,
          guest_tags,
          role,
          invited_at,
          phone_number_verified,
          sms_opt_out,
          preferred_communication,
          created_at,
          updated_at,
          users!user_id(
            id,
            full_name,
            phone,
            email,
            avatar_url,
            created_at,
            updated_at
          )
        `)
        .in('event_id', validEventIds)
        .order('updated_at', { ascending: false });

      if (guestsError) {
        throw new Error(guestsError.message || 'Failed to fetch guest analytics');
      }

      // Process analytics for each event using centralized filtering service
      const newAnalytics: Record<string, EventAnalytics> = {};

      for (const eventId of validEventIds) {
        const eventGuests = (guestsData?.filter(g => g.event_id === eventId) || []) as GuestWithUser[];
        
        // Use centralized filtering service for status counts
        const statusCounts = GuestFilterService.calculateStatusCounts(eventGuests);
        
        // Calculate response rate using centralized service
        const responseRate = GuestFilterService.calculateResponseRate(eventGuests);

        // Get recent activity using centralized service
        const recentActivity = GuestFilterService.getRecentActivity(eventGuests, 5);
        const lastActivity = recentActivity.length > 0 ? recentActivity[0].timestamp : null;

        newAnalytics[eventId] = {
          eventId,
          totalGuests: statusCounts.total,
          attendingCount: statusCounts.attending,
          declinedCount: statusCounts.declined,
          pendingCount: statusCounts.pending,
          maybeCount: statusCounts.maybe,
          responseRate,
          lastActivity,
          recentChanges: recentActivity,
        };
      }

      setAnalytics(prev => ({ ...prev, ...newAnalytics }));
      setLoading(false);
    }, 'useEventAnalytics.fetchAnalytics');

    const result = await wrappedFetch();
    if (result?.error) {
      setError(result.error);
      logError(result.error, 'useEventAnalytics.fetchAnalytics');
      setLoading(false);
    }
  }, []);

  const clearAnalytics = useCallback(() => {
    setAnalytics({});
    setError(null);
  }, []);

  return {
    analytics,
    loading,
    error,
    fetchAnalytics,
    clearAnalytics,
  };
} 