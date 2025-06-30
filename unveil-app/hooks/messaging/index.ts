export { useMessages } from './useMessages';

// Cached versions with React Query
export {
  useEventMessagesCached,
  useMessageStatsCached,
  useSendMessage,
  useMessageRealtime,
} from './useMessagesCached';

export { 
  useScheduledMessages, 
  useScheduledMessageCounts, 
  useNextScheduledMessage 
} from './useScheduledMessages';

// Phase 3 - Guest Tagging hooks
export { useGuestTags } from './useGuestTags';

// Phase 4 - Analytics hooks
export {
  useDeliveryStats,
  useEngagementMetrics,
  useRSVPCorrelation,
  useEventAnalytics,
  useResponseRatesByMessageType,
  useRealtimeAnalytics,
  useAnalyticsDashboard,
  useAnalyticsWithDateRange,
  useAnalyticsComparison,
  type DeliveryStats,
  type EngagementMetrics,
  type RSVPCorrelation,
  type MessageAnalytics,
} from './useMessageAnalytics';

// Phase 5 - Guest messaging hooks
export { useGuestMessages, useGuestUnreadCount } from './useGuestMessages';
