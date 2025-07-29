/**
 * useScheduledMessages Hook - Refactored Composition
 * 
 * Main hook that composes the three specialized hooks for better separation of concerns:
 * - useScheduledMessagesQuery: React Query logic
 * - useScheduledMessagesCache: Cache operations  
 * - useScheduledMessagesRealtime: Real-time subscriptions
 * 
 * This maintains the original API while providing cleaner internal architecture.
 */

import { useCallback, useEffect } from 'react';
import { useScheduledMessagesQuery } from './scheduled/useScheduledMessagesQuery';
import { useScheduledMessagesCache } from './scheduled/useScheduledMessagesCache';
import { useScheduledMessagesRealtime } from './scheduled/useScheduledMessagesRealtime';
// Note: ScheduledMessageFilters type moved to useMessages hook
import type { Tables } from '@/app/reference/supabase.types';

type ScheduledMessage = Tables<'scheduled_messages'>;

interface UseScheduledMessagesOptions {
  eventId: string;
  filters?: ScheduledMessageFilters;
  autoRefresh?: boolean;
  refreshInterval?: number; // Deprecated, kept for API compatibility
}

interface UseScheduledMessagesReturn {
  messages: ScheduledMessage[];
  loading: boolean;
  error: Error | null;
  isConnected: boolean;
  refresh: () => Promise<void>;
  addMessage: (message: ScheduledMessage) => void;
  updateMessage: (id: string, updates: Partial<ScheduledMessage>) => void;
  removeMessage: (id: string) => void;
}

/**
 * Composed hook for scheduled messages
 * 
 * Uses three specialized hooks for clean separation of concerns:
 * 1. Query management
 * 2. Cache operations  
 * 3. Real-time subscriptions
 */
export function useScheduledMessages({
  eventId,
  filters,
  autoRefresh = true,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  refreshInterval = 30000 // Deprecated, using React Query settings instead
}: UseScheduledMessagesOptions): UseScheduledMessagesReturn {
  
  // 1. React Query logic
  const query = useScheduledMessagesQuery({
    eventId,
    filters,
    autoRefresh,
    enabled: !!eventId
  });

  // 2. Cache operations
  const cache = useScheduledMessagesCache({
    queryKey: query.queryKey
  });

  // 3. Real-time subscription
  const realtime = useScheduledMessagesRealtime({
    eventId,
    cache,
    onRefetch: query.refetch,
    enabled: !!eventId
  });

  // Update processed message IDs when query data changes
  useEffect(() => {
    if (query.messages.length > 0) {
      cache.processedMessageIds.current = new Set(query.messages.map(msg => msg.id));
    }
  }, [query.messages, cache.processedMessageIds]);

  // Create refresh function that clears real-time errors
  const refresh = useCallback(async () => {
    await query.refetch();
  }, [query.refetch]);

  // Combine errors from query and real-time
  const combinedError = query.error || realtime.error;

  return {
    messages: query.messages,
    loading: query.loading,
    error: combinedError,
    isConnected: realtime.isConnected,
    refresh,
    addMessage: cache.addMessage,
    updateMessage: cache.updateMessage,
    removeMessage: cache.removeMessage
  };
}

// Additional utility hook for scheduled message counts
export function useScheduledMessageCounts(eventId: string) {
  const { messages } = useScheduledMessages({ eventId, autoRefresh: true });

  const counts = messages.reduce((acc, message) => {
    const status = message.status || 'scheduled';
    acc[status] = (acc[status] || 0) + 1;
    acc.total++;
    return acc;
  }, {
    total: 0,
    scheduled: 0,
    sending: 0,
    sent: 0,
    failed: 0,
    cancelled: 0
  } as Record<string, number>);

  return counts;
}

// Hook for next scheduled message
export function useNextScheduledMessage(eventId: string) {
  const { messages, loading } = useScheduledMessages({ 
    eventId, 
    filters: { status: ['scheduled'] },
    autoRefresh: true 
  });

  const nextMessage = messages
    .filter(message => new Date(message.send_at) > new Date())
    .sort((a, b) => new Date(a.send_at).getTime() - new Date(b.send_at).getTime())[0];

  return {
    nextMessage: nextMessage || null,
    loading,
    timeUntilNext: nextMessage 
      ? new Date(nextMessage.send_at).getTime() - new Date().getTime()
      : null
  };
} 