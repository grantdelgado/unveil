import { useState, useCallback, useEffect, useRef } from 'react';
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
} from '@/services/messaging/guest';
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
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'error';
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
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  
  // Track processed message IDs to prevent duplicates
  const processedMessageIds = useRef(new Set<string>());
  
  // Track reconnection attempts
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 3;
  
  // Last successful fetch timestamp for stale data detection
  const lastSuccessfulFetch = useRef<Date | null>(null);

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
    queryFn: async () => {
      const data = await getGuestMessages({
        guestId,
        eventId,
        limit,
        includeResponses: true,
        markAsRead: false, // We'll handle read marking separately
      });
      
      // Update processed IDs set and last fetch time
      processedMessageIds.current = new Set(data.map(msg => msg.id));
      lastSuccessfulFetch.current = new Date();
      
      return data;
    },
    enabled: enabled && !!eventId && !!guestId,
    staleTime: 30000, // 30 seconds - optimized for more frequent updates
    gcTime: 1000 * 60 * 10, // 10 minutes
    refetchOnWindowFocus: true, // Refetch when user returns to window
    refetchInterval: 60000, // Background refresh every 60 seconds
    refetchIntervalInBackground: false, // Only when tab is active
    retry: (failureCount, error) => {
      // Only retry on network errors, not on permission errors
      if (error instanceof Error && error.message.includes('permission')) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Mark message as read mutation - using enhanced guest service with optimistic updates
  const markAsReadMutation = useMutation({
    mutationFn: ({ messageId }: { messageId: string }) =>
      markMessagesAsRead(guestId, [messageId]),
    onMutate: async ({ messageId }) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previousMessages = queryClient.getQueryData(queryKey);

      // Optimistically update the cache - mark message as read
      queryClient.setQueryData(queryKey, (old: MessageWithDelivery[] | undefined) => {
        if (!old) return old;
        return old.map(msg => 
          msg.id === messageId 
            ? { ...msg, isRead: true } // Optimistically mark as read
            : msg
        );
      });

      return { previousMessages };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousMessages) {
        queryClient.setQueryData(queryKey, context.previousMessages);
      }
      console.error('Failed to mark message as read:', err);
      setError(new Error('Failed to mark message as read'));
    },
    onSettled: () => {
      // Always refetch after error or success to ensure consistency
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Send response mutation - using new sendGuestResponse service with optimistic updates
  const sendResponseMutation = useMutation({
    mutationFn: ({ messageId, content }: { messageId: string; content: string }) =>
      sendGuestResponse({ guestId, messageId, content, eventId }),
    onMutate: async ({ messageId, content }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previousMessages = queryClient.getQueryData(queryKey);

      // Optimistically add the response message
      queryClient.setQueryData(queryKey, (old: MessageWithDelivery[] | undefined) => {
        if (!old) return old;
        
        // Create optimistic response message (only include properties that exist in Message type)
        const optimisticResponse: MessageWithDelivery = {
          id: `temp-${Date.now()}`, // Temporary ID
          content,
          created_at: new Date().toISOString(),
          event_id: eventId,
          message_type: 'direct',
          sender_user_id: null, // Guest response, no user_id
        };
        
        return [...old, optimisticResponse];
      });

      return { previousMessages };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousMessages) {
        queryClient.setQueryData(queryKey, context.previousMessages);
      }
      console.error('Failed to send response:', err);
      setError(new Error('Failed to send response'));
    },
    onSettled: () => {
      // Always refetch after error or success to get the real response message
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Enhanced real-time message update handler with deduplication
  const handleRealtimeUpdate = useCallback(
    (payload: RealtimePostgresChangesPayload<Message>) => {
      console.log('📨 Real-time message update for guest:', {
        eventType: payload.eventType,
        messageId: (payload.new as any)?.id || (payload.old as any)?.id,
        guestId,
      });

      try {
        if (payload.eventType === 'INSERT') {
          const newMessage = payload.new as Message;
          
          // Check for duplicates
          if (processedMessageIds.current.has(newMessage.id)) {
            console.log(`🔄 Skipping duplicate INSERT for message ${newMessage.id}`);
            return;
          }
          
          // Add to processed set
          processedMessageIds.current.add(newMessage.id);
          
          // For real-time updates, we need to refetch to ensure proper filtering and delivery info
          // But we can do optimistic UI updates for better UX
          queryClient.invalidateQueries({ queryKey });
          
        } else if (payload.eventType === 'UPDATE') {
          const updatedMessage = payload.new as Message;
          
          // Add to processed set
          processedMessageIds.current.add(updatedMessage.id);
          
          // Invalidate to get fresh delivery info
          queryClient.invalidateQueries({ queryKey });
          
        } else if (payload.eventType === 'DELETE') {
          const deletedMessage = payload.old as Message;
          
          // Remove from processed set
          processedMessageIds.current.delete(deletedMessage.id);
          
          // Invalidate to update state
          queryClient.invalidateQueries({ queryKey });
        }
        
        // Reset error state on successful update
        setError(null);
        reconnectAttempts.current = 0;
        
      } catch (err) {
        console.error('❌ Error processing real-time guest message update:', err);
        setError(new Error('Failed to process real-time update'));
      }
    },
    [queryClient, queryKey, guestId]
  );

  // Real-time subscription with enhanced error handling
  const { isConnected } = useRealtimeSubscription({
    subscriptionId: `guest-messages-${eventId}-${guestId}`,
    table: 'messages',
    event: '*',
    filter: `event_id=eq.${eventId}`,
    enabled: enabled && !!eventId && !!guestId,
    onDataChange: handleRealtimeUpdate,
    onError: useCallback((realtimeError: Error) => {
      console.error('❌ Guest message subscription error:', realtimeError);
      setError(new Error(`Real-time connection error: ${realtimeError.message}`));
      setConnectionState('error');
      
      // Implement exponential backoff for reconnection
      reconnectAttempts.current += 1;
      if (reconnectAttempts.current <= maxReconnectAttempts) {
        const backoffDelay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        console.log(`🔄 Attempting reconnect in ${backoffDelay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);
        
        setTimeout(() => {
          // Trigger a refresh to ensure data consistency
          queryRefetch();
        }, backoffDelay);
      } else {
        setError(new Error('Failed to establish real-time connection after multiple attempts'));
      }
    }, [queryRefetch]),
    onStatusChange: useCallback((status: 'connecting' | 'connected' | 'disconnected' | 'error') => {
      console.log(`📡 Guest message subscription status: ${status}`);
      setConnectionState(status);
      
      if (status === 'connected') {
        setError(null); // Clear errors when successfully connected
        reconnectAttempts.current = 0;
        
        // Check if our data is stale and refresh if needed
        const isStale = lastSuccessfulFetch.current && 
          (new Date().getTime() - lastSuccessfulFetch.current.getTime()) > 60000; // 1 minute
        
        if (isStale) {
          console.log('🔄 Data is stale, refreshing after reconnection');
          queryRefetch();
        }
      } else if (status === 'error') {
        setError(new Error('Real-time connection failed'));
      }
    }, [queryRefetch]),
  });

  // Wrapper functions for mutations with enhanced error handling
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
    connectionState,
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
    retry: 2,
    retryDelay: 1000,
  });
} 