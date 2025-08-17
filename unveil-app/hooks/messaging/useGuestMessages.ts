import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Message } from '@/lib/types/messaging';

// Configuration constants
const INITIAL_WINDOW_SIZE = 30; // Load most recent 30 messages initially
const OLDER_MESSAGES_BATCH_SIZE = 20; // Load 20 older messages per request

interface UseGuestMessagesProps {
  eventId: string;
  guestId?: string;
}

export function useGuestMessages({ eventId, guestId }: UseGuestMessagesProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isFetchingOlder, setIsFetchingOlder] = useState(false);
  const [oldestMessageCursor, setOldestMessageCursor] = useState<string | null>(null);

  /**
   * Fetch initial window of recent messages
   */
  const fetchInitialMessages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from('messages')
        .select(`
          *,
          sender:users!messages_sender_user_id_fkey(*)
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .limit(INITIAL_WINDOW_SIZE + 1); // +1 to check if there are more

      if (fetchError) throw fetchError;

      const fetchedMessages = data || [];
      const hasMoreMessages = fetchedMessages.length > INITIAL_WINDOW_SIZE;
      
      // Remove the extra message used for pagination check
      const messagesToShow = hasMoreMessages 
        ? fetchedMessages.slice(0, INITIAL_WINDOW_SIZE)
        : fetchedMessages;
      
      // Reverse to show chronological order (oldest first)
      const sortedMessages = messagesToShow.reverse();
      
      setMessages(sortedMessages);
      setHasMore(hasMoreMessages);
      
      // Set cursor for fetching older messages
      if (sortedMessages.length > 0) {
        const oldestMessage = sortedMessages[0];
        setOldestMessageCursor(`${oldestMessage.created_at}:${oldestMessage.id}`);
      }
      
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch messages');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  /**
   * Fetch older messages for pagination
   */
  const fetchOlderMessages = useCallback(async () => {
    if (!oldestMessageCursor || isFetchingOlder) return;
    
    try {
      setIsFetchingOlder(true);
      setError(null);
      
      const [createdAt, messageId] = oldestMessageCursor.split(':');
      
      const { data, error: fetchError } = await supabase
        .from('messages')
        .select(`
          *,
          sender:users!messages_sender_user_id_fkey(*)
        `)
        .eq('event_id', eventId)
        .lt('created_at', createdAt)
        .order('created_at', { ascending: false })
        .limit(OLDER_MESSAGES_BATCH_SIZE + 1); // +1 to check if there are more

      if (fetchError) throw fetchError;

      const fetchedMessages = data || [];
      const hasMoreOlderMessages = fetchedMessages.length > OLDER_MESSAGES_BATCH_SIZE;
      
      // Remove the extra message used for pagination check
      const messagesToPrepend = hasMoreOlderMessages 
        ? fetchedMessages.slice(0, OLDER_MESSAGES_BATCH_SIZE)
        : fetchedMessages;
      
      if (messagesToPrepend.length > 0) {
        // Reverse to chronological order and prepend to existing messages
        const sortedOlderMessages = messagesToPrepend.reverse();
        
        // Deduplicate by ID to prevent duplicates during realtime updates
        setMessages(prevMessages => {
          const existingIds = new Set(prevMessages.map(m => m.id));
          const newMessages = sortedOlderMessages.filter(m => !existingIds.has(m.id));
          return [...newMessages, ...prevMessages];
        });
        
        // Update cursor for next batch
        const newOldestMessage = sortedOlderMessages[0];
        setOldestMessageCursor(`${newOldestMessage.created_at}:${newOldestMessage.id}`);
      }
      
      setHasMore(hasMoreOlderMessages);
      
    } catch (err) {
      console.error('Error fetching older messages:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch older messages');
    } finally {
      setIsFetchingOlder(false);
    }
  }, [eventId, oldestMessageCursor, isFetchingOlder]);

  /**
   * Handle real-time message updates
   */
  const handleRealtimeUpdate = useCallback(() => {
    // For realtime updates, only fetch the latest message to avoid full refetch
    const fetchLatestMessage = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('messages')
          .select(`
            *,
            sender:users!messages_sender_user_id_fkey(*)
          `)
          .eq('event_id', eventId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (fetchError) throw fetchError;

        const latestMessage = data?.[0];
        if (latestMessage) {
          setMessages(prevMessages => {
            // Check if this message already exists (deduplicate)
            const existingIndex = prevMessages.findIndex(m => m.id === latestMessage.id);
            if (existingIndex >= 0) {
              // Update existing message
              const updated = [...prevMessages];
              updated[existingIndex] = latestMessage;
              return updated;
            } else {
              // Add new message to the end
              return [...prevMessages, latestMessage];
            }
          });
        }
      } catch (err) {
        console.error('Error fetching latest message:', err);
      }
    };

    fetchLatestMessage();
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;

    fetchInitialMessages();

    // Set up real-time subscription
    const subscription = supabase
      .channel(`messages:${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `event_id=eq.${eventId}`,
        },
        handleRealtimeUpdate
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [eventId, fetchInitialMessages, handleRealtimeUpdate]);

  const sendMessage = async (content: string) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const { error: sendError } = await supabase
        .from('messages')
        .insert({
          event_id: eventId,
          content,
          sender_user_id: user.user.id,
          message_type: 'direct',
        });

      if (sendError) throw sendError;
    } catch (err) {
      console.error('Error sending message:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
    }
  };

  return {
    messages,
    loading,
    error,
    hasMore,
    isFetchingOlder,
    sendMessage,
    fetchOlderMessages,
  };
} 