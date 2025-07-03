import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Database } from '@/app/reference/supabase.types';
import type { MessageWithDelivery } from '@/lib/supabase/types';
import { 
  getMessageThread, 
  markMessageAsRead, 
  recordGuestResponse
} from '@/services/messaging/index';
import {
  getGuestMessages,
  sendGuestResponse,
  canGuestRespond,
  validateGuestResponse,
  markMessagesAsRead,
  getLatestHostMessage,
  respondToMessage,
} from '@/services/messaging/guest';
import { useRealtimeSubscription } from '@/hooks/realtime';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

// Types
type Message = Database['public']['Tables']['messages']['Row'];

interface MessagePayload {
  id: string;
  event_id: string;
  content: string;
  sender_user_id: string | null;
  created_at: string;
  message_type: string;
  scheduled_for?: string;
  read_at?: string;
}

interface UseGuestMessagesOptions {
  eventId: string;
  guestId: string;
  enabled?: boolean;
  limit?: number;
}

interface UseGuestMessagesReturn {
  messages: MessageWithDelivery[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  respondToMessage: (messageId: string, content: string) => Promise<{ messageId: string; success: boolean; }>;
  hasUnreadMessages: boolean;
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'error';
  isConnected: boolean;
  subscriptionHealth: {
    isHealthy: boolean;
    retryCount: number;
    lastError: string | null;
  };
}

/**
 * Enhanced hook for managing guest-specific messages with real-time updates
 */
export function useGuestMessages({
  eventId,
  guestId,
  enabled = true,
  limit = 50,
}: UseGuestMessagesOptions): UseGuestMessagesReturn {
  const queryClient = useQueryClient();
  
  // Stable refs to prevent dependency churn
  const processedMessageIds = useRef<Set<string>>(new Set());
  const lastSuccessfulFetch = useRef<Date>(new Date());
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const subscriptionErrorCount = useRef(0);
  
  // Local state
  const [error, setError] = useState<Error | null>(null);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [lastSubscriptionError, setLastSubscriptionError] = useState<string | null>(null);

  // Query key - memoized to prevent unnecessary re-renders
  const queryKey = useMemo(() => ['guest-messages', eventId, guestId], [eventId, guestId]);

  // Fetch messages query
  const {
    data: messages = [],
    isLoading: loading,
    error: queryError,
    refetch: refetchQuery,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!eventId || !guestId) {
        return [];
      }

      logger.realtime('Fetching guest messages', { eventId, guestId, limit });
      
      try {
        const result = await getGuestMessages({
          guestId,
          eventId,
          limit,
          includeResponses: true,
          markAsRead: true,
        });

        lastSuccessfulFetch.current = new Date();
        setError(null);
        subscriptionErrorCount.current = 0; // Reset error count on successful fetch
        
        return result;
      } catch (fetchError) {
        logger.realtimeError('Failed to fetch guest messages', fetchError);
        throw fetchError;
      }
    },
    enabled: enabled && !!eventId && !!guestId,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: (failureCount, error) => {
      logger.realtimeError('Query retry attempt', { failureCount, error: error.message });
      return failureCount < 3;
    },
  });

  // Enhanced realtime message update handler
  const handleRealtimeUpdate = useCallback(
    (payload: RealtimePostgresChangesPayload<MessagePayload>) => {
      if (!payload.new || !payload.new.id) {
        logger.warn('Invalid realtime payload received', { payload: payload.eventType });
        return;
      }

      const messageId = payload.new.id;
      
      // Prevent duplicate processing
      if (processedMessageIds.current.has(messageId)) {
        logger.realtime('Message already processed, skipping', { messageId });
        return;
      }

      processedMessageIds.current.add(messageId);
      
      // Clean up old processed IDs (keep last 100)
      if (processedMessageIds.current.size > 100) {
        const oldIds = Array.from(processedMessageIds.current).slice(0, 50);
        oldIds.forEach(id => processedMessageIds.current.delete(id));
      }

      logger.realtime('Processing new message via realtime', {
        messageId,
        eventType: payload.eventType,
        eventId: payload.new.event_id,
      });

      // Reset subscription health on successful update
      subscriptionErrorCount.current = 0;
      setLastSubscriptionError(null);

      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey });
    },
    [queryKey, queryClient],
  );

  // Enhanced subscription error handler
  const handleSubscriptionError = useCallback((error: Error) => {
    logger.realtimeError('Guest message subscription error', error);
    
    subscriptionErrorCount.current++;
    setError(error);
    setConnectionState('error');
    setLastSubscriptionError(error.message);

    // Implement exponential backoff for reconnection
    if (reconnectAttempts.current < maxReconnectAttempts) {
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
      reconnectAttempts.current++;
      
      logger.realtime('Attempting reconnection', { attempt: reconnectAttempts.current, maxAttempts: maxReconnectAttempts, delayMs: delay });
      
      setTimeout(() => {
        logger.realtime('Executing reconnection attempt', { attempt: reconnectAttempts.current });
        queryClient.invalidateQueries({ queryKey });
      }, delay);
    } else {
      logger.realtimeError('Max reconnection attempts exceeded, giving up', { maxAttempts: maxReconnectAttempts });
      setError(new Error(`Failed to establish real-time connection after ${maxReconnectAttempts} attempts`));
    }
  }, [queryKey, queryClient, maxReconnectAttempts]);

  // Enhanced status change handler
  const handleStatusChange = useCallback((status: 'connecting' | 'connected' | 'disconnected' | 'error') => {
    logger.realtime('Guest message subscription status change', { status });
    setConnectionState(status);
    
    if (status === 'connected') {
      reconnectAttempts.current = 0;
      subscriptionErrorCount.current = 0;
      setError(null);
      setLastSubscriptionError(null);
      
      // Refetch messages to ensure consistency after reconnection
      queryClient.invalidateQueries({ queryKey });
    } else if (status === 'error') {
      subscriptionErrorCount.current++;
    }
  }, [queryClient, queryKey]);

  // Setup enhanced realtime subscription
  const subscriptionId = useMemo(() => `messages-${eventId}`, [eventId]);
  
  const subscription = useRealtimeSubscription({
    subscriptionId,
    table: 'messages',
    event: 'INSERT',
    filter: `event_id=eq.${eventId}`,
    enabled: enabled && !!eventId,
    // Enhanced timeout configuration
    performanceOptions: {
      enableBatching: false,
      enableRateLimit: false,
      batchDelay: 100,
      maxUpdatesPerSecond: 5,
    },
    onDataChange: handleRealtimeUpdate,
    onError: handleSubscriptionError,
    onStatusChange: handleStatusChange,
  });

  // Response mutation
  const respondMutation = useMutation({
    mutationFn: async ({ messageId, content }: { messageId: string; content: string }) => {
      try {
        const result = await respondToMessage(messageId, content, { guestId, eventId });
        
        // Reset error state on successful response
        setError(null);
        subscriptionErrorCount.current = 0;
        
        return result;
      } catch (error) {
        logger.realtimeError('Error responding to message', error);
        throw error;
      }
    },
    onSuccess: () => {
      // Invalidate and refetch messages after successful response
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      logger.realtimeError('Error responding to message', error);
      setError(error as Error);
    },
  });

  // Enhanced refetch function
  const refetch = useCallback(async () => {
    try {
      logger.realtime('Manual refetch triggered for guest messages');
      await refetchQuery();
      
      // Reset error state on successful refetch
      setError(null);
      subscriptionErrorCount.current = 0;
      setLastSubscriptionError(null);
    } catch (error) {
      logger.realtimeError('Manual refetch failed', error);
      setError(error as Error);
    }
  }, [refetchQuery]);

  // Enhanced respond to message function
  const respondToMessageEnhanced = useCallback(async (messageId: string, content: string) => {
    try {
      const result = await respondMutation.mutateAsync({ messageId, content });
      logger.realtime('Response sent successfully', { messageId, success: result.success });
      return result;
    } catch (error) {
      logger.realtimeError('Failed to send response', error);
      throw error;
    }
  }, [respondMutation]);

  // Calculate subscription health
  const subscriptionHealth = useMemo(() => ({
    isHealthy: subscriptionErrorCount.current <= 2 && connectionState !== 'error',
    retryCount: reconnectAttempts.current,
    lastError: lastSubscriptionError,
  }), [connectionState, lastSubscriptionError]);

  // Calculate unread messages (simplified)
  const hasUnreadMessages = useMemo(() => {
    return messages.some(message => 
      message.sender_user_id !== guestId && // Not sent by this guest
      !message.read_at // Not marked as read
    );
  }, [messages, guestId]);

  return {
    messages,
    loading,
    error: error || queryError,
    refetch,
    respondToMessage: respondToMessageEnhanced,
    hasUnreadMessages,
    connectionState,
    isConnected: subscription.isConnected && connectionState === 'connected',
    subscriptionHealth,
  };
}

/**
 * Enhanced hook for tracking unread message count
 */
export function useGuestUnreadCount({
  eventId,
  guestId,
  enabled = true,
}: {
  eventId: string;
  guestId: string;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ['guest-unread-count', eventId, guestId],
    queryFn: async () => {
      // This would typically make an API call to get unread count
      // For now, return 0 as a placeholder
      return 0;
    },
    enabled: enabled && !!eventId && !!guestId,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  });
} 