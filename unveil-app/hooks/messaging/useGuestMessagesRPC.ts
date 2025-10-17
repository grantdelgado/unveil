import { useState, useEffect, useCallback, useRef, useReducer } from 'react';
import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useSubscriptionManager } from '@/lib/realtime/SubscriptionProvider';
import { type GuestMessage } from '@/lib/utils/messageUtils';
import { RealtimeFlags, RealtimeTunables } from '@/lib/config/realtime';
import { normalizeRealtimeError, type RTErrorContext } from '@/lib/realtime/error-normalize';
import { shouldLog } from '@/lib/realtime/log-sampler';

// Configuration constants
const INITIAL_WINDOW_SIZE = 30;
const OLDER_MESSAGES_BATCH_SIZE = 20;

// State management types for atomic message operations
interface MessageState {
  messages: GuestMessage[];
  messageIds: Set<string>;
  compoundCursor: { created_at: string; id: string } | null;
  oldestMessageCursor: string | null;
  hasMore: boolean;
}

type MessageAction = 
  | { type: 'RESET_FOR_EVENT' }
  | { type: 'SET_INITIAL_MESSAGES'; payload: { messages: GuestMessage[]; hasMore: boolean } }
  | { type: 'ADD_PAGINATED_MESSAGES'; payload: { messages: GuestMessage[]; hasMore: boolean } }
  | { type: 'ADD_REALTIME_MESSAGE'; payload: GuestMessage }
  | { type: 'MERGE_MESSAGES'; payload: GuestMessage[] };

// Atomic message state reducer (eliminates race conditions)
function messageStateReducer(state: MessageState, action: MessageAction): MessageState {
  switch (action.type) {
    case 'RESET_FOR_EVENT':
      return {
        messages: [],
        messageIds: new Set<string>(),
        compoundCursor: null,
        oldestMessageCursor: null,
        hasMore: false,
      };
      
    case 'SET_INITIAL_MESSAGES': {
      const { messages, hasMore } = action.payload;
      const messageIds = new Set(messages.map(m => m.message_id));
      
      // Determine if we should trim messages (when hasMore is true, we got +1 message)
      const shouldTrim = hasMore && messages.length > INITIAL_WINDOW_SIZE;
      const messagesToKeep = shouldTrim ? messages.slice(0, INITIAL_WINDOW_SIZE) : messages;
      
      const sortedMessages = [...messagesToKeep].sort((a, b) => {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        if (timeB !== timeA) return timeB - timeA;
        return a.message_id > b.message_id ? -1 : 1;
      });
      
      const oldestMessage = sortedMessages[sortedMessages.length - 1];
      
      // Use logger instead of console.log for consistent logging
      if (process.env.NODE_ENV === 'development') {
        logger.info('🔍 SET_INITIAL_MESSAGES reducer', {
          originalCount: messages.length,
          trimmed: shouldTrim,
          finalCount: sortedMessages.length,
          hasOldestMessage: !!oldestMessage,
          hasMore,
        });
      }
      
      return {
        messages: sortedMessages,
        messageIds: new Set(sortedMessages.map(m => m.message_id)), // Use trimmed messages for IDs
        compoundCursor: oldestMessage ? {
          created_at: oldestMessage.created_at,
          id: oldestMessage.message_id,
        } : null,
        oldestMessageCursor: oldestMessage?.created_at || null,
        hasMore,
      };
    }
    
    case 'ADD_PAGINATED_MESSAGES': {
      const { messages: newMessages, hasMore } = action.payload;
      const combined = [...state.messages];
      const updatedIds = new Set(state.messageIds);
      
      // Add new messages with deduplication
      for (const msg of newMessages) {
        if (!updatedIds.has(msg.message_id)) {
          updatedIds.add(msg.message_id);
          combined.push(msg);
        }
      }
      
      // Sort combined list
      combined.sort((a, b) => {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        if (timeB !== timeA) return timeB - timeA;
        return a.message_id > b.message_id ? -1 : 1;
      });
      
      const oldestMessage = combined[combined.length - 1];
      
      return {
        messages: combined,
        messageIds: updatedIds,
        compoundCursor: oldestMessage ? {
          created_at: oldestMessage.created_at,
          id: oldestMessage.message_id,
        } : null,
        oldestMessageCursor: oldestMessage?.created_at || null,
        hasMore,
      };
    }
    
    case 'ADD_REALTIME_MESSAGE':
    case 'MERGE_MESSAGES': {
      const newMessages = action.type === 'ADD_REALTIME_MESSAGE' ? [action.payload] : action.payload;
      const combined = [...state.messages];
      const updatedIds = new Set(state.messageIds);
      
      // Add new messages with deduplication
      for (const msg of newMessages) {
        if (!updatedIds.has(msg.message_id)) {
          updatedIds.add(msg.message_id);
          combined.push(msg);
        }
      }
      
      // Sort combined list
      combined.sort((a, b) => {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        if (timeB !== timeA) return timeB - timeA;
        return a.message_id > b.message_id ? -1 : 1;
      });
      
      return {
        ...state,
        messages: combined,
        messageIds: updatedIds,
      };
    }
    
    default:
      return state;
  }
}

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
  // Atomic state management using reducer (eliminates race conditions)
  const [messageState, dispatch] = useReducer(messageStateReducer, {
    messages: [],
    messageIds: new Set<string>(),
    compoundCursor: null,
    oldestMessageCursor: null,
    hasMore: false,
  });

  // Separate loading/error state (not part of message state)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFetchingOlder, setIsFetchingOlder] = useState(false);

  // Extract values for backward compatibility
  const { messages, messageIds, compoundCursor, oldestMessageCursor, hasMore } = messageState;

  // Debug logging for state changes (development only, throttled)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      logger.info('🔍 messageState changed', {
        messageCount: messages.length,
        hasCompoundCursor: !!compoundCursor,
        hasMore,
        messageIdsSize: messageIds.size,
      });
    }
  }, [messages.length, hasMore]); // Reduced dependencies to prevent excessive logging

  // Enhanced de-duplication with Map keyed by eventId:userId:version
  const fetchInProgressMap = useRef<Map<string, boolean>>(new Map());
  const { user } = useAuth();
  const { version, manager } = useSubscriptionManager();

  /**
   * Clear pagination state when event changes
   */
  useEffect(() => {
    dispatch({ type: 'RESET_FOR_EVENT' });
  }, [eventId]);

  // Remove old merge function - now handled by reducer

  /**
   * Fetch initial window of recent messages using RPC (with compound cursor)
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

      logger.info('Fetching initial guest messages with compound cursor support', {
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

      // CANONICAL RPC: Always use get_guest_event_messages (NOT v2/v3 directly)
      const startedAt = performance.now();
      const { data, error: rpcError } = await supabase.rpc(
        'get_guest_event_messages',
        {
          p_event_id: eventId,
          p_limit: INITIAL_WINDOW_SIZE + 1,
          p_before: undefined,
          p_cursor_created_at: undefined,
          p_cursor_id: undefined,
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

      // PII-safe telemetry for v3 initial fetch with duration
      logger.info('[TELEMETRY] messaging.rpc_v3_rows', {
        event: eventId?.slice(0, 8),
        count: messagesArray.length,
        hasMore: hasMoreMessages,
        duration_ms: Math.round(performance.now() - startedAt),
        cursor: 'initial',
      });

      // Map RPC response to GuestMessage type (let reducer handle trimming)
      const adaptedMessages = messagesArray.map(mapRpcMessageToGuestMessage);
      
      // Use atomic reducer for thread-safe state management
      if (process.env.NODE_ENV === 'development') {
        logger.info('🔍 About to dispatch SET_INITIAL_MESSAGES', {
          rawCount: messagesArray.length,
          adaptedCount: adaptedMessages.length,
          hasMore: hasMoreMessages,
          windowSize: INITIAL_WINDOW_SIZE,
          hasMessages: adaptedMessages.length > 0,
        });
      }
      
      dispatch({ 
        type: 'SET_INITIAL_MESSAGES', 
        payload: { messages: adaptedMessages, hasMore: hasMoreMessages } 
      });
      
      logger.info('Initial messages loaded with atomic state management', {
        eventId,
        count: adaptedMessages.length,
        hasMore: hasMoreMessages,
        firstMessage: adaptedMessages[0]?.created_at,
        lastMessage: adaptedMessages[adaptedMessages.length - 1]?.created_at,
      });

      // Log V2 read model metrics
      const sourceBreakdown = {
        delivery: adaptedMessages.filter(
          (m) => m.delivery_status === 'delivered',
        ).length,
        message: adaptedMessages.filter((m) => m.message_type !== 'announcement')
          .length,
        catchup: adaptedMessages.filter((m) => m.message_type === 'announcement')
          .length,
        announcement: adaptedMessages.filter(
          (m) => m.message_type === 'announcement',
        ).length,
        channel: adaptedMessages.filter((m) => m.message_type === 'channel')
          .length,
        direct: adaptedMessages.filter((m) => m.message_type === 'direct')
          .length,
      };

      logger.info('Successfully fetched guest messages with atomic state', {
        eventId,
        count: adaptedMessages.length,
        hasMore: hasMoreMessages,
        firstMessageCreatedAt: adaptedMessages[0]?.created_at,
        lastMessageCreatedAt: adaptedMessages[adaptedMessages.length - 1]?.created_at,
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

  // Keep the latest cursor in a ref to avoid stale closures
  const latestCursorRef = useRef(messageState.compoundCursor);
  useEffect(() => {
    latestCursorRef.current = messageState.compoundCursor;
  }, [messageState.compoundCursor]);

  /**
   * Fetch older messages for pagination using compound cursor
   */
  const fetchOlderMessages = useCallback(async () => {
    // Always read the latest cursor from ref to avoid stale closures
    const currentCursor = latestCursorRef.current;
    
    // Debug logging for pagination issues (dev only)
    if (process.env.NODE_ENV === 'development') {
      logger.info('🔍 fetchOlderMessages called', {
        hasCompoundCursor: !!currentCursor,
        before_created_at: currentCursor?.created_at,
        before_id: currentCursor?.id,
        isFetchingOlder,
        eventId,
      });
    }
    
    if (!currentCursor || isFetchingOlder) {
      if (process.env.NODE_ENV === 'development') {
        logger.warn('🔍 fetchOlderMessages early return', {
          reason: !currentCursor ? 'no_compound_cursor' : 'already_fetching',
          compoundCursor: currentCursor,
          isFetchingOlder,
        });
      }
      return;
    }

    // Enhanced de-duplication for pagination with compound cursor
    const userId = user?.id;
    if (!userId) {
      logger.warn('No user ID available for pagination de-duplication');
      return;
    }

    const paginationKey = `${eventId}:${userId}:${version}:${currentCursor.created_at}:${currentCursor.id}`;

    // Prevent duplicate pagination fetches
    if (fetchInProgressMap.current.has(paginationKey)) {
      logger.info('Skipping duplicate pagination fetch', { paginationKey });
      return;
    }

    try {
      fetchInProgressMap.current.set(paginationKey, true);
      setIsFetchingOlder(true);
      setError(null);

      logger.info('Fetching older guest messages with compound cursor', {
        eventId,
        beforeCreatedAt: currentCursor.created_at,
        beforeId: currentCursor.id,
        paginationKey,
      });

      // CANONICAL RPC: Use compound cursor parameters for stable pagination
      const startedAt = performance.now();
      const { data, error: rpcError } = await supabase.rpc(
        'get_guest_event_messages',
        {
          p_event_id: eventId,
          p_limit: OLDER_MESSAGES_BATCH_SIZE + 1,
          p_before: undefined, // Legacy param, use compound cursor instead
          p_cursor_created_at: currentCursor.created_at,
          p_cursor_id: currentCursor.id,
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

      // PII-safe telemetry for v3 pagination with duration
      logger.info('[TELEMETRY] messaging.rpc_v3_rows', {
        event: eventId?.slice(0, 8),
        count: messagesArray.length,
        hasMore: hasMoreOlderMessages,
        duration_ms: Math.round(performance.now() - startedAt),
        cursor: 'compound',
      });

      if (messagesToPrepend.length > 0) {
        // Map RPC response to GuestMessage type with safe type adapter
        const adaptedMessages = messagesToPrepend.map(mapRpcMessageToGuestMessage);

        // Use atomic reducer for pagination updates
        dispatch({ 
          type: 'ADD_PAGINATED_MESSAGES', 
          payload: { messages: adaptedMessages, hasMore: hasMoreOlderMessages } 
        });
      } else {
        // No new messages, just update hasMore status
        dispatch({ 
          type: 'ADD_PAGINATED_MESSAGES', 
          payload: { messages: [], hasMore: hasMoreOlderMessages } 
        });
      }

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
      fetchInProgressMap.current.delete(paginationKey);
    }
  }, [eventId, user?.id, version]); // intentionally NOT depending on messageState to avoid churn

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

          // Use atomic reducer for realtime message updates
          dispatch({ type: 'ADD_REALTIME_MESSAGE', payload: newMessage });

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

                // Use atomic reducer for fast-path realtime updates
                dispatch({ type: 'ADD_REALTIME_MESSAGE', payload: fastMessage });

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
