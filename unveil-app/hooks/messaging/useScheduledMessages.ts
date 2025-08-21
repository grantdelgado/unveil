/**
 * Hook for managing scheduled messages with full CRUD operations
 * Supports real-time updates and comprehensive error handling
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { getSubscriptionManager } from '@/lib/realtime/SubscriptionManager';
import { 
  getScheduledMessages, 
  createScheduledMessage, 
  deleteScheduledMessage,
  cancelScheduledMessage 
} from '@/lib/services/messaging';
import type { 
  CreateScheduledMessageData, 
  ScheduledMessageFilters 
} from '@/lib/types/messaging';
import type { Database } from '@/app/reference/supabase.types';

type ScheduledMessage = Database['public']['Tables']['scheduled_messages']['Row'];

interface UseScheduledMessagesReturn {
  scheduledMessages: ScheduledMessage[];
  loading: boolean;
  error: string | null;
  createScheduledMessage: (data: CreateScheduledMessageData) => Promise<{ success: boolean; error?: string }>;
  deleteScheduledMessage: (messageId: string) => Promise<{ success: boolean; error?: string }>;
  cancelScheduledMessage: (messageId: string) => Promise<{ success: boolean; error?: string }>;
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
  realTimeUpdates = true
}: UseScheduledMessagesOptions): UseScheduledMessagesReturn {
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // TODO(grant): StrictMode-safe refs to prevent duplicate subscriptions and fetches
  const isMountedRef = useRef(true);
  const fetchInFlightRef = useRef(false);
  const subscriptionIdRef = useRef<string | null>(null);

  // Memoize the complete filters object
  const completeFilters = useMemo(() => ({
    eventId,
    ...filters
  }), [eventId, filters]);

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

      const result = await getScheduledMessages(completeFilters);
      
      if (!isMountedRef.current) return; // Component unmounted during fetch
      
      if (!result.success) {
        // TODO(grant): Silent handling of AbortErrors from cancelled requests
        if (typeof result.error === 'string' && result.error.includes('Request cancelled')) {
          return; // Silent return for cancelled requests
        }
        throw new Error(
          (result.error && typeof result.error === 'object' && 'message' in result.error) 
            ? String(result.error.message)
            : 'Failed to fetch scheduled messages'
        );
      }

      setScheduledMessages(result.data || []);
    } catch (err) {
      if (!isMountedRef.current) return; // Component unmounted during error handling
      
      // TODO(grant): Reduce error noise for AbortErrors and cancelled requests
      if (err instanceof Error && (err.name === 'AbortError' || err.message.includes('Request cancelled'))) {
        return; // Silent return for aborted requests
      }
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch scheduled messages';
      setError(errorMessage);
      console.error('Error fetching scheduled messages:', err);
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
  const handleCreateScheduledMessage = useCallback(async (data: CreateScheduledMessageData) => {
    try {
      setError(null);
      
      const result = await createScheduledMessage(data);
      
      if (!result.success) {
        const errorMessage = (result.error && typeof result.error === 'object' && 'message' in result.error) 
          ? (result.error as { message: string }).message 
          : 'Failed to create scheduled message';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }

      // Refresh messages to include the new one
      await fetchMessages();
      
      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create scheduled message';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [fetchMessages]);

  /**
   * Delete a scheduled message permanently
   */
  const handleDeleteScheduledMessage = useCallback(async (messageId: string) => {
    try {
      setError(null);
      
      const result = await deleteScheduledMessage(messageId);
      
      if (!result.success) {
        const errorMessage = (result.error && typeof result.error === 'object' && 'message' in result.error) 
          ? (result.error as { message: string }).message 
          : 'Failed to delete scheduled message';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }

      // Remove from local state immediately for optimistic updates
      setScheduledMessages(prev => prev.filter(msg => msg.id !== messageId));
      
      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete scheduled message';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, []);

  /**
   * Cancel a scheduled message (mark as cancelled)
   */
  const handleCancelScheduledMessage = useCallback(async (messageId: string) => {
    try {
      setError(null);
      
      const result = await cancelScheduledMessage(messageId);
      
      if (!result.success) {
        const errorMessage = (result.error && typeof result.error === 'object' && 'message' in result.error) 
          ? (result.error as { message: string }).message 
          : 'Failed to cancel scheduled message';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }

      // Update local state immediately for optimistic updates
      setScheduledMessages(prev => 
        prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, status: 'cancelled' }
            : msg
        )
      );
      
      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to cancel scheduled message';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, []);

  /**
   * Manual refresh function
   */
  const refreshMessages = useCallback(async () => {
    await fetchMessages();
  }, [fetchMessages]);

  // Calculate message counts by status
  const { upcomingCount, sentCount, cancelledCount } = useMemo(() => {
    const upcoming = scheduledMessages.filter(msg => 
      msg.status === 'scheduled' && new Date(msg.send_at) > new Date()
    ).length;
    
    const sent = scheduledMessages.filter(msg => msg.status === 'sent').length;
    const cancelled = scheduledMessages.filter(msg => msg.status === 'cancelled').length;

    return {
      upcomingCount: upcoming,
      sentCount: sent,
      cancelledCount: cancelled
    };
  }, [scheduledMessages]);

  // Initial fetch
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // TODO(grant): Set up real-time subscription using SubscriptionManager for better stability and StrictMode safety
  useEffect(() => {
    if (!realTimeUpdates || !isMountedRef.current) return;

    const subscriptionId = `scheduled_messages:${eventId}`;
    subscriptionIdRef.current = subscriptionId;
    
    const subscriptionManager = getSubscriptionManager();
    
    const unsubscribe = subscriptionManager.subscribe(subscriptionId, {
      table: 'scheduled_messages',
      event: '*',
      filter: `event_id=eq.${eventId}`,
      callback: (payload) => {
        if (!isMountedRef.current) return;
        
        console.log('Scheduled message real-time update:', payload);

        switch (payload.eventType) {
          case 'INSERT':
            setScheduledMessages(prev => [...prev, payload.new as ScheduledMessage]);
            break;
          
          case 'UPDATE':
            setScheduledMessages(prev =>
              prev.map(msg =>
                msg.id === payload.new.id ? payload.new as ScheduledMessage : msg
              )
            );
            break;
          
          case 'DELETE':
            setScheduledMessages(prev =>
              prev.filter(msg => msg.id !== payload.old.id)
            );
            break;
        }
      },
      onError: (error) => {
        if (isMountedRef.current) {
          console.warn('Scheduled messages realtime error:', error);
        }
      },
      enableBackoff: true,
      maxRetries: 3
    });

    return () => {
      subscriptionIdRef.current = null;
      unsubscribe();
    };
  }, [eventId, realTimeUpdates]);

  // Auto-refresh interval (every 30 seconds for upcoming messages)
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      // Only refresh if we have upcoming messages that might need status updates
      const hasUpcoming = scheduledMessages.some(msg => 
        msg.status === 'scheduled' && new Date(msg.send_at) > new Date()
      );
      
      if (hasUpcoming) {
        fetchMessages();
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, scheduledMessages, fetchMessages]);

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
    cancelledCount
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
        console.error('Error fetching upcoming scheduled messages count:', error);
        setCount(0);
      } finally {
        setLoading(false);
      }
    };

    fetchCount();
  }, [eventId]);

  return { count, loading };
}