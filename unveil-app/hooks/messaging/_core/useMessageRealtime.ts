/**
 * useMessageRealtime - Core Hook #5
 * 
 * Wraps SubscriptionProvider channels with stable keys and debounced refetch.
 * No duplicate subscriptions, StrictMode-safe, debounced refetch for list keys only.
 * Integrates with all core messaging hooks for consistent realtime updates.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth/AuthProvider';
import { qk } from '@/lib/queryKeys';
import { invalidate } from '@/lib/queryInvalidation';
import { logger } from '@/lib/logger';

import type {
  RealtimeOptions,
  UseMessageRealtimeReturn,
  DevObservabilityEvent,
} from './types';

import {
  useMessagingRealtime,
  realtimeConfigs,
  logRealtimeActivity,
} from '../_shared/realtime';

/**
 * Core Hook #5: useMessageRealtime
 * 
 * Single source of truth for messaging realtime subscriptions.
 * Coordinates with all core hooks for consistent update patterns.
 */
export function useMessageRealtime(
  eventId: string,
  options: RealtimeOptions = {}
): UseMessageRealtimeReturn {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const {
    onInsert,
    onUpdate,
    onDelete,
    debounceMs = 300,
    enabled = true,
  } = options;
  
  // StrictMode-safe refs
  const subscriptionsRef = useRef<Array<() => void>>([]);
  const lastRefreshRef = useRef<number>(0);
  
  // Dev observability - track realtime activity
  const logActivity = useCallback((event: Omit<DevObservabilityEvent, 'hook'>) => {
    if (process.env.NODE_ENV === 'development') {
      const activity: DevObservabilityEvent = {
        hook: 'useMessageRealtime',
        eventId,
        ...event,
      };
      
      logger.debug('[Core Hook] Activity:', activity);
    }
  }, [eventId]);
  
  // Debounced cache refresh for list queries
  const refreshMessageLists = useCallback(async () => {
    const now = Date.now();
    if (now - lastRefreshRef.current < debounceMs) {
      return; // Still in debounce window
    }
    
    lastRefreshRef.current = now;
    const startTime = performance.now();
    
    try {
      const inv = invalidate(queryClient);
      
      // Refresh all message-related list queries
      await Promise.all([
        inv.messages.allLists(eventId),
        inv.scheduledMessages.allLists(eventId),
        // Don't refresh delivery lists automatically - they're more expensive
      ]);
      
      const endTime = performance.now();
      
      logActivity({
        operation: 'invalidation',
        timing: {
          startTime,
          endTime,
          duration: `${(endTime - startTime).toFixed(1)}ms`,
        },
        metadata: {
          type: 'realtimeRefresh',
          debounced: true,
        },
      });
      
    } catch (error) {
      logger.error('Failed to refresh message lists from realtime', {
        error,
        eventId,
      });
    }
  }, [queryClient, eventId, debounceMs, logActivity]);
  
  // Enhanced message insert handler
  const handleMessageInsert = useCallback(async (payload: any) => {
    const startTime = performance.now();
    
    try {
      logRealtimeActivity('event', {
        channelKey: 'messages-insert',
        table: 'messages',
        eventType: 'INSERT',
        payload,
        timing: startTime,
      });
      
      // Call custom handler if provided
      onInsert?.(payload);
      
      // Always refresh list caches for new messages
      await refreshMessageLists();
      
      logActivity({
        operation: 'realtime',
        timing: {
          startTime,
          endTime: performance.now(),
          duration: `${(performance.now() - startTime).toFixed(1)}ms`,
        },
        metadata: {
          type: 'messageInsert',
          messageId: payload.new?.id?.substring(0, 8) + '...', // Truncated for privacy
        },
      });
      
    } catch (error) {
      logger.error('Error handling message insert', {
        error,
        eventId,
        messageId: payload.new?.id,
      });
    }
  }, [onInsert, refreshMessageLists, logActivity, eventId]);
  
  // Enhanced message update handler
  const handleMessageUpdate = useCallback(async (payload: any) => {
    const startTime = performance.now();
    
    try {
      logRealtimeActivity('event', {
        channelKey: 'messages-update',
        table: 'messages',
        eventType: 'UPDATE',
        timing: startTime,
      });
      
      // Call custom handler if provided
      onUpdate?.(payload);
      
      // Selective refresh based on what changed
      const messageId = payload.new?.id;
      if (messageId) {
        const inv = invalidate(queryClient);
        await Promise.all([
          inv.messages.byId(eventId, messageId),
          inv.messages.allLists(eventId), // Update lists in case display content changed
        ]);
      }
      
      logActivity({
        operation: 'realtime',
        timing: {
          startTime,
          endTime: performance.now(),
          duration: `${(performance.now() - startTime).toFixed(1)}ms`,
        },
        metadata: {
          type: 'messageUpdate',
          messageId: messageId?.substring(0, 8) + '...',
        },
      });
      
    } catch (error) {
      logger.error('Error handling message update', {
        error,
        eventId,
        messageId: payload.new?.id,
      });
    }
  }, [onUpdate, queryClient, eventId, logActivity]);
  
  // Enhanced message delete handler
  const handleMessageDelete = useCallback(async (payload: any) => {
    const startTime = performance.now();
    
    try {
      logRealtimeActivity('event', {
        channelKey: 'messages-delete',
        table: 'messages',
        eventType: 'DELETE',
        timing: startTime,
      });
      
      // Call custom handler if provided
      onDelete?.(payload);
      
      // Refresh all related caches after deletion
      const messageId = payload.old?.id;
      if (messageId) {
        const inv = invalidate(queryClient);
        await Promise.all([
          inv.messages.allLists(eventId),
          inv.messageDeliveries.allForMessage(eventId, messageId),
        ]);
      }
      
      logActivity({
        operation: 'realtime',
        timing: {
          startTime,
          endTime: performance.now(),
          duration: `${(performance.now() - startTime).toFixed(1)}ms`,
        },
        metadata: {
          type: 'messageDelete',
          messageId: messageId?.substring(0, 8) + '...',
        },
      });
      
    } catch (error) {
      logger.error('Error handling message delete', {
        error,
        eventId,
        messageId: payload.old?.id,
      });
    }
  }, [onDelete, queryClient, eventId, logActivity]);
  
  // Enhanced delivery insert handler (for targeted messages)
  const handleDeliveryInsert = useCallback(async (payload: any) => {
    const startTime = performance.now();
    
    try {
      logRealtimeActivity('event', {
        channelKey: 'deliveries-insert',
        table: 'message_deliveries',
        eventType: 'INSERT',
        timing: startTime,
      });
      
      // Refresh message lists (in case a new direct message was delivered)
      await refreshMessageLists();
      
      // Also refresh delivery stats if we have a message ID
      const messageId = payload.new?.message_id;
      if (messageId) {
        const inv = invalidate(queryClient);
        await inv.messageDeliveries.stats(eventId, messageId);
      }
      
      logActivity({
        operation: 'realtime',
        timing: {
          startTime,
          endTime: performance.now(),
          duration: `${(performance.now() - startTime).toFixed(1)}ms`,
        },
        metadata: {
          type: 'deliveryInsert',
          messageId: messageId?.substring(0, 8) + '...',
        },
      });
      
    } catch (error) {
      logger.error('Error handling delivery insert', {
        error,
        eventId,
        deliveryId: payload.new?.id,
      });
    }
  }, [refreshMessageLists, queryClient, eventId, logActivity]);
  
  // Subscription setup
  const messagesConfig = realtimeConfigs.messagesForEvent(eventId);
  const {
    isConnected: messagesConnected,
    subscribe: subscribeMessages,
    unsubscribe: unsubscribeMessages,
  } = useMessagingRealtime(
    messagesConfig.channelKey,
    messagesConfig.subscriptionConfig,
    {
      onInsert: handleMessageInsert,
      onUpdate: handleMessageUpdate,
      onDelete: handleMessageDelete,
      debounceMs,
      enabled,
    }
  );
  
  // Delivery subscription (only if user is available)
  const deliveriesConfig = user ? realtimeConfigs.deliveriesForUser(eventId, user.id) : null;
  const {
    isConnected: deliveriesConnected,
    subscribe: subscribeDeliveries,
    unsubscribe: unsubscribeDeliveries,
  } = useMessagingRealtime(
    deliveriesConfig?.channelKey || '',
    deliveriesConfig?.subscriptionConfig || { table: '', event: 'INSERT' as const, schema: 'public', filter: '' },
    {
      onInsert: handleDeliveryInsert,
      debounceMs,
      enabled: enabled && !!user,
    }
  );
  
  // Scheduled messages subscription
  const scheduledConfig = realtimeConfigs.scheduledMessagesForEvent(eventId);
  const {
    isConnected: scheduledConnected,
    subscribe: subscribeScheduled,
    unsubscribe: unsubscribeScheduled,
  } = useMessagingRealtime(
    scheduledConfig.channelKey,
    scheduledConfig.subscriptionConfig,
    {
      onInsert: refreshMessageLists, // Scheduled messages affect future message delivery
      onUpdate: refreshMessageLists,
      onDelete: refreshMessageLists,
      debounceMs,
      enabled,
    }
  );
  
  // Track connection status
  const isConnected = messagesConnected || deliveriesConnected || scheduledConnected;
  
  // Manual subscription control
  const subscribe = useCallback(() => {
    if (!enabled) return;
    
    logActivity({
      operation: 'realtime',
      metadata: { action: 'manualSubscribe' },
    });
    
    subscribeMessages();
    subscribeDeliveries();
    subscribeScheduled();
  }, [enabled, subscribeMessages, subscribeDeliveries, subscribeScheduled, logActivity]);
  
  const unsubscribe = useCallback(() => {
    logActivity({
      operation: 'realtime',
      metadata: { action: 'manualUnsubscribe' },
    });
    
    unsubscribeMessages();
    unsubscribeDeliveries();
    unsubscribeScheduled();
  }, [unsubscribeMessages, unsubscribeDeliveries, unsubscribeScheduled, logActivity]);
  
  // Log connection status changes
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      logger.realtime('Message realtime connection status:', {
        eventId,
        isConnected,
        messages: messagesConnected,
        deliveries: deliveriesConnected,
        scheduled: scheduledConnected,
        enabled,
      });
    }
  }, [eventId, isConnected, messagesConnected, deliveriesConnected, scheduledConnected, enabled]);
  
  return {
    isConnected,
    error: null, // Individual subscription errors are logged but not bubbled up
    subscribe,
    unsubscribe,
  };
}
