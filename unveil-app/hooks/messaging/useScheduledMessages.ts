import { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRealtimeSubscription } from '@/hooks/realtime';
import { getScheduledMessages, type ScheduledMessageFilters } from '@/services/messaging/scheduled';
import type { Tables } from '@/app/reference/supabase.types';

type ScheduledMessage = Tables<'scheduled_messages'>;

interface UseScheduledMessagesOptions {
  eventId: string;
  filters?: ScheduledMessageFilters;
  autoRefresh?: boolean;
  refreshInterval?: number;
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

export function useScheduledMessages({
  eventId,
  filters,
  autoRefresh = true,
  refreshInterval = 30000 // 30 seconds - deprecated, using React Query settings instead
}: UseScheduledMessagesOptions): UseScheduledMessagesReturn {
  const queryClient = useQueryClient();
  const [error, setError] = useState<Error | null>(null);
  
  // Track processed message IDs to prevent duplicates
  const processedMessageIds = useRef(new Set<string>());
  
  // Track reconnection attempts
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 3;

  // Enhanced query key including filters for better caching
  const queryKey = ['scheduled-messages', eventId, filters];

  // React Query for scheduled messages with optimized settings
  const {
    data: messages = [],
    isLoading: loading,
    error: queryError,
    refetch: queryRefetch,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      const messageFilters: ScheduledMessageFilters = {
        eventId,
        ...filters
      };
      
      const data = await getScheduledMessages(messageFilters);
      
      // Update processed IDs set
      processedMessageIds.current = new Set(data.map(msg => msg.id));
      
      return data;
    },
    enabled: !!eventId,
    staleTime: 30000, // 30 seconds - optimized for frequent updates
    gcTime: 1000 * 60 * 10, // 10 minutes
    refetchOnWindowFocus: true, // Refetch when user returns to window
    refetchInterval: autoRefresh ? 60000 : false, // Background refresh every 60 seconds if enabled
    refetchIntervalInBackground: false, // Only when tab is active
    retry: (failureCount, error) => {
      // Only retry on network errors
      if (error instanceof Error && error.message.includes('permission')) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const refresh = useCallback(async () => {
    setError(null);
    await queryRefetch();
  }, [queryRefetch]);

  // Enhanced real-time subscription with React Query integration
  const { isConnected } = useRealtimeSubscription({
    subscriptionId: `scheduled-messages-${eventId}`,
    table: 'scheduled_messages',
    filter: `event_id=eq.${eventId}`,
    enabled: !!eventId,
    onDataChange: useCallback((payload) => {
      try {
        if (payload.eventType === 'INSERT') {
          const newMessage = payload.new as ScheduledMessage;
          
          // Check for duplicates
          if (processedMessageIds.current.has(newMessage.id)) {
            console.log(`🔄 Skipping duplicate INSERT for message ${newMessage.id}`);
            return;
          }
          
          // Optimistically update React Query cache
          queryClient.setQueryData(queryKey, (old: ScheduledMessage[] | undefined) => {
            if (!old) return [newMessage];
            
            // Double-check if message already exists
            const exists = old.find(m => m.id === newMessage.id);
            if (exists) {
              console.log(`🔄 Message ${newMessage.id} already exists in cache`);
              return old;
            }
            
            // Add to processed set
            processedMessageIds.current.add(newMessage.id);
            
            // Add new message in chronological order by send_at
            const newMessages = [...old, newMessage];
            return newMessages.sort((a, b) => 
              new Date(a.send_at).getTime() - new Date(b.send_at).getTime()
            );
          });
          
        } else if (payload.eventType === 'UPDATE') {
          const updatedMessage = payload.new as ScheduledMessage;
          
          // Optimistically update React Query cache
          queryClient.setQueryData(queryKey, (old: ScheduledMessage[] | undefined) => {
            if (!old) return old;
            return old.map(message => 
              message.id === updatedMessage.id ? updatedMessage : message
            );
          });
          
          // Ensure it's in processed set
          processedMessageIds.current.add(updatedMessage.id);
          
        } else if (payload.eventType === 'DELETE') {
          const deletedMessage = payload.old as ScheduledMessage;
          
          // Optimistically update React Query cache
          queryClient.setQueryData(queryKey, (old: ScheduledMessage[] | undefined) => {
            if (!old) return old;
            return old.filter(message => message.id !== deletedMessage.id);
          });
          
          // Remove from processed set
          processedMessageIds.current.delete(deletedMessage.id);
        }
        
        // Reset error state on successful update
        setError(null);
        reconnectAttempts.current = 0;
        
        // Invalidate query to ensure consistency after a delay
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey });
        }, 1000);
        
      } catch (err) {
        console.error('❌ Error processing real-time scheduled message update:', err);
        setError(new Error('Failed to process real-time update'));
      }
    }, [queryClient, queryKey]),
    onError: useCallback((realtimeError: Error) => {
      console.error('❌ Scheduled message subscription error:', realtimeError);
      setError(new Error(`Real-time connection error: ${realtimeError.message}`));
      
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
      console.log(`📡 Scheduled message subscription status: ${status}`);
      
      if (status === 'connected') {
        setError(null);
        reconnectAttempts.current = 0;
        
        // Refresh data when reconnected to ensure consistency
        queryRefetch();
      } else if (status === 'error') {
        setError(new Error('Real-time connection failed'));
      }
    }, [queryRefetch])
  });

  // Manual cache management functions with React Query optimization
  const addMessage = useCallback((message: ScheduledMessage) => {
    // Check if already processed
    if (processedMessageIds.current.has(message.id)) {
      console.log(`🔄 Skipping duplicate manual add for message ${message.id}`);
      return;
    }
    
    // Optimistically update React Query cache
    queryClient.setQueryData(queryKey, (old: ScheduledMessage[] | undefined) => {
      if (!old) return [message];
      
      const exists = old.find(m => m.id === message.id);
      if (exists) return old;
      
      // Add to processed set
      processedMessageIds.current.add(message.id);
      
      const newMessages = [...old, message];
      return newMessages.sort((a, b) => 
        new Date(a.send_at).getTime() - new Date(b.send_at).getTime()
      );
    });
  }, [queryClient, queryKey]);

  const updateMessage = useCallback((id: string, updates: Partial<ScheduledMessage>) => {
    // Optimistically update React Query cache
    queryClient.setQueryData(queryKey, (old: ScheduledMessage[] | undefined) => {
      if (!old) return old;
      return old.map(message => 
        message.id === id ? { ...message, ...updates } : message
      );
    });
    
    // Ensure it's in processed set
    processedMessageIds.current.add(id);
  }, [queryClient, queryKey]);

  const removeMessage = useCallback((id: string) => {
    // Optimistically update React Query cache
    queryClient.setQueryData(queryKey, (old: ScheduledMessage[] | undefined) => {
      if (!old) return old;
      return old.filter(message => message.id !== id);
    });
    
    // Remove from processed set
    processedMessageIds.current.delete(id);
  }, [queryClient, queryKey]);

  return {
    messages,
    loading,
    error: queryError || error, // Prefer React Query error, fallback to local error
    isConnected,
    refresh,
    addMessage,
    updateMessage,
    removeMessage
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