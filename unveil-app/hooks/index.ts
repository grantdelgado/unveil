/**
 * Hooks Barrel - OPTIMIZED FOR TREE-SHAKING
 * 
 * WARNING: Wildcard exports can prevent proper tree-shaking.
 * RECOMMENDED: Import directly from specific hook files:
 * - import { useAuth } from '@/hooks/auth/useAuth'
 * - import { useEventDetails } from '@/hooks/events/useEventDetails'
 * - import { useDebounce } from '@/hooks/common/useDebounce'
 * 
 * Use this barrel only for frequently co-used hooks.
 */

// Most frequently used hooks (specific imports for better tree-shaking)
export { useAuth } from './auth/useAuth';
export { useEventDetails, useEventInsights, useUserEventsSorted } from './events';
export { useEventMedia } from './media';
export { useGuestMessages } from './messaging';
export { useGuests } from './guests';
export { useNavigation } from './navigation/useNavigation';
export { useRealtimeSubscription } from './realtime';
export { usePerformanceMonitor } from './performance';

// Most frequently used common hooks
export { useDebounce, usePagination, useHapticFeedback, usePullToRefresh } from './common';

// Domain-specific hook collections (use for multiple hooks from same domain)
export * as AuthHooks from './auth';
export * as EventHooks from './events';
export * as MediaHooks from './media';
export * as MessagingHooks from './messaging';
export * as GuestHooks from './guests';
export * as RealtimeHooks from './realtime';
export * as PerformanceHooks from './performance';
export * as CommonHooks from './common';
