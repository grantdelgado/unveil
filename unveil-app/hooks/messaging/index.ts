export { useMessages } from './useMessages';
// useGuestMessages removed - replaced by useGuestMessagesRPC with managed subscriptions
export { useGuestJoinTimestamp } from './useGuestJoinTimestamp';
export { useGuestSMSStatus } from './useGuestSMSStatus';
export { useMessagingRecipients } from './useMessagingRecipients';

// Note: Cached versions removed - use useMessages domain hook instead

export {
  useScheduledMessages,
  useUpcomingScheduledMessagesCount,
} from './useScheduledMessages';

// Analytics hooks temporarily removed

// Note: Guest tagging removed - simplified in useMessages domain hook

// Note: Analytics hooks removed - simplified in useMessages domain hook

// Phase 3: Unified messaging hook (feature flag controlled)
// TODO: Complete API alignment before enabling
// export { useMessaging } from './useMessaging';
// export type { UseMessagingOptions, UnifiedMessagingReturn } from './useMessaging';
