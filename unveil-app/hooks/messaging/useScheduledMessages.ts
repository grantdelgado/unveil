/**
 * Hook for managing scheduled messages with full CRUD operations
 * Supports real-time updates and comprehensive error handling
 */

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  startTransition,
} from 'react';
import { supabase } from '@/lib/supabase';
import { useSubscriptionManager } from '@/lib/realtime/SubscriptionProvider';
import {
  getScheduledMessages,
  createScheduledMessage,
  deleteScheduledMessage,
  cancelScheduledMessage,
} from '@/lib/services/messaging';
import type {
  CreateScheduledMessageData,
  ScheduledMessageFilters,
} from '@/lib/types/messaging';
import type { Database } from '@/app/reference/supabase.types';

type ScheduledMessage =
  Database['public']['Tables']['scheduled_messages']['Row'];

interface UseScheduledMessagesReturn {
  scheduledMessages: ScheduledMessage[];
  loading: boolean;
  error: string | null;
  createScheduledMessage: (
    data: CreateScheduledMessageData,
  ) => Promise<{ success: boolean; error?: string }>;
  deleteScheduledMessage: (
    messageId: string,
  ) => Promise<{ success: boolean; error?: string }>;
  cancelScheduledMessage: (
    messageId: string,
  ) => Promise<{ success: boolean; error?: string }>;
  refreshMessages: () => Promise<void>;
  upcomingCount: number;
  sentCount: number;
  cancelledCount: number;
}

interface UseScheduledMessagesOptions {
  eventId: string;
  filters?: Omit<ScheduledMessageFilters, 'eventId'>;
  autoRefresh?: boolean;
  realTimeUpdates?: boolean;
}

/**
 * Hook for managing scheduled messages with real-time updates
 */
export function useScheduledMessages({
  eventId,
  filters = {},
  autoRefresh = true,
  realTimeUpdates = true,
}: UseScheduledMessagesOptions): UseScheduledMessagesReturn {
  const [scheduledMessages, setScheduledMessages] = useState<
    ScheduledMessage[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // TODO(grant): StrictMode-safe refs to prevent duplicate subscriptions and fetches
  const isMountedRef = useRef(true);
  const fetchInFlightRef = useRef(false);
  const subscriptionIdRef = useRef<string | null>(null);

  // Memoize the complete filters object with stable serialization
  const completeFilters = useMemo(
    () => ({
      eventId,
      ...filters,
    }),
    [eventId, filters],
  );

  /**
   * Fetch scheduled messages from the server (StrictMode-safe)
   */
  const fetchMessages = useCallback(async () => {
    // TODO(grant): Prevent duplicate fetches during StrictMode double-invoke or rapid re-renders
    if (fetchInFlightRef.current || !isMountedRef.current) {
      return;
    }

    try {
      fetchInFlightRef.current = true;
      setLoading(true);
      setError(null);

      console.log('[useScheduledMessages] Fetching with filters:', completeFilters);
      const result = await getScheduledMessages(completeFilters);
      console.log('[useScheduledMessages] Service result:', result);

      if (!isMountedRef.current) return; // Component unmounted during fetch

      if (!result.success) {
        // TODO(grant): Silent handling of AbortErrors from cancelled requests
        if (
          typeof result.error === 'string' &&
          result.error.includes('Request cancelled')
        ) {
          return; // Silent return for cancelled requests
        }
        throw new Error(
          result.error &&
          typeof result.error === 'object' &&
          'message' in result.error
            ? String(result.error.message)
            : 'Failed to fetch scheduled messages',
        );
      }

      console.log('[useScheduledMessages] Setting messages:', result.data?.length || 0);
      setScheduledMessages(result.data || []);
    } catch (err) {
      if (!isMountedRef.current) return; // Component unmounted during error handling

      // TODO(grant): Reduce error noise for AbortErrors and cancelled requests
      if (
        err instanceof Error &&
        (err.name === 'AbortError' || err.message.includes('Request cancelled'))
      ) {
        return; // Silent return for aborted requests
      }

      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Failed to fetch scheduled messages';
      console.error('[useScheduledMessages] Error details:', {
        error: err,
        message: errorMessage,
        filters: completeFilters
      });
      setError(errorMessage);
    } finally {
      fetchInFlightRef.current = false;
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [completeFilters]);

  /**
   * Create a new scheduled message
   */
  const handleCreateScheduledMessage = useCallback(
    async (data: CreateScheduledMessageData) => {
      try {
        setError(null);

        const result = await createScheduledMessage(data);

        if (!result.success) {
          const errorMessage =
            result.error &&
            typeof result.error === 'object' &&
            'message' in result.error
              ? (result.error as { message: string }).message
              : 'Failed to create scheduled message';
          setError(errorMessage);
          return { success: false, error: errorMessage };
        }

        // Refresh messages to include the new one
        await fetchMessages();

        return { success: true };
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : 'Failed to create scheduled message';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }
    },
    [fetchMessages],
  );

  /**
   * Delete a scheduled message permanently
   */
  const handleDeleteScheduledMessage = useCallback(
    async (messageId: string) => {
      try {
        setError(null);

        const result = await deleteScheduledMessage(messageId);

        if (!result.success) {
          const errorMessage =
            result.error &&
            typeof result.error === 'object' &&
            'message' in result.error
              ? (result.error as { message: string }).message
              : 'Failed to delete scheduled message';
          setError(errorMessage);
          return { success: false, error: errorMessage };
        }

        // Remove from local state immediately for optimistic updates
        setScheduledMessages((prev) =>
          prev.filter((msg) => msg.id !== messageId),
        );

        return { success: true };
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : 'Failed to delete scheduled message';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }
    },
    [],
  );

  /**
   * Cancel a scheduled message (mark as cancelled)
   */
  const handleCancelScheduledMessage = useCallback(
    async (messageId: string) => {
      try {
        setError(null);

        const result = await cancelScheduledMessage(messageId);

        if (!result.success) {
          const errorMessage =
            result.error &&
            typeof result.error === 'object' &&
            'message' in result.error
              ? (result.error as { message: string }).message
              : 'Failed to cancel scheduled message';
          setError(errorMessage);
          return { success: false, error: errorMessage };
        }

        // Update local state immediately for optimistic updates
        setScheduledMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId ? { ...msg, status: 'cancelled' } : msg,
          ),
        );

        return { success: true };
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : 'Failed to cancel scheduled message';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }
    },
    [],
  );

  /**
   * Manual refresh function
   */
  const refreshMessages = useCallback(async () => {
    await fetchMessages();
  }, [fetchMessages]);

  // Calculate message counts by status
  const { upcomingCount, sentCount, cancelledCount } = useMemo(() => {
    const upcoming = scheduledMessages.filter(
      (msg) => msg.status === 'scheduled' && new Date(msg.send_at) > new Date(),
    ).length;

    const sent = scheduledMessages.filter(
      (msg) => msg.status === 'sent',
    ).length;
    const cancelled = scheduledMessages.filter(
      (msg) => msg.status === 'cancelled',
    ).length;

    return {
      upcomingCount: upcoming,
      sentCount: sent,
      cancelledCount: cancelled,
    };
  }, [scheduledMessages]);

  // Initial fetch
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Enhanced real-time subscription with provider-managed SubscriptionManager
  const { manager, version, isReady } = useSubscriptionManager();

  useEffect(() => {
    if (!realTimeUpdates || !isMountedRef.current || !isReady || !manager)
      return;

    const subscriptionId = `scheduled_messages:${eventId}`;
    subscriptionIdRef.current = subscriptionId;

    // Hotfix: Dev observability - log subscription creation
    if (process.env.NODE_ENV === 'development') {
      console.log('[MessageHistory] Creating subscription:', {
        subscriptionId,
        eventId,
        isReady,
        hasManager: !!manager
      });
    }

    const unsubscribe = manager.subscribe(subscriptionId, {
      table: 'scheduled_messages',
      event: '*',
      filter: `event_id=eq.${eventId}`,
      callback: (payload) => {
        if (!isMountedRef.current) return;

        console.log('Scheduled message real-time update:', payload);

        // Batch updates with startTransition to prevent flicker
        startTransition(() => {
          switch (payload.eventType) {
            case 'INSERT':
              // Add deduplication to prevent duplicate messages
              setScheduledMessages((prev) => {
                const existingIds = new Set(prev.map((msg) => msg.id));
                const newMessage = payload.new as ScheduledMessage;
                if (existingIds.has(newMessage.id)) {
                  return prev; // Skip if already exists
                }
                return [...prev, newMessage];
              });
              break;

            case 'UPDATE':
              setScheduledMessages((prev) =>
                prev.map((msg) =>
                  msg.id === payload.new.id
                    ? (payload.new as ScheduledMessage)
                    : msg,
                ),
              );
              break;

            case 'DELETE':
              setScheduledMessages((prev) =>
                prev.filter((msg) => msg.id !== payload.old.id),
              );
              break;
          }
        });
      },
      onError: (error) => {
        if (isMountedRef.current) {
          console.warn('Scheduled messages realtime error:', error);
        }
      },
      enableBackoff: true,
      maxRetries: 3,
    });

    return () => {
      // Hotfix: Dev observability - log subscription cleanup
      if (process.env.NODE_ENV === 'development') {
        console.log('[MessageHistory] Cleaning up subscription:', {
          subscriptionId,
          eventId
        });
      }
      subscriptionIdRef.current = null;
      unsubscribe();
    };
  }, [eventId, realTimeUpdates, manager, version, isReady]);

  // Auto-refresh interval (every 2 minutes for upcoming messages) - stabilized dependencies
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      // Check current state inside interval to avoid dependency issues
      fetchMessages();
    }, 120000); // 2 minutes (reduced from 30s to minimize flicker)

    return () => clearInterval(interval);
  }, [autoRefresh, fetchMessages]); // Simplified: always refresh on interval

  // TODO(grant): Cleanup effect to mark component as unmounted for StrictMode safety
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    scheduledMessages,
    loading,
    error,
    createScheduledMessage: handleCreateScheduledMessage,
    deleteScheduledMessage: handleDeleteScheduledMessage,
    cancelScheduledMessage: handleCancelScheduledMessage,
    refreshMessages,
    upcomingCount,
    sentCount,
    cancelledCount,
  };
}

/**
 * Lightweight hook for just checking if there are any upcoming scheduled messages
 */
export function useUpcomingScheduledMessagesCount(eventId: string): {
  count: number;
  loading: boolean;
} {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const { data } = await supabase
          .from('scheduled_messages')
          .select('id', { count: 'exact' })
          .eq('event_id', eventId)
          .eq('status', 'scheduled')
          .gt('send_at', new Date().toISOString());

        setCount(data?.length || 0);
      } catch (error) {
        console.error(
          'Error fetching upcoming scheduled messages count:',
          error,
        );
        setCount(0);
      } finally {
        setLoading(false);
      }
    };

    fetchCount();
  }, [eventId]);

  return { count, loading };
}
