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
  const handleRealtimeUpdate = useCallback((payload: any) => {
    if (payload.eventType === 'INSERT') {
      // For INSERT events, add the new message directly from payload
      const newMessage = payload.new;
      if (newMessage) {
        setMessages(prevMessages => {
          // Check if this message already exists (deduplicate)
          const existingIndex = prevMessages.findIndex(m => m.id === newMessage.id);
          if (existingIndex >= 0) {
            return prevMessages; // Already exists, no change
          } else {
            // Add new message to the end
            return [...prevMessages, newMessage];
          }
        });
      }
    } else if (payload.eventType === 'UPDATE') {
      // For UPDATE events, update the existing message
      const updatedMessage = payload.new;
      if (updatedMessage) {
        setMessages(prevMessages => {
          const existingIndex = prevMessages.findIndex(m => m.id === updatedMessage.id);
          if (existingIndex >= 0) {
            const updated = [...prevMessages];
            updated[existingIndex] = updatedMessage;
            return updated;
          }
          return prevMessages;
        });
      }
    } else if (payload.eventType === 'DELETE') {
      // For DELETE events, remove the message
      const deletedMessage = payload.old;
      if (deletedMessage) {
        setMessages(prevMessages => prevMessages.filter(m => m.id !== deletedMessage.id));
      }
    }
  }, []); // No dependencies to prevent re-creation

  // Separate effect for initial fetch to avoid subscription re-creation
  useEffect(() => {
    if (!eventId) return;
    fetchInitialMessages();
  }, [fetchInitialMessages]);

  // Separate effect for realtime subscription to maintain stable connection
  useEffect(() => {
    if (!eventId) return;

    // Set up real-time subscription with STABLE channel key
    const channelKey = `messages:${eventId}`;
    const subscription = supabase
      .channel(channelKey, {
        config: {
          broadcast: { self: false, ack: false },
          presence: { key: channelKey }
        }
      })
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
  }, [eventId]); // Only eventId dependency to prevent re-subscriptions

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