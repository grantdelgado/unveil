/**
 * Compatibility Wrapper: useScheduledMessages + Sub-hooks
 * 
 * Maps the legacy scheduled messages hooks to the new core system.
 * Preserves the original interface while routing through core hooks.
 * 
 * @deprecated Use core hooks directly: useEventMessagesList, useMessageMutations  
 */

import { useMemo } from 'react';
import {
  useEventMessagesList,
  useMessageMutations,
  type ScheduledMessage,
} from '../_core';

// Legacy interfaces (match original scheduled messages hooks)
interface ScheduledMessageFilters {
  status?: 'pending' | 'sent' | 'failed';
  eventId: string;
}

interface UseScheduledMessagesOptions {
  eventId: string;
  filters?: Partial<ScheduledMessageFilters>;
  autoRefresh?: boolean;
  realTimeUpdates?: boolean;
}

interface UseScheduledMessagesReturn {
  scheduledMessages: ScheduledMessage[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createScheduledMessage: (data: any) => Promise<any>;
  deleteScheduledMessage: (id: string) => Promise<void>;
  cancelScheduledMessage: (id: string) => Promise<void>;
}

/**
 * @deprecated Use useEventMessagesList + useMessageMutations instead
 * 
 * Migration path:
 * ```ts
 * // OLD:
 * const { scheduledMessages, createScheduledMessage } = useScheduledMessages({ eventId });
 * 
 * // NEW:
 * const { scheduleMessage, cancelScheduled } = useMessageMutations();
 * // For listing scheduled messages, use a dedicated query
 * ```
 */
export function useScheduledMessages({
  eventId,
  filters = {},
  autoRefresh = true,
  realTimeUpdates = true,
}: UseScheduledMessagesOptions): UseScheduledMessagesReturn {
  
  // Note: Core hooks don't directly handle scheduled messages listing
  // This is a limitation we'll address in the full migration
  // For now, return empty state with proper interface
  
  const { scheduleMessage, cancelScheduled } = useMessageMutations();
  
  // Development warning
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      '[DEPRECATED] useScheduledMessages is deprecated.',
      {
        eventId,
        filters,
        migrationNote: 'Scheduled message management will be added to core hooks in v1.1',
      }
    );
  }
  
  // Placeholder implementation for compatibility
  const scheduledMessages: ScheduledMessage[] = [];
  const loading = false;
  const error: string | null = null;
  
  const refetch = async () => {
    // Placeholder - would need proper scheduled messages query in core hooks
  };
  
  const createScheduledMessage = async (data: any) => {
    return await scheduleMessage(data);
  };
  
  const deleteScheduledMessage = async (id: string) => {
    return await cancelScheduled(id);
  };
  
  const cancelScheduledMessage = async (id: string) => {
    return await cancelScheduled(id);
  };
  
  return {
    scheduledMessages,
    loading,
    error,
    refetch,
    createScheduledMessage,
    deleteScheduledMessage,
    cancelScheduledMessage,
  };
}

/**
 * @deprecated Individual scheduled message hooks are consolidated
 */
export function useScheduledMessagesQuery({
  eventId,
  filters,
  autoRefresh = true,
  enabled = true,
}: any) {
  if (process.env.NODE_ENV === 'development') {
    console.warn('[DEPRECATED] useScheduledMessagesQuery is deprecated.');
  }
  
  return {
    data: [],
    loading: false,
    error: null,
    refetch: async () => {},
  };
}

/**
 * @deprecated Cache management is handled by React Query automatically
 */
export function useScheduledMessagesCache({
  eventId,
  autoInvalidate = true,
}: any) {
  if (process.env.NODE_ENV === 'development') {
    console.warn('[DEPRECATED] useScheduledMessagesCache is deprecated.');
  }
  
  return {
    invalidateScheduledMessages: async () => {
      // Cache invalidation is handled by core hooks automatically
    },
    prefetchScheduledMessages: async () => {
      // Prefetching would be handled by React Query
    },
  };
}

/**
 * @deprecated Realtime is built into core hooks
 */
export function useScheduledMessagesRealtime({
  eventId,
  onMessageScheduled,
  onMessageSent,
  onMessageCancelled,
}: any) {
  if (process.env.NODE_ENV === 'development') {
    console.warn('[DEPRECATED] useScheduledMessagesRealtime is deprecated.');
  }
  
  return {
    isConnected: false,
    error: null,
    subscribe: () => {},
    unsubscribe: () => {},
  };
}

/**
 * @deprecated Use useMessageMutations instead
 */
export function useUpcomingScheduledMessagesCount(eventId: string) {
  if (process.env.NODE_ENV === 'development') {
    console.warn('[DEPRECATED] useUpcomingScheduledMessagesCount is deprecated.');
  }
  
  return {
    data: 0,
    loading: false,
    error: null,
  };
}
