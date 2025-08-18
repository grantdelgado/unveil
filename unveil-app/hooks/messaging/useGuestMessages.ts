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
   * Fetch initial window of recent messages (recipient-scoped)
   */
  const fetchInitialMessages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get current user to filter delivery records
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Authentication required');
      }

      // Fetch both delivered messages and guest's own replies
      // 1. Get messages delivered to this guest via delivery records
      const { data: deliveryData, error: deliveryError } = await supabase
        .from('message_deliveries')
        .select(`
          *,
          message:messages!message_deliveries_message_id_fkey (
            *,
            sender:users!messages_sender_user_id_fkey(*)
          ),
          scheduled_message:scheduled_messages (
            id,
            content,
            message_type,
            created_at,
            sender_user_id,
            event_id,
            sender:users!scheduled_messages_sender_user_id_fkey(*)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(INITIAL_WINDOW_SIZE + 1);

      if (deliveryError) throw deliveryError;

      // 2. Get guest's own messages (replies) that don't have delivery records
      const { data: ownMessages, error: ownMessagesError } = await supabase
        .from('messages')
        .select(`
          *,
          sender:users!messages_sender_user_id_fkey(*)
        `)
        .eq('sender_user_id', user.id)
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .limit(INITIAL_WINDOW_SIZE + 1);

      if (ownMessagesError) throw ownMessagesError;

      // Filter deliveries to only include this event
      const eventDeliveries = (deliveryData || []).filter(delivery => {
        if (delivery.message?.event_id === eventId) return true;
        if (delivery.scheduled_message?.event_id === eventId) return true;
        return false;
      });

      // Extract messages from delivery records
      const deliveredMessages = eventDeliveries.map(delivery => {
        if (delivery.message) {
          return delivery.message;
        } else if (delivery.scheduled_message) {
          // Convert scheduled_message to message format for consistency
          return {
            id: delivery.scheduled_message.id,
            content: delivery.scheduled_message.content,
            message_type: delivery.scheduled_message.message_type,
            created_at: delivery.scheduled_message.created_at,
            sender_user_id: delivery.scheduled_message.sender_user_id,
            event_id: delivery.scheduled_message.event_id,
            sender: delivery.scheduled_message.sender
          };
        }
        return null;
      }).filter(Boolean);

      // Combine delivered messages and own messages, remove duplicates
      const allMessages = [...deliveredMessages, ...(ownMessages || [])];
      const uniqueMessages = allMessages.reduce((acc, message) => {
        if (message && !acc.find(m => m.id === message.id)) {
          acc.push(message);
        }
        return acc;
      }, [] as any[]);

      // Sort by creation time (newest first) and apply pagination
      uniqueMessages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      const hasMoreMessages = uniqueMessages.length > INITIAL_WINDOW_SIZE;
      const extractedMessages = hasMoreMessages 
        ? uniqueMessages.slice(0, INITIAL_WINDOW_SIZE)
        : uniqueMessages;
      
      // Reverse to show chronological order (oldest first)
      const sortedMessages = extractedMessages.reverse();
      
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
   * Fetch older messages for pagination (recipient-scoped)
   */
  const fetchOlderMessages = useCallback(async () => {
    if (!oldestMessageCursor || isFetchingOlder) return;
    
    try {
      setIsFetchingOlder(true);
      setError(null);
      
      // Get current user to filter delivery records
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Authentication required');
      }
      
      const [createdAt, messageId] = oldestMessageCursor.split(':');
      
      // Fetch both delivered messages and guest's own replies for older messages
      // 1. Get older delivered messages
      const { data: deliveryData, error: deliveryError } = await supabase
        .from('message_deliveries')
        .select(`
          *,
          message:messages!message_deliveries_message_id_fkey (
            *,
            sender:users!messages_sender_user_id_fkey(*)
          ),
          scheduled_message:scheduled_messages (
            id,
            content,
            message_type,
            created_at,
            sender_user_id,
            event_id,
            sender:users!scheduled_messages_sender_user_id_fkey(*)
          )
        `)
        .eq('user_id', user.id)
        .lt('created_at', createdAt)
        .order('created_at', { ascending: false })
        .limit(OLDER_MESSAGES_BATCH_SIZE + 1);

      if (deliveryError) throw deliveryError;

      // 2. Get older own messages (replies)
      const { data: ownMessages, error: ownMessagesError } = await supabase
        .from('messages')
        .select(`
          *,
          sender:users!messages_sender_user_id_fkey(*)
        `)
        .eq('sender_user_id', user.id)
        .eq('event_id', eventId)
        .lt('created_at', createdAt)
        .order('created_at', { ascending: false })
        .limit(OLDER_MESSAGES_BATCH_SIZE + 1);

      if (ownMessagesError) throw ownMessagesError;

      // Filter deliveries to only include this event
      const eventDeliveries = (deliveryData || []).filter(delivery => {
        if (delivery.message?.event_id === eventId) return true;
        if (delivery.scheduled_message?.event_id === eventId) return true;
        return false;
      });

      // Extract messages from delivery records
      const deliveredMessages = eventDeliveries.map(delivery => {
        if (delivery.message) {
          return delivery.message;
        } else if (delivery.scheduled_message) {
          // Convert scheduled_message to message format for consistency
          return {
            id: delivery.scheduled_message.id,
            content: delivery.scheduled_message.content,
            message_type: delivery.scheduled_message.message_type,
            created_at: delivery.scheduled_message.created_at,
            sender_user_id: delivery.scheduled_message.sender_user_id,
            event_id: delivery.scheduled_message.event_id,
            sender: delivery.scheduled_message.sender
          };
        }
        return null;
      }).filter(Boolean);

      // Combine and deduplicate messages
      const allMessages = [...deliveredMessages, ...(ownMessages || [])];
      const uniqueMessages = allMessages.reduce((acc, message) => {
        if (message && !acc.find(m => m.id === message.id)) {
          acc.push(message);
        }
        return acc;
      }, [] as any[]);

      // Sort by creation time (newest first) and apply pagination
      uniqueMessages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      const hasMoreOlderMessages = uniqueMessages.length > OLDER_MESSAGES_BATCH_SIZE;
      const messagesToPrepend = hasMoreOlderMessages 
        ? uniqueMessages.slice(0, OLDER_MESSAGES_BATCH_SIZE)
        : uniqueMessages;
      
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

    let subscription: any = null;
    let isCleanedUp = false;

    const setupRealtimeSubscription = async () => {
      try {
        // Get current user to filter delivery records
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user || isCleanedUp) {
          return;
        }

        // Set up dual real-time subscriptions: delivery records + own messages
        const channelKey = `guest_messages:${user.id}:${eventId}`;
        
        subscription = supabase
          .channel(channelKey, {
            config: {
              broadcast: { self: false, ack: false },
              presence: { key: channelKey }
            }
          })
          // Listen for delivery records (messages sent to this guest)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'message_deliveries',
              filter: `user_id=eq.${user.id}`,
            },
            async (payload) => {
              if (isCleanedUp) return;
              
              // When a delivery record is created/updated, fetch the associated message
              if (payload.eventType === 'INSERT' && payload.new) {
                const deliveryRecord = payload.new as any;
                
                // Check if this delivery is for the current event
                let isForCurrentEvent = false;
                let messageData = null;

                if (deliveryRecord.message_id) {
                  // Fetch direct message with sender details
                  const { data, error: messageError } = await supabase
                    .from('messages')
                    .select(`
                      *,
                      sender:users!messages_sender_user_id_fkey(*)
                    `)
                    .eq('id', deliveryRecord.message_id)
                    .single();

                  if (!messageError && data && data.event_id === eventId) {
                    messageData = data;
                    isForCurrentEvent = true;
                  }
                } else if (deliveryRecord.scheduled_message_id) {
                  // Fetch scheduled message with sender details
                  const { data, error: scheduledError } = await supabase
                    .from('scheduled_messages')
                    .select(`
                      id,
                      content,
                      message_type,
                      created_at,
                      sender_user_id,
                      event_id,
                      sender:users!scheduled_messages_sender_user_id_fkey(*)
                    `)
                    .eq('id', deliveryRecord.scheduled_message_id)
                    .single();

                  if (!scheduledError && data && data.event_id === eventId) {
                    // Convert scheduled_message to message format for consistency
                    messageData = {
                      id: data.id,
                      content: data.content,
                      message_type: data.message_type,
                      created_at: data.created_at,
                      sender_user_id: data.sender_user_id,
                      event_id: data.event_id,
                      sender: data.sender
                    };
                    isForCurrentEvent = true;
                  }
                }

                if (isForCurrentEvent && messageData && !isCleanedUp) {
                  handleRealtimeUpdate({
                    ...payload,
                    new: messageData,
                    eventType: 'INSERT'
                  });
                }
              }
            }
          )
          // Listen for guest's own messages (replies)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'messages',
              filter: `sender_user_id=eq.${user.id}`,
            },
            async (payload) => {
              if (isCleanedUp) return;
              
              // When guest sends a message, add it to the feed if it's for this event
              if (payload.eventType === 'INSERT' && payload.new) {
                const messageRecord = payload.new as any;
                
                if (messageRecord.event_id === eventId && !isCleanedUp) {
                  // Fetch full message with sender details
                  const { data, error: messageError } = await supabase
                    .from('messages')
                    .select(`
                      *,
                      sender:users!messages_sender_user_id_fkey(*)
                    `)
                    .eq('id', messageRecord.id)
                    .single();

                  if (!messageError && data && !isCleanedUp) {
                    handleRealtimeUpdate({
                      ...payload,
                      new: data,
                      eventType: 'INSERT'
                    });
                  }
                }
              }
            }
          )
          .subscribe();

      } catch (error) {
        if (!isCleanedUp) {
          console.error('Guest messages subscription error:', error);
        }
      }
    };

    setupRealtimeSubscription();

    return () => {
      isCleanedUp = true;
      if (subscription) {
        try {
          subscription.unsubscribe();
        } catch (error) {
          // Ignore cleanup errors in development
        }
        subscription = null;
      }
    };
  }, [eventId, handleRealtimeUpdate]); // Include handleRealtimeUpdate dependency

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