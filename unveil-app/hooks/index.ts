/**
 * Hooks Barrel - OPTIMIZED FOR TREE-SHAKING
 * 
 * WARNING: Wildcard exports can prevent proper tree-shaking.
 * RECOMMENDED: Import directly from specific hook files:
 * - import { useAuth } from '@/hooks/useAuth'
 * - import { useEvents } from '@/hooks/useEvents'
 * - import { useGuests } from '@/hooks/useGuests'
 * - import { useMessages } from '@/hooks/useMessages'
 * - import { useMedia } from '@/hooks/useMedia'
 * - import { useDebounce } from '@/hooks/common/useDebounce'
 * 
 * Use this barrel only for frequently co-used hooks.
 */

// Re-export all hooks for easy importing
export * from './useAuth';
export * from './useEvents';
export * from './useGuests';
export * from './useMessages';
export * from './useMedia';
export * from './usePostAuthRedirect';

// Legacy hooks (will be deprecated after component migration)
export { useEventDetails, useEventInsights, useUserEventsSorted } from './events';
// useEventMedia removed - simplified in useMedia domain hook
// useGuestMessages removed - simplified in useMessages domain hook
// useNavigation hook removed
export { useRealtimeSubscription } from './realtime';
export { usePerformanceMonitor } from './performance';

// Most frequently used common hooks
export { useDebounce, usePagination, useHapticFeedback, usePullToRefresh } from './common';

// Domain-specific hook collections (use for multiple hooks from same domain)
// Legacy hook collections removed - use domain hooks directly
// export * as AuthHooks from './auth';
export * as EventHooks from './events';
// export * as MediaHooks from './media';
// export * as MessagingHooks from './messaging';
export * as GuestHooks from './guests';
export * as RealtimeHooks from './realtime';
export * as PerformanceHooks from './performance';
export * as CommonHooks from './common';
