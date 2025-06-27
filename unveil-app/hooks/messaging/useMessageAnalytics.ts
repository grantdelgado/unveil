import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import {
  getDeliveryStatsForEvent,
  getEngagementMetrics,
  getRSVPCorrelation,
  getEventAnalytics,
  getResponseRatesByMessageType,
  type DeliveryStats,
  type EngagementMetrics,
  type RSVPCorrelation,
  type MessageAnalytics,
} from '@/services/messaging/analytics';
import { useRealtimeSubscription } from '@/hooks/realtime/useRealtimeSubscription';

/**
 * Hook for getting overall delivery statistics for an event
 */
export function useDeliveryStats(eventId: string) {
  return useQuery({
    queryKey: ['delivery-stats', eventId],
    queryFn: () => getDeliveryStatsForEvent(eventId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!eventId,
  });
}

/**
 * Hook for getting engagement metrics for a specific message
 */
export function useEngagementMetrics(messageId: string) {
  return useQuery({
    queryKey: ['engagement-metrics', messageId],
    queryFn: () => getEngagementMetrics(messageId),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!messageId,
  });
}

/**
 * Hook for getting RSVP correlation analysis for a message
 */
export function useRSVPCorrelation(messageId: string) {
  return useQuery({
    queryKey: ['rsvp-correlation', messageId],
    queryFn: () => getRSVPCorrelation(messageId),
    staleTime: 10 * 60 * 1000, // 10 minutes (RSVP changes slower)
    gcTime: 30 * 60 * 1000, // 30 minutes
    enabled: !!messageId,
    retry: 1, // RSVP correlation might fail for recent messages
    retryDelay: 5000,
  });
}

/**
 * Hook for comprehensive event analytics
 */
export function useEventAnalytics(eventId: string) {
  return useQuery({
    queryKey: ['event-analytics', eventId],
    queryFn: () => getEventAnalytics(eventId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    enabled: !!eventId,
  });
}

/**
 * Hook for response rates by message type
 */
export function useResponseRatesByMessageType(eventId: string) {
  return useQuery({
    queryKey: ['response-rates-by-type', eventId],
    queryFn: () => getResponseRatesByMessageType(eventId),
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    enabled: !!eventId,
  });
}

/**
 * Hook for real-time analytics updates
 */
export function useRealtimeAnalytics(eventId: string) {
  const queryClient = useQueryClient();

  // Subscribe to message delivery updates
  useRealtimeSubscription({
    subscriptionId: `analytics-deliveries-${eventId}`,
    table: 'message_deliveries',
    event: '*',
    filter: `scheduled_message_id=in.(select id from scheduled_messages where event_id=eq.${eventId})`,
    onDataChange: (payload) => {
      // Invalidate relevant analytics queries when deliveries change
      queryClient.invalidateQueries({
        queryKey: ['delivery-stats', eventId],
      });
      queryClient.invalidateQueries({
        queryKey: ['event-analytics', eventId],
      });
      
      // If we have a specific message ID, invalidate its engagement metrics
      if (payload.new?.scheduled_message_id) {
        queryClient.invalidateQueries({
          queryKey: ['engagement-metrics', payload.new.scheduled_message_id],
        });
      }
    },
    onError: (error) => {
      console.error('Real-time analytics subscription error:', error);
    },
  });

  // Subscribe to RSVP updates for correlation analysis
  useRealtimeSubscription({
    subscriptionId: `analytics-rsvp-${eventId}`,
    table: 'event_guests',
    event: 'UPDATE',
    filter: `event_id=eq.${eventId}`,
    onDataChange: (payload) => {
      // Invalidate RSVP correlation queries when guest RSVP status changes
      queryClient.invalidateQueries({
        queryKey: ['rsvp-correlation'],
      });
      queryClient.invalidateQueries({
        queryKey: ['event-analytics', eventId],
      });
    },
    onError: (error) => {
      console.error('Real-time RSVP analytics subscription error:', error);
    },
  });
}

/**
 * Hook that combines multiple analytics for a dashboard view
 */
export function useAnalyticsDashboard(eventId: string) {
  const deliveryStats = useDeliveryStats(eventId);
  const eventAnalytics = useEventAnalytics(eventId);
  const responseRates = useResponseRatesByMessageType(eventId);
  
  // Enable real-time updates
  useRealtimeAnalytics(eventId);

  const isLoading = deliveryStats.isLoading || eventAnalytics.isLoading || responseRates.isLoading;
  const isError = deliveryStats.isError || eventAnalytics.isError || responseRates.isError;
  
  const error = deliveryStats.error || eventAnalytics.error || responseRates.error;

  // Combine and transform data for dashboard consumption
  const dashboardData = useMemo(() => {
    if (!deliveryStats.data || !eventAnalytics.data || !responseRates.data) {
      return null;
    }

    return {
      overview: deliveryStats.data,
      engagement: eventAnalytics.data.engagementMetrics,
      rsvpCorrelations: eventAnalytics.data.rsvpCorrelations,
      topMessages: eventAnalytics.data.topPerformingMessages,
      messageTypeBreakdown: responseRates.data,
      trends: {
        // Calculate trends based on recent vs older messages
        recentEngagementRate: eventAnalytics.data.engagementMetrics
          .slice(0, 3)
          .reduce((sum, m) => sum + m.engagementRate, 0) / Math.min(3, eventAnalytics.data.engagementMetrics.length),
        overallEngagementRate: eventAnalytics.data.engagementMetrics
          .reduce((sum, m) => sum + m.engagementRate, 0) / Math.max(1, eventAnalytics.data.engagementMetrics.length),
      },
    };
  }, [deliveryStats.data, eventAnalytics.data, responseRates.data]);

  const refresh = useCallback(() => {
    deliveryStats.refetch();
    eventAnalytics.refetch();
    responseRates.refetch();
  }, [deliveryStats, eventAnalytics, responseRates]);

  return {
    data: dashboardData,
    isLoading,
    isError,
    error,
    refresh,
    // Individual query states for granular loading states
    queries: {
      deliveryStats,
      eventAnalytics,
      responseRates,
    },
  };
}

/**
 * Hook for analytics with date range filtering
 */
export function useAnalyticsWithDateRange(
  eventId: string,
  startDate?: Date,
  endDate?: Date
) {
  const queryKey = useMemo(() => [
    'analytics-date-range',
    eventId,
    startDate?.toISOString(),
    endDate?.toISOString(),
  ], [eventId, startDate, endDate]);

  return useQuery({
    queryKey,
    queryFn: async () => {
      // For now, we'll use the existing analytics and filter client-side
      // In a production app, you'd want to add date range support to the backend
      const analytics = await getEventAnalytics(eventId);
      
      if (!startDate && !endDate) {
        return analytics;
      }

      // Filter engagement metrics by date range if we had timestamp data
      // This is a placeholder - you'd need to add date filtering to the backend
      return analytics;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    enabled: !!eventId,
  });
}

/**
 * Hook for comparing analytics between time periods
 */
export function useAnalyticsComparison(
  eventId: string,
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  previousPeriodStart: Date,
  previousPeriodEnd: Date
) {
  const currentPeriod = useAnalyticsWithDateRange(eventId, currentPeriodStart, currentPeriodEnd);
  const previousPeriod = useAnalyticsWithDateRange(eventId, previousPeriodStart, previousPeriodEnd);

  const comparison = useMemo(() => {
    if (!currentPeriod.data || !previousPeriod.data) {
      return null;
    }

    const currentStats = currentPeriod.data.deliveryStats;
    const previousStats = previousPeriod.data.deliveryStats;

    return {
      deliveryRate: {
        current: currentStats.deliveryRate,
        previous: previousStats.deliveryRate,
        change: currentStats.deliveryRate - previousStats.deliveryRate,
        percentChange: previousStats.deliveryRate > 0 
          ? ((currentStats.deliveryRate - previousStats.deliveryRate) / previousStats.deliveryRate) * 100
          : 0,
      },
      responseRate: {
        current: currentStats.responseRate,
        previous: previousStats.responseRate,
        change: currentStats.responseRate - previousStats.responseRate,
        percentChange: previousStats.responseRate > 0
          ? ((currentStats.responseRate - previousStats.responseRate) / previousStats.responseRate) * 100
          : 0,
      },
      engagementRate: {
        current: currentPeriod.data.engagementMetrics.reduce((sum, m) => sum + m.engagementRate, 0) / Math.max(1, currentPeriod.data.engagementMetrics.length),
        previous: previousPeriod.data.engagementMetrics.reduce((sum, m) => sum + m.engagementRate, 0) / Math.max(1, previousPeriod.data.engagementMetrics.length),
      },
    };
  }, [currentPeriod.data, previousPeriod.data]);

  return {
    comparison,
    isLoading: currentPeriod.isLoading || previousPeriod.isLoading,
    isError: currentPeriod.isError || previousPeriod.isError,
    error: currentPeriod.error || previousPeriod.error,
  };
}

/**
 * Export all analytics types for components
 */
export type {
  DeliveryStats,
  EngagementMetrics,
  RSVPCorrelation,
  MessageAnalytics,
}; 