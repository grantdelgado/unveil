import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Database } from '@/app/reference/supabase.types';
import { 
  getMessageThread, 
  markMessageAsRead, 
  recordGuestResponse,
  type MessageWithDelivery 
} from '@/services/messaging/index';
import {
  getGuestMessagesDetailed,
  sendGuestResponse,
  canGuestRespond,
  validateGuestResponse,
  markMessagesAsRead,
  getLatestHostMessage,
} from '@/services/messaging/index';
import { useRealtimeSubscription } from '@/hooks/realtime';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// Types
type Message = Database['public']['Tables']['messages']['Row'];

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
  markAsRead: (messageId: string) => Promise<void>;
  sendResponse: (messageId: string, content: string) => Promise<void>;
  validateResponse: (content: string) => { isValid: boolean; error?: string };
  canRespond: boolean;
  isConnected: boolean;
}

/**
 * Hook for managing guest-specific messages with real-time updates
 */
export function useGuestMessages({
  eventId,
  guestId,
  enabled = true,
  limit = 50,
}: UseGuestMessagesOptions): UseGuestMessagesReturn {
  const queryClient = useQueryClient();
  const [error, setError] = useState<Error | null>(null);
  const [canRespond, setCanRespond] = useState<boolean>(false);

  // Query key for caching
  const queryKey = ['guest-messages', eventId, guestId, limit];

  // Fetch guest messages using the new guest service
  const {
    data: messages = [],
    isLoading: loading,
    error: queryError,
    refetch: queryRefetch,
  } = useQuery({
    queryKey,
    queryFn: () => getGuestMessagesDetailed({
      guestId,
      eventId,
      limit,
      includeResponses: true,
      markAsRead: false, // We'll handle read marking separately
    }),
    enabled: enabled && !!eventId && !!guestId,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    refetchOnWindowFocus: false,
  });

  // Mark message as read mutation - using enhanced guest service
  const markAsReadMutation = useMutation({
    mutationFn: ({ messageId }: { messageId: string }) =>
      markMessagesAsRead(guestId, [messageId]),
    onSuccess: () => {
      // Invalidate and refetch messages to update read status
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) => {
      console.error('Failed to mark message as read:', err);
      setError(new Error('Failed to mark message as read'));
    },
  });

  // Send response mutation - using new sendGuestResponse service
  const sendResponseMutation = useMutation({
    mutationFn: ({ messageId, content }: { messageId: string; content: string }) =>
      sendGuestResponse({ guestId, messageId, content, eventId }),
    onSuccess: () => {
      // Invalidate and refetch to update with new response message
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) => {
      console.error('Failed to send response:', err);
      setError(new Error('Failed to send response'));
    },
  });

  // Handle real-time message updates
  const handleRealtimeUpdate = useCallback(
    (payload: RealtimePostgresChangesPayload<Message>) => {
      console.log('📨 Real-time message update for guest:', payload);

      // Invalidate the query to refetch fresh data
      // This ensures we get properly filtered messages with delivery info
      queryClient.invalidateQueries({ queryKey });

      // Optionally, we could do optimistic updates here
      // but for guest messages, it's safer to refetch to ensure proper filtering
    },
    [queryClient, queryKey]
  );

  // Real-time subscription
  const { isConnected } = useRealtimeSubscription({
    subscriptionId: `guest-messages-${eventId}-${guestId}`,
    table: 'messages',
    event: '*',
    filter: `event_id=eq.${eventId}`,
    enabled: enabled && !!eventId && !!guestId,
    onDataChange: handleRealtimeUpdate,
    onError: (realtimeError) => {
      console.error('❌ Guest message subscription error:', realtimeError);
      setError(new Error('Real-time connection error'));
    },
    onStatusChange: (status) => {
      console.log(`📡 Guest message subscription status: ${status}`);
      if (status === 'connected') {
        setError(null); // Clear errors when successfully connected
      }
    },
  });

  // Wrapper functions for mutations
  const markAsRead = useCallback(
    async (messageId: string) => {
      try {
        setError(null);
        await markAsReadMutation.mutateAsync({ messageId });
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        throw error;
      }
    },
    [markAsReadMutation]
  );

  const sendResponse = useCallback(
    async (messageId: string, content: string) => {
      try {
        setError(null);
        
        // Validate content before sending
        const validation = validateGuestResponse(content);
        if (!validation.isValid) {
          throw new Error(validation.error || 'Invalid response content');
        }
        
        await sendResponseMutation.mutateAsync({ messageId, content });
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        throw error;
      }
    },
    [sendResponseMutation]
  );

  const refetch = useCallback(async () => {
    try {
      setError(null);
      await queryRefetch();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to refetch messages');
      setError(error);
      throw error;
    }
  }, [queryRefetch]);

  // Check if guest can respond (on mount and when dependencies change)
  useEffect(() => {
    if (enabled && eventId && guestId) {
      canGuestRespond(eventId, guestId)
        .then(result => setCanRespond(result.canRespond))
        .catch(() => setCanRespond(false));
    }
  }, [eventId, guestId, enabled]);

  // Update error state when query error changes
  useEffect(() => {
    if (queryError) {
      setError(queryError instanceof Error ? queryError : new Error('Query error'));
    }
  }, [queryError]);

  // Validate response helper function
  const validateResponse = useCallback((content: string) => {
    return validateGuestResponse(content);
  }, []);

  return {
    messages,
    loading,
    error,
    refetch,
    markAsRead,
    sendResponse,
    validateResponse,
    canRespond,
    isConnected,
  };
}

/**
 * Hook for getting unread message count for a guest
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
      const messages = await getMessageThread(eventId, guestId, 100);
      return messages.filter(msg => !msg.delivery?.has_responded).length;
    },
    enabled: enabled && !!eventId && !!guestId,
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 60, // Refetch every minute
  });
} 