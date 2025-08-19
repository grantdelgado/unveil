import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

// Configuration constants
const INITIAL_WINDOW_SIZE = 30;
const OLDER_MESSAGES_BATCH_SIZE = 20;

// Message type from RPC response
interface GuestMessage {
  message_id: string;
  content: string;
  created_at: string;
  delivery_status: string;
  sender_name: string;
  sender_avatar_url: string | null;
  message_type: string;
  is_own_message: boolean;
}

interface UseGuestMessagesRPCProps {
  eventId: string;
  guestId?: string; // Legacy prop, not used in RPC implementation
}

export function useGuestMessagesRPC({ eventId }: UseGuestMessagesRPCProps) {
  const [messages, setMessages] = useState<GuestMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isFetchingOlder, setIsFetchingOlder] = useState(false);
  const [oldestMessageCursor, setOldestMessageCursor] = useState<string | null>(null);

  /**
   * Fetch initial window of recent messages using RPC
   */
  const fetchInitialMessages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      logger.info('Fetching initial guest messages via RPC', { eventId });

      const { data, error: rpcError } = await supabase
        .rpc('get_guest_event_messages', { 
          p_event_id: eventId, 
          p_limit: INITIAL_WINDOW_SIZE + 1 // +1 to check if there are more
        });

      if (rpcError) {
        // Handle specific error cases with user-friendly messages
        if (rpcError.message?.includes('User has been removed from this event')) {
          throw new Error('You are no longer a guest of this event');
        } else if (rpcError.message?.includes('User is not a guest of this event')) {
          throw new Error('Access denied: You are not a guest of this event');
        } else {
          throw new Error(`Failed to fetch guest messages: ${rpcError.message}`);
        }
      }

      const messagesArray = Array.isArray(data) ? data : [];
      const hasMoreMessages = messagesArray.length > INITIAL_WINDOW_SIZE;
      const messagesToShow = hasMoreMessages 
        ? messagesArray.slice(0, INITIAL_WINDOW_SIZE)
        : messagesArray;

      // Reverse to show chronological order (oldest first)
      const sortedMessages = messagesToShow.reverse();
      
      setMessages(sortedMessages);
      setHasMore(hasMoreMessages);
      
      // Set cursor for fetching older messages
      if (sortedMessages.length > 0) {
        const oldestMessage = sortedMessages[0];
        setOldestMessageCursor(oldestMessage.created_at);
      }

      logger.info('Successfully fetched initial guest messages', { 
        eventId, 
        count: sortedMessages.length,
        hasMore: hasMoreMessages
      });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch messages';
      logger.error('Error fetching initial guest messages', { error: err, eventId });
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  /**
   * Fetch older messages for pagination using RPC
   */
  const fetchOlderMessages = useCallback(async () => {
    if (!oldestMessageCursor || isFetchingOlder) return;
    
    try {
      setIsFetchingOlder(true);
      setError(null);
      
      logger.info('Fetching older guest messages via RPC', { 
        eventId, 
        before: oldestMessageCursor 
      });

      const { data, error: rpcError } = await supabase
        .rpc('get_guest_event_messages', { 
          p_event_id: eventId, 
          p_limit: OLDER_MESSAGES_BATCH_SIZE + 1,
          p_before: oldestMessageCursor
        });

      if (rpcError) {
        // Handle specific error cases with user-friendly messages
        if (rpcError.message?.includes('User has been removed from this event')) {
          throw new Error('You are no longer a guest of this event');
        } else if (rpcError.message?.includes('User is not a guest of this event')) {
          throw new Error('Access denied: You are not a guest of this event');
        } else {
          throw new Error(`Failed to fetch older messages: ${rpcError.message}`);
        }
      }

      const messagesArray = Array.isArray(data) ? data : [];
      const hasMoreOlderMessages = messagesArray.length > OLDER_MESSAGES_BATCH_SIZE;
      const messagesToPrepend = hasMoreOlderMessages 
        ? messagesArray.slice(0, OLDER_MESSAGES_BATCH_SIZE)
        : messagesArray;
      
      if (messagesToPrepend.length > 0) {
        // Reverse to chronological order and prepend to existing messages
        const sortedOlderMessages = messagesToPrepend.reverse();
        
        // Deduplicate by ID to prevent duplicates during realtime updates
        setMessages(prevMessages => {
          const existingIds = new Set(prevMessages.map(m => m.message_id));
          const newMessages = sortedOlderMessages.filter(m => !existingIds.has(m.message_id));
          return [...newMessages, ...prevMessages];
        });
        
        // Update cursor for next batch
        const newOldestMessage = sortedOlderMessages[0];
        setOldestMessageCursor(newOldestMessage.created_at);
      }
      
      setHasMore(hasMoreOlderMessages);

      logger.info('Successfully fetched older guest messages', { 
        eventId, 
        count: messagesToPrepend.length,
        hasMore: hasMoreOlderMessages
      });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch older messages';
      logger.error('Error fetching older guest messages', { error: err, eventId });
      setError(errorMessage);
    } finally {
      setIsFetchingOlder(false);
    }
  }, [eventId, oldestMessageCursor, isFetchingOlder]);

  /**
   * Handle real-time message updates
   */
  const handleRealtimeUpdate = useCallback((payload: any) => {
    if (payload.eventType === 'INSERT') {
      // For new messages, refetch the initial window to ensure we get the complete message data
      // This is simpler and more reliable than trying to construct the message from the payload
      fetchInitialMessages();
    }
    // For UPDATE/DELETE events, we could implement more granular updates,
    // but for MVP, a simple refetch ensures consistency
  }, [fetchInitialMessages]);

  // Fetch initial messages
  useEffect(() => {
    if (!eventId) return;
    fetchInitialMessages();
  }, [fetchInitialMessages]);

  // Set up realtime subscription for new messages
  useEffect(() => {
    if (!eventId) return;

    let subscription: any = null;
    let isCleanedUp = false;

    const setupRealtimeSubscription = async () => {
      try {
        // Get current user for filtering
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user || isCleanedUp) {
          return;
        }

        const channelKey = `guest_messages_rpc:${user.id}:${eventId}`;
        
        subscription = supabase
          .channel(channelKey, {
            config: {
              broadcast: { self: false, ack: false },
              presence: { key: channelKey }
            }
          })
          // Listen for new delivery records for this user
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'message_deliveries',
              filter: `user_id=eq.${user.id}`,
            },
            handleRealtimeUpdate
          )
          // Listen for new messages from this user
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
              filter: `sender_user_id=eq.${user.id}`,
            },
            (payload) => {
              // Only trigger update if the message is for this event
              if (payload.new && payload.new.event_id === eventId && !isCleanedUp) {
                handleRealtimeUpdate(payload);
              }
            }
          )
          .subscribe();

        logger.info('Guest messages RPC realtime subscription established', { eventId, userId: user.id });

      } catch (error) {
        if (!isCleanedUp) {
          logger.error('Guest messages RPC subscription error', { error, eventId });
        }
      }
    };

    setupRealtimeSubscription();

    return () => {
      isCleanedUp = true;
      if (subscription) {
        try {
          subscription.unsubscribe();
          logger.info('Guest messages RPC subscription cleaned up', { eventId });
        } catch (error) {
          // Ignore cleanup errors
        }
        subscription = null;
      }
    };
  }, [eventId, handleRealtimeUpdate]);

  /**
   * Send a new message (guest reply)
   */
  const sendMessage = async (content: string) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      logger.info('Sending guest message', { eventId, content: content.substring(0, 50) });

      const { error: sendError } = await supabase
        .from('messages')
        .insert({
          event_id: eventId,
          content,
          sender_user_id: user.user.id,
          message_type: 'direct',
        });

      if (sendError) throw sendError;

      logger.info('Guest message sent successfully', { eventId });
      
      // Trigger a refetch to show the new message immediately
      // The realtime subscription will also trigger an update, but this ensures immediate feedback
      setTimeout(() => {
        fetchInitialMessages();
      }, 100);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      logger.error('Error sending guest message', { error: err, eventId });
      setError(errorMessage);
      throw err; // Re-throw to allow UI error handling
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
    refetch: fetchInitialMessages,
  };
}
