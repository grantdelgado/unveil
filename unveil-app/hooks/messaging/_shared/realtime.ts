/**
 * Shared Realtime Utilities
 * 
 * Centralized realtime subscription management for messaging hooks.
 * Integrates with SubscriptionProvider and ensures StrictMode safety.
 */

import type { RealtimeOptions } from '../_core/types';
import { useSubscriptionManager } from '@/lib/realtime/SubscriptionProvider';
import { useCallback, useEffect, useRef, useMemo } from 'react';
import { logger } from '@/lib/logger';

// Realtime configuration defaults
export const REALTIME_DEFAULTS = {
  debounceMs: 300,
  maxRetries: 3,
  connectionTimeout: 15000,
  maxBackoffDelay: 30000,
  timeoutMs: 30000,
} as const;

/**
 * Generate stable channel key for messaging subscriptions
 */
export function createChannelKey(
  domain: 'messages' | 'message-deliveries' | 'scheduled-messages',
  eventId: string,
  filters?: {
    userId?: string;
    messageId?: string;
    table?: string;
    event?: string;
  }
): string {
  const parts = [domain, eventId];
  
  if (filters?.userId) {
    parts.push(`user-${filters.userId}`);
  }
  
  if (filters?.messageId) {
    parts.push(`msg-${filters.messageId}`);
  }
  
  if (filters?.table) {
    parts.push(filters.table);
  }
  
  if (filters?.event) {
    parts.push(filters.event);
  }
  
  return parts.join(':');
}

/**
 * Debounce function for realtime updates
 */
function debounce<T extends any[]>(
  func: (...args: T) => void,
  delay: number
): (...args: T) => void {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: T) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * Hook for managing messaging realtime subscriptions
 * Provides a consistent interface across all core messaging hooks
 */
export function useMessagingRealtime(
  channelKey: string,
  subscriptionConfig: {
    table: string;
    event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
    schema?: string;
    filter?: string;
  },
  options: RealtimeOptions = {}
) {
  const { manager, isReady } = useSubscriptionManager();
  const {
    onInsert,
    onUpdate,
    onDelete,
    debounceMs = REALTIME_DEFAULTS.debounceMs,
    enabled = true,
  } = options;
  
  // StrictMode-safe refs
  const subscriptionRef = useRef<(() => void) | null>(null);
  const isCleanedUpRef = useRef(false);
  const setupPromiseRef = useRef<Promise<void> | null>(null);
  
  // Debounced callback handlers
  const debouncedOnInsert = useMemo(
    () => onInsert ? debounce(onInsert, debounceMs) : undefined,
    [onInsert, debounceMs]
  );
  
  const debouncedOnUpdate = useMemo(
    () => onUpdate ? debounce(onUpdate, debounceMs) : undefined,
    [onUpdate, debounceMs]
  );
  
  const debouncedOnDelete = useMemo(
    () => onDelete ? debounce(onDelete, debounceMs) : undefined,
    [onDelete, debounceMs]
  );
  
  // Main callback handler
  const handleRealtimeEvent = useCallback((payload: any) => {
    if (isCleanedUpRef.current) return;
    
    try {
      switch (payload.eventType) {
        case 'INSERT':
          debouncedOnInsert?.(payload);
          break;
        case 'UPDATE':
          debouncedOnUpdate?.(payload);
          break;
        case 'DELETE':
          debouncedOnDelete?.(payload);
          break;
      }
    } catch (error) {
      logger.error('Realtime callback error', {
        error,
        channelKey,
        eventType: payload.eventType,
        table: subscriptionConfig.table,
      });
    }
  }, [debouncedOnInsert, debouncedOnUpdate, debouncedOnDelete, channelKey, subscriptionConfig.table]);
  
  // Error handler
  const handleRealtimeError = useCallback((error: any) => {
    if (isCleanedUpRef.current) return;
    
    logger.error('Realtime subscription error', {
      error,
      channelKey,
      table: subscriptionConfig.table,
      filter: subscriptionConfig.filter,
    });
  }, [channelKey, subscriptionConfig.table, subscriptionConfig.filter]);
  
  // Setup subscription
  const setupSubscription = useCallback(async () => {
    // Prevent concurrent setup attempts
    if (setupPromiseRef.current) {
      return setupPromiseRef.current;
    }
    
    const setupPromise = (async () => {
      try {
        if (!manager || !isReady || !enabled || isCleanedUpRef.current) {
          return;
        }
        
        // Clean up existing subscription
        if (subscriptionRef.current) {
          subscriptionRef.current();
          subscriptionRef.current = null;
        }
        
        logger.realtime('Setting up messaging subscription', {
          channelKey,
          table: subscriptionConfig.table,
          event: subscriptionConfig.event,
          filter: subscriptionConfig.filter,
        });
        
        // Create new subscription
        const unsubscribe = manager.subscribe(channelKey, {
          table: subscriptionConfig.table,
          event: subscriptionConfig.event,
          schema: subscriptionConfig.schema || 'public',
          filter: subscriptionConfig.filter,
          callback: handleRealtimeEvent,
          onError: handleRealtimeError,
          enableBackoff: true,
          maxBackoffDelay: REALTIME_DEFAULTS.maxBackoffDelay,
          connectionTimeout: REALTIME_DEFAULTS.connectionTimeout,
          maxRetries: REALTIME_DEFAULTS.maxRetries,
          timeoutMs: REALTIME_DEFAULTS.timeoutMs,
          retryOnTimeout: true,
        });
        
        subscriptionRef.current = unsubscribe;
        
        logger.realtime('Messaging subscription established', {
          channelKey,
          table: subscriptionConfig.table,
        });
        
      } catch (error) {
        logger.error('Failed to setup messaging subscription', {
          error,
          channelKey,
          table: subscriptionConfig.table,
        });
      }
    })();
    
    setupPromiseRef.current = setupPromise;
    await setupPromise;
    setupPromiseRef.current = null;
  }, [
    manager,
    isReady,
    enabled,
    channelKey,
    subscriptionConfig,
    handleRealtimeEvent,
    handleRealtimeError,
  ]);
  
  // Cleanup subscription
  const cleanupSubscription = useCallback(() => {
    if (subscriptionRef.current) {
      try {
        subscriptionRef.current();
        logger.realtime('Messaging subscription cleaned up', { channelKey });
      } catch (error) {
        // Ignore cleanup errors in StrictMode
      }
      subscriptionRef.current = null;
    }
  }, [channelKey]);
  
  // Setup effect
  useEffect(() => {
    if (enabled) {
      setupSubscription();
    }
    
    return () => {
      isCleanedUpRef.current = true;
      cleanupSubscription();
    };
  }, [enabled, setupSubscription, cleanupSubscription]);
  
  // Manual subscription control
  const subscribe = useCallback(() => {
    if (!enabled) return;
    setupSubscription();
  }, [enabled, setupSubscription]);
  
  const unsubscribe = useCallback(() => {
    cleanupSubscription();
  }, [cleanupSubscription]);
  
  return {
    isConnected: isReady && manager !== null && subscriptionRef.current !== null,
    subscribe,
    unsubscribe,
  };
}

/**
 * Create realtime subscription configurations for common messaging patterns
 */
export const realtimeConfigs = {
  // All messages for an event (broadcast delivery path)
  messagesForEvent: (eventId: string) => ({
    channelKey: createChannelKey('messages', eventId, { table: 'messages', event: 'INSERT' }),
    subscriptionConfig: {
      table: 'messages',
      event: 'INSERT' as const,
      schema: 'public',
      filter: `event_id=eq.${eventId}`,
    },
  }),
  
  // Message deliveries for a specific user (targeted delivery path)
  deliveriesForUser: (eventId: string, userId: string) => ({
    channelKey: createChannelKey('message-deliveries', eventId, { userId, table: 'message_deliveries', event: 'INSERT' }),
    subscriptionConfig: {
      table: 'message_deliveries',
      event: 'INSERT' as const,
      schema: 'public',
      filter: `user_id=eq.${userId}`,
    },
  }),
  
  // Messages sent by a specific user (sent message feedback)
  messagesSentByUser: (eventId: string, userId: string) => ({
    channelKey: createChannelKey('messages', eventId, { userId, table: 'messages', event: 'INSERT' }),
    subscriptionConfig: {
      table: 'messages',
      event: 'INSERT' as const,
      schema: 'public',
      filter: `sender_user_id=eq.${userId}`,
    },
  }),
  
  // Scheduled messages for an event
  scheduledMessagesForEvent: (eventId: string) => ({
    channelKey: createChannelKey('scheduled-messages', eventId, { table: 'scheduled_messages', event: '*' }),
    subscriptionConfig: {
      table: 'scheduled_messages',
      event: '*' as const,
      schema: 'public',
      filter: `event_id=eq.${eventId}`,
    },
  }),
  
  // Message delivery updates (for analytics)
  deliveryUpdates: (eventId: string, messageId: string) => ({
    channelKey: createChannelKey('message-deliveries', eventId, { messageId, table: 'message_deliveries', event: '*' }),
    subscriptionConfig: {
      table: 'message_deliveries',
      event: '*' as const,
      schema: 'public',
      filter: `message_id=eq.${messageId}`,
    },
  }),
} as const;

/**
 * Development utility: Log realtime subscription activity
 */
export function logRealtimeActivity(
  operation: 'setup' | 'event' | 'cleanup' | 'error',
  details: {
    channelKey: string;
    table?: string;
    eventType?: string;
    payload?: any;
    error?: any;
    timing?: number;
  }
) {
  if (process.env.NODE_ENV === 'development') {
    const logData = {
      operation,
      channelKey: details.channelKey,
      table: details.table,
      eventType: details.eventType,
      hasPayload: !!details.payload,
      timing: details.timing ? `${details.timing}ms` : undefined,
      error: details.error ? details.error.message : undefined,
    };
    
    const logFn = operation === 'error' ? logger.error : logger.realtime;
    logFn(`[Realtime] ${operation}:`, logData);
  }
}
