import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
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
  error: string | null;
  refresh: () => Promise<void>;
  addMessage: (message: ScheduledMessage) => void;
  updateMessage: (id: string, updates: Partial<ScheduledMessage>) => void;
  removeMessage: (id: string) => void;
}

export function useScheduledMessages({
  eventId,
  filters,
  autoRefresh = true,
  refreshInterval = 30000 // 30 seconds
}: UseScheduledMessagesOptions): UseScheduledMessagesReturn {
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Using imported supabase client

  const loadMessages = useCallback(async () => {
    try {
      setError(null);
      const messageFilters: ScheduledMessageFilters = {
        eventId,
        ...filters
      };
      
      const data = await getScheduledMessages(messageFilters);
      setMessages(data);
    } catch (err) {
      console.error('Error loading scheduled messages:', err);
      setError(err instanceof Error ? err.message : 'Failed to load scheduled messages');
    } finally {
      setLoading(false);
    }
  }, [eventId, filters]);

  const refresh = useCallback(async () => {
    await loadMessages();
  }, [loadMessages]);

  // Initial load
  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadMessages();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, loadMessages]);

  // Real-time subscription for scheduled messages
  useRealtimeSubscription({
    subscriptionId: `scheduled-messages-${eventId}`,
    table: 'scheduled_messages',
    filter: `event_id=eq.${eventId}`,
    onDataChange: useCallback((payload) => {
      if (payload.eventType === 'INSERT') {
        const newMessage = payload.new as ScheduledMessage;
        setMessages(prev => {
          // Check if message already exists
          const exists = prev.find(m => m.id === newMessage.id);
          if (exists) return prev;
          
          // Add new message in chronological order by send_at
          const newMessages = [...prev, newMessage];
          return newMessages.sort((a, b) => 
            new Date(a.send_at).getTime() - new Date(b.send_at).getTime()
          );
        });
      } else if (payload.eventType === 'UPDATE') {
        const updatedMessage = payload.new as ScheduledMessage;
        setMessages(prev => 
          prev.map(message => 
            message.id === updatedMessage.id ? updatedMessage : message
          )
        );
      } else if (payload.eventType === 'DELETE') {
        const deletedMessage = payload.old as ScheduledMessage;
        setMessages(prev => prev.filter(message => message.id !== deletedMessage.id));
      }
    }, [])
  });

  // Manual state management functions
  const addMessage = useCallback((message: ScheduledMessage) => {
    setMessages(prev => {
      const exists = prev.find(m => m.id === message.id);
      if (exists) return prev;
      
      const newMessages = [...prev, message];
      return newMessages.sort((a, b) => 
        new Date(a.send_at).getTime() - new Date(b.send_at).getTime()
      );
    });
  }, []);

  const updateMessage = useCallback((id: string, updates: Partial<ScheduledMessage>) => {
    setMessages(prev => 
      prev.map(message => 
        message.id === id ? { ...message, ...updates } : message
      )
    );
  }, []);

  const removeMessage = useCallback((id: string) => {
    setMessages(prev => prev.filter(message => message.id !== id));
  }, []);

  return {
    messages,
    loading,
    error,
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