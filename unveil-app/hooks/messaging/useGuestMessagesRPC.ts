import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useSubscriptionManager } from '@/lib/realtime/SubscriptionProvider';
import { mergeMessages, type GuestMessage } from '@/lib/utils/messageUtils';
import { RealtimeFlags, RealtimeTunables } from '@/lib/config/realtime';
import { normalizeRealtimeError, type RTErrorContext } from '@/lib/realtime/error-normalize';
import { shouldLog } from '@/lib/realtime/log-sampler';

// Configuration constants
const INITIAL_WINDOW_SIZE = 30;
const OLDER_MESSAGES_BATCH_SIZE = 20;

/**
 * Log realtime error with normalization and sampling for guest messaging
 */
function logGuestMessagingError(
  error: unknown,
  subscriptionType: string,
  eventId: string,
  additionalContext?: Record<string, unknown>
): void {
  const ctx: RTErrorContext = {
    phase: 'message',
    channelKey: `${subscriptionType}:${eventId}`,
  };

  if (!RealtimeFlags.quietConnectionErrors) {
    // Original behavior - always log as error
    logger.error(`Guest ${subscriptionType} subscription error`, { error, eventId, ...additionalContext });
    return;
  }

  // New behavior - normalize and sample
  const normalized = normalizeRealtimeError(error, ctx, { 
    max: RealtimeTunables.maxRawErrorLength 
  });

  const okToLog = shouldLog(
    normalized.key,
    Date.now(),
    RealtimeTunables.logSampleWindowMs,
    RealtimeTunables.logMaxPerWindow
  );

  if (okToLog) {
    const logFn = normalized.ignorable ? logger.warn : logger.error;
    const prefix = normalized.ignorable ? '⚠️' : '❌';
    
    logFn(`${prefix} Guest ${subscriptionType} ${normalized.summary}`, {
      kind: normalized.kind,
      ctx: normalized.ctx,
      raw: normalized.raw,
      eventId,
      ...additionalContext,
    });
  }
}

/**
 * Type adapter to safely map RPC response to GuestMessage
 * Handles type mismatches between database RPC and UI types
 */
function mapRpcMessageToGuestMessage(rpcMessage: any): GuestMessage {
  // Safely map source field with fallback
  let source: 'delivery' | 'message' | undefined;
  if (rpcMessage.source === 'delivery' || rpcMessage.source === 'message') {
    source = rpcMessage.source;
  } else if (rpcMessage.source) {
    // Log unknown source types for debugging (no PII)
    logger.debug('Unknown message source type encountered', {
      sourceType: typeof rpcMessage.source,
      hasSource: !!rpcMessage.source,
    });
    source = undefined; // Use undefined for unknown types
  }

  return {
    message_id: rpcMessage.message_id,
    content: rpcMessage.content,
    created_at: rpcMessage.created_at,
    delivery_status: rpcMessage.delivery_status,
    sender_name: rpcMessage.sender_name,
    sender_avatar_url: rpcMessage.sender_avatar_url,
    message_type: rpcMessage.message_type,
    is_own_message: rpcMessage.is_own_message,
    source,
    is_catchup: rpcMessage.is_catchup,
    channel_tags: rpcMessage.channel_tags,
  };
}

// Message type from RPC response (now imported from utils)
// interface GuestMessage moved to lib/utils/messageUtils.ts

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
  const [oldestMessageCursor, setOldestMessageCursor] = useState<string | null>(
    null,
  );

  // Enhanced de-duplication with Map keyed by eventId:userId:version
  const fetchInProgressMap = useRef<Map<string, boolean>>(new Map());
  const { user } = useAuth();
  const { version, manager } = useSubscriptionManager();

  /**
   * Fetch initial window of recent messages using RPC (with deduplication)
   */
  const fetchInitialMessages = useCallback(async () => {
    // Enhanced de-duplication with eventId:userId:version key
    const userId = user?.id;
    if (!userId) {
      logger.warn('No user ID available for fetch de-duplication');
      return;
    }

    const fetchKey = `${eventId}:${userId}:${version}:first`;

    // Prevent duplicate fetches for the same key
    if (fetchInProgressMap.current.get(fetchKey)) {
      logger.info('Skipping duplicate initial fetch', { fetchKey });
      return;
    }

    try {
      fetchInProgressMap.current.set(fetchKey, true);
      setLoading(true);
      setError(null);

      logger.info('Fetching initial guest messages via V2', {
        eventId,
        userId,
        version,
        fetchKey,
      });

      // Get current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Authentication required');
      }

      // Guest verification is handled by the RPC function

      // Use RPC function to get all messages (announcements + deliveries + own messages)
      // This ensures new guests see historical announcements
      logger.info('Fetching guest messages via RPC v2', {
        eventId,
        windowSize: INITIAL_WINDOW_SIZE,
      });

      const { data, error: rpcError } = await supabase.rpc(
        'get_guest_event_messages_v2',
        {
          p_event_id: eventId,
          p_limit: INITIAL_WINDOW_SIZE + 1,
          p_before: undefined,
        },
      );

      if (rpcError) {
        // Log the full error for debugging (no PII)
        logger.error('RPC error details', {
          code: rpcError.code,
          message: rpcError.message,
          details: rpcError.details,
          hint: rpcError.hint,
        });

        // Handle specific error cases with user-friendly messages
        if (
          rpcError.message?.includes('User has been removed from this event')
        ) {
          throw new Error('You are no longer a guest of this event');
        } else if (
          rpcError.message?.includes('User is not a guest of this event')
        ) {
          throw new Error('Access denied: You are not a guest of this event');
        } else if (
          rpcError.message?.includes('structure of query does not match') ||
          rpcError.code === 'PGRST116'
        ) {
          // Handle RPC schema mismatch errors gracefully
          logger.error('RPC schema mismatch detected', {
            eventId,
            userId,
            errorCode: rpcError.code,
          });
          throw new Error('Unable to load messages — Please try refreshing the page');
        } else {
          throw new Error(`Failed to fetch messages: ${rpcError.message}`);
        }
      }

      const messagesArray = Array.isArray(data) ? data : [];
      const hasMoreMessages = messagesArray.length > INITIAL_WINDOW_SIZE;
      const messagesToShow = hasMoreMessages
        ? messagesArray.slice(0, INITIAL_WINDOW_SIZE)
        : messagesArray;

      // Map RPC response to GuestMessage type with safe type adapter
      const adaptedMessages = messagesToShow.map(mapRpcMessageToGuestMessage);
      
      // Deduplicate messages by message_id (in case RPC returns duplicates from multiple UNION branches)
      const deduplicatedMessages = adaptedMessages.filter((message, index, array) => 
        array.findIndex(m => m.message_id === message.message_id) === index
      );
      
      // V2: Trust RPC stable ordering (created_at DESC, id DESC) - reverse to oldest first for UI
      const sortedMessages = deduplicatedMessages.reverse();
      
      logger.info('Using stable RPC ordering (v2)', {
        eventId,
        count: deduplicatedMessages.length,
        firstMessage: deduplicatedMessages[0]?.created_at,
        lastMessage: deduplicatedMessages[deduplicatedMessages.length - 1]?.created_at,
      });

      setMessages(sortedMessages);
      setHasMore(hasMoreMessages);

      // Set cursor for fetching older messages
      if (sortedMessages.length > 0) {
        const oldestMessage = sortedMessages[0];
        setOldestMessageCursor(oldestMessage.created_at);
      }

      // Log V2 read model metrics
      const sourceBreakdown = {
        delivery: sortedMessages.filter(
          (m) => m.delivery_status === 'delivered',
        ).length,
        message: sortedMessages.filter((m) => m.message_type !== 'announcement')
          .length,
        catchup: sortedMessages.filter((m) => m.message_type === 'announcement')
          .length,
        announcement: sortedMessages.filter(
          (m) => m.message_type === 'announcement',
        ).length,
        channel: sortedMessages.filter((m) => m.message_type === 'channel')
          .length,
        direct: sortedMessages.filter((m) => m.message_type === 'direct')
          .length,
      };

      logger.info('Successfully fetched guest messages', {
        eventId,
        count: sortedMessages.length,
        hasMore: hasMoreMessages,
        firstMessageCreatedAt: sortedMessages[0]?.created_at,
        lastMessageCreatedAt: sortedMessages[sortedMessages.length - 1]?.created_at,
        sourceBreakdown,
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch messages';
      logger.error('Error fetching initial guest messages', {
        error: err,
        eventId,
      });
      setError(errorMessage);
    } finally {
      setLoading(false);
      // Clean up the specific fetch key
      const userId = user?.id;
      if (userId) {
        const fetchKey = `${eventId}:${userId}:${version}:first`;
        fetchInProgressMap.current.delete(fetchKey);
      }
    }
  }, [eventId, user?.id, version]);

  // Clear fetch map on sign-out (when user becomes null)
  useEffect(() => {
    if (!user) {
      logger.info('Clearing fetch de-duplication map on sign-out');
      fetchInProgressMap.current.clear();
    }
  }, [user]);

  // Clear fetch map on eventId change
  useEffect(() => {
    return () => {
      // Clean up fetch keys for this specific eventId when eventId changes
      const userId = user?.id;
      if (userId && eventId) {
        const keysToRemove: string[] = [];
        fetchInProgressMap.current.forEach((_, key) => {
          if (key.startsWith(`${eventId}:${userId}:`)) {
            keysToRemove.push(key);
          }
        });
        keysToRemove.forEach((key) => {
          fetchInProgressMap.current.delete(key);
        });
        if (keysToRemove.length > 0) {
          logger.info('Cleared de-dup keys for eventId change', {
            eventId,
            userId,
            clearedKeys: keysToRemove.length,
          });
        }
      }
    };
  }, [eventId, user?.id]);

  // Clear fetch map on component unmount
  useEffect(() => {
    return () => {
      logger.info('Clearing all fetch de-duplication keys on unmount');
      fetchInProgressMap.current.clear();
    };
  }, []);

  /**
   * Fetch older messages for pagination using RPC
   */
  const fetchOlderMessages = useCallback(async () => {
    if (!oldestMessageCursor || isFetchingOlder) return;

    // Enhanced de-duplication for pagination with cursor
    const userId = user?.id;
    if (!userId) {
      logger.warn('No user ID available for pagination de-duplication');
      return;
    }

    const paginationKey = `${eventId}:${userId}:${version}:${oldestMessageCursor}`;

    // Prevent duplicate pagination fetches
    if (fetchInProgressMap.current.get(paginationKey)) {
      logger.info('Skipping duplicate pagination fetch', { paginationKey });
      return;
    }

    try {
      fetchInProgressMap.current.set(paginationKey, true);
      setIsFetchingOlder(true);
      setError(null);

      logger.info('Fetching older guest messages via RPC v2', {
        eventId,
        before: oldestMessageCursor,
        paginationKey,
      });

      const { data, error: rpcError } = await supabase.rpc(
        'get_guest_event_messages_v2',
        {
          p_event_id: eventId,
          p_limit: OLDER_MESSAGES_BATCH_SIZE + 1,
          p_before: oldestMessageCursor,
        },
      );

      if (rpcError) {
        // Handle specific error cases with user-friendly messages
        if (
          rpcError.message?.includes('User has been removed from this event')
        ) {
          throw new Error('You are no longer a guest of this event');
        } else if (
          rpcError.message?.includes('User is not a guest of this event')
        ) {
          throw new Error('Access denied: You are not a guest of this event');
        } else {
          throw new Error(
            `Failed to fetch older messages: ${rpcError.message}`,
          );
        }
      }

      const messagesArray = Array.isArray(data) ? data : [];
      const hasMoreOlderMessages =
        messagesArray.length > OLDER_MESSAGES_BATCH_SIZE;
      const messagesToPrepend = hasMoreOlderMessages
        ? messagesArray.slice(0, OLDER_MESSAGES_BATCH_SIZE)
        : messagesArray;

      if (messagesToPrepend.length > 0) {
        // Map RPC response to GuestMessage type with safe type adapter
        const adaptedMessages = messagesToPrepend.map(mapRpcMessageToGuestMessage);
        
        // Reverse to chronological order and prepend to existing messages
        const sortedOlderMessages = adaptedMessages.reverse();

        // Use merge function with stable ordering (always true for v2)
        setMessages((prevMessages) => 
          mergeMessages(prevMessages, sortedOlderMessages, true)
        );

        // Update cursor for next batch
        const newOldestMessage = sortedOlderMessages[0];
        setOldestMessageCursor(newOldestMessage.created_at);
      }

      setHasMore(hasMoreOlderMessages);

      logger.info('Successfully fetched older guest messages', {
        eventId,
        count: messagesToPrepend.length,
        hasMore: hasMoreOlderMessages,
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch older messages';
      logger.error('Error fetching older guest messages', {
        error: err,
        eventId,
      });
      setError(errorMessage);
    } finally {
      setIsFetchingOlder(false);
      // Clean up the specific pagination key
      const userId = user?.id;
      if (userId && oldestMessageCursor) {
        const paginationKey = `${eventId}:${userId}:${version}:${oldestMessageCursor}`;
        fetchInProgressMap.current.delete(paginationKey);
      }
    }
  }, [eventId, oldestMessageCursor, isFetchingOlder]);

  /**
   * Handle real-time message delivery updates (backup path for targeted messages)
   */
  const handleRealtimeUpdate = useCallback(
    async (payload: any) => {
      if (payload.eventType === 'INSERT') {
        // 🔍 DIAGNOSTIC: Start timing measurement for delivery path
        const startTime = performance.now();
        console.time('guest-message-delivery-receive');

        try {
          logger.info('🔄 Delivery-path: Message delivery received', {
            eventId,
            deliveryId: (payload.new as any)?.id,
            messageId: (payload.new as any)?.message_id,
          });

          // Get the new message data by fetching just the latest messages
          // This is more efficient than a full refetch and preserves pagination state
          const {
            data: { user },
            error: userError,
          } = await supabase.auth.getUser();
          if (userError || !user) return;

          // Fetch recent deliveries to get the new message in proper format
          // Note: Removed .eq('user_id', user.id) filter to let RLS handle access control
          const { data: deliveries, error: deliveryError } = await supabase
            .from('message_deliveries')
            .select(
              `
            sms_status,
            message:messages!message_deliveries_message_id_fkey (
              id,
              content,
              created_at,
              message_type,
              event_id,
              sender_user_id,
              sender:users!messages_sender_user_id_fkey(full_name, avatar_url)
            )
          `,
            )
            .eq('id', (payload.new as any)?.id) // Only fetch this specific delivery
            .single();

          if (deliveryError || !deliveries) return;

          // Check if this is for our event
          if (deliveries.message?.event_id !== eventId) return;

          const newMessage = {
            message_id: deliveries.message!.id,
            content: deliveries.message!.content,
            created_at:
              deliveries.message!.created_at || new Date().toISOString(),
            delivery_status: deliveries.sms_status || 'delivered',
            sender_name: deliveries.message!.sender?.full_name || 'Host',
            sender_avatar_url: deliveries.message!.sender?.avatar_url || '',
            message_type: deliveries.message!.message_type || 'direct',
            is_own_message: deliveries.message!.sender_user_id === user.id,
          };

          // 🔍 DIAGNOSTIC: Measure merge timing
          const mergeStartTime = performance.now();

          // Use intelligent merge (may be duplicate if fast-path already handled it)
          setMessages((prevMessages) =>
            mergeMessages(prevMessages, [newMessage], true),
          );

          const mergeEndTime = performance.now();
          const totalTime = mergeEndTime - startTime;

          // 🔍 DIAGNOSTIC: Log detailed timing
          console.timeEnd('guest-message-delivery-receive');
          logger.info('🔄 Delivery-path message merged', {
            eventId,
            messageId: newMessage.message_id,
            timing: {
              totalLatency: `${totalTime.toFixed(1)}ms`,
              mergeTime: `${(mergeEndTime - mergeStartTime).toFixed(1)}ms`,
              dbCreatedAt: newMessage.created_at,
              clientReceiveTime: new Date().toISOString(),
            },
          });
        } catch (error) {
          // Fallback to full refetch on error
          logger.warn(
            'Real-time delivery merge failed, falling back to refetch',
            { error, eventId },
          );
          fetchInitialMessages();
        }
      }
      // For UPDATE/DELETE events, we could implement more granular updates,
      // but for MVP, intelligent INSERT handling is the main improvement
    },
    [eventId, fetchInitialMessages],
  );

  // Fetch initial messages
  useEffect(() => {
    if (!eventId) return;
    fetchInitialMessages();
  }, [fetchInitialMessages]);

  // Set up managed realtime subscription for new messages
  useEffect(() => {
    if (!eventId) return;

    let deliveryUnsubscribe: (() => void) | null = null;
    let messagesUnsubscribe: (() => void) | null = null;
    let messagesEventUnsubscribe: (() => void) | null = null;
    let isCleanedUp = false;

    const setupManagedRealtimeSubscription = async () => {
      try {
        // Get current user for filtering
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError || !user || isCleanedUp) {
          return;
        }

        // Use the subscription manager from the hook
        if (!manager) {
          logger.warn('Subscription manager not available, skipping realtime setup');
          return;
        }
        const subscriptionManager = manager;

        // 🚀 PRIMARY SUBSCRIPTION: All messages for this event (instant broadcast delivery)
        messagesEventUnsubscribe = subscriptionManager.subscribe(
          `guest-messages-event-${eventId}`,
          {
            table: 'messages',
            event: 'INSERT',
            schema: 'public',
            filter: `event_id=eq.${eventId}`,
            callback: async (payload: any) => {
              if (!isCleanedUp && payload.new) {
                // 🔍 DIAGNOSTIC: Message created timestamp
                const messageCreatedAt = (payload.new as any).created_at;
                const messageId = (payload.new as any).id;

                logger.info(
                  '🚀 Fast-path: New message received via messages INSERT',
                  {
                    eventId,
                    messageId,
                    createdAt: messageCreatedAt,
                    latencyFromCreation: `${Date.now() - new Date(messageCreatedAt).getTime()}ms`,
                  },
                );

                // Fast-path: Create message object directly from payload
                const fastMessage: GuestMessage = {
                  message_id: messageId,
                  content: (payload.new as any).content,
                  created_at: messageCreatedAt,
                  delivery_status: 'delivered', // Assume delivered for broadcast
                  sender_name: 'Host', // Will be updated if we get sender info
                  sender_avatar_url: null,
                  message_type: (payload.new as any).message_type || 'direct',
                  is_own_message:
                    (payload.new as any).sender_user_id === user.id,
                };

                // Merge immediately for instant rendering
                setMessages((prevMessages) =>
                  mergeMessages(prevMessages, [fastMessage], true),
                );

                logger.info('✅ Fast-path message rendered', {
                  messageId,
                  eventId,
                });
              }
            },
            onError: (error: any) => {
              if (!isCleanedUp) {
                logGuestMessagingError(error, 'messages event', eventId);
              }
            },
            enableBackoff: true,
            maxBackoffDelay: 30000,
            connectionTimeout: 15000,
            maxRetries: 3,
            timeoutMs: 30000,
            retryOnTimeout: true,
          },
        );

        // 🔄 BACKUP SUBSCRIPTION: Message deliveries for targeted messages
        deliveryUnsubscribe = subscriptionManager.subscribe(
          `guest-message-deliveries-${user.id}-${eventId}`,
          {
            table: 'message_deliveries',
            event: 'INSERT',
            schema: 'public',
            filter: `user_id=eq.${user.id}`,
            callback: handleRealtimeUpdate,
            onError: (error: any) => {
              if (!isCleanedUp) {
                logGuestMessagingError(error, 'message deliveries', eventId);
              }
            },
            enableBackoff: true,
            maxBackoffDelay: 30000,
            connectionTimeout: 15000,
            maxRetries: 3,
            timeoutMs: 30000,
            retryOnTimeout: true,
          },
        );

        // Subscribe to messages from this user (for sent message feedback)
        messagesUnsubscribe = subscriptionManager.subscribe(
          `guest-messages-sent-${user.id}-${eventId}`,
          {
            table: 'messages',
            event: 'INSERT',
            schema: 'public',
            filter: `sender_user_id=eq.${user.id}`,
            callback: (payload: any) => {
              // Only trigger update if the message is for this event
              if (
                payload.new &&
                (payload.new as any).event_id === eventId &&
                !isCleanedUp
              ) {
                handleRealtimeUpdate(payload);
              }
            },
            onError: (error: any) => {
              if (!isCleanedUp) {
                logGuestMessagingError(error, 'sent messages', eventId);
              }
            },
            enableBackoff: true,
            maxBackoffDelay: 30000,
            connectionTimeout: 15000,
            maxRetries: 3,
            timeoutMs: 30000,
            retryOnTimeout: true,
          },
        );

        logger.info(
          'Guest messages managed realtime subscriptions established',
          { eventId, userId: user.id },
        );
      } catch (error) {
        if (!isCleanedUp) {
          logger.error('Guest messages subscription setup error', {
            error,
            eventId,
          });
        }
      }
    };

    setupManagedRealtimeSubscription();

    return () => {
      isCleanedUp = true;

      if (messagesEventUnsubscribe) {
        try {
          messagesEventUnsubscribe();
          logger.info('Guest messages event subscription cleaned up', {
            eventId,
          });
        } catch (error) {
          // Ignore cleanup errors
        }
        messagesEventUnsubscribe = null;
      }

      if (deliveryUnsubscribe) {
        try {
          deliveryUnsubscribe();
          logger.info('Guest message deliveries subscription cleaned up', {
            eventId,
          });
        } catch (error) {
          // Ignore cleanup errors
        }
        deliveryUnsubscribe = null;
      }

      if (messagesUnsubscribe) {
        try {
          messagesUnsubscribe();
          logger.info('Guest sent messages subscription cleaned up', {
            eventId,
          });
        } catch (error) {
          // Ignore cleanup errors
        }
        messagesUnsubscribe = null;
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

      logger.info('Sending guest message', {
        eventId,
        contentLength: content.length,
      });

      const { error: sendError } = await supabase.from('messages').insert({
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
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to send message';
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
