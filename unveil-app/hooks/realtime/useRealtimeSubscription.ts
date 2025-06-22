import { useEffect, useRef, useCallback } from 'react';
import {
  getSubscriptionManager,
  type SubscriptionConfig,
} from '@/lib/realtime/SubscriptionManager';
import { logger } from '@/lib/logger';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export interface UseRealtimeSubscriptionOptions {
  /**
   * Unique identifier for this subscription
   */
  subscriptionId: string;

  /**
   * Table to subscribe to
   */
  table: string;

  /**
   * Event types to listen for
   */
  event?: '*' | 'INSERT' | 'UPDATE' | 'DELETE';

  /**
   * Optional filter for the subscription
   */
  filter?: string;

  /**
   * Schema name (defaults to 'public')
   */
  schema?: string;

  /**
   * Whether the subscription should be active
   * Set to false to temporarily disable
   */
  enabled?: boolean;

  /**
   * Callback for when data changes
   */
  onDataChange: (payload: RealtimePostgresChangesPayload<any>) => void;

  /**
   * Optional callback for subscription errors
   */
  onError?: (error: Error) => void;

  /**
   * Optional callback for subscription status changes
   */
  onStatusChange?: (
    status: 'connecting' | 'connected' | 'disconnected' | 'error',
  ) => void;
}

export interface UseRealtimeSubscriptionReturn {
  /**
   * Whether the subscription is currently active
   */
  isConnected: boolean;

  /**
   * Current error state
   */
  error: Error | null;

  /**
   * Manually reconnect the subscription
   */
  reconnect: () => void;

  /**
   * Get subscription statistics
   */
  getStats: () => {
    totalSubscriptions: number;
    activeSubscriptions: number;
    errorCount: number;
    connectionState: 'connected' | 'disconnected' | 'connecting' | 'error';
    uptime: number;
  };
}

/**
 * React hook for managing real-time subscriptions with automatic cleanup
 *
 * @example
 * ```typescript
 * const { isConnected, error, reconnect } = useRealtimeSubscription({
 *   subscriptionId: `messages-${eventId}`,
 *   table: 'messages',
 *   event: '*',
 *   filter: `event_id=eq.${eventId}`,
 *   onDataChange: (payload) => {
 *     if (payload.eventType === 'INSERT') {
 *       // Handle new message
 *     }
 *   },
 *   onError: (error) => {
 *     console.error('Subscription error:', error)
 *   }
 * })
 * ```
 */
export function useRealtimeSubscription({
  subscriptionId,
  table,
  event = '*',
  filter,
  schema = 'public',
  enabled = true,
  onDataChange,
  onError,
  onStatusChange,
}: UseRealtimeSubscriptionOptions): UseRealtimeSubscriptionReturn {
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isConnectedRef = useRef(false);
  const errorRef = useRef<Error | null>(null);
  const subscriptionManager = getSubscriptionManager();

  // Stable callback references
  const stableOnDataChange = useCallback(
    (payload: RealtimePostgresChangesPayload<any>) => {
      try {
        onDataChange(payload);
      } catch (error) {
        logger.error(
          `❌ Error in onDataChange callback for ${subscriptionId}`,
          error,
        );
        if (onError) {
          onError(error instanceof Error ? error : new Error(String(error)));
        }
      }
    },
    [subscriptionId, onDataChange, onError],
  );

  // Setup subscription
  useEffect(() => {
    if (!enabled || !subscriptionId || !table) {
      return;
    }

    // Prevent React StrictMode subscription race conditions in development
    const isDev = process.env.NODE_ENV === 'development';
    const delay = isDev ? 50 : 0;

    logger.realtime(`🔗 Setting up subscription: ${subscriptionId}`);

    // Setup timeout for subscription creation
    const setupTimeoutId = setTimeout(() => {
      try {
        const config: SubscriptionConfig = {
          table,
          event,
          schema,
          filter,
          callback: stableOnDataChange,
        };

        // Create the subscription
        const unsubscribe = subscriptionManager.subscribe(subscriptionId, config);
        unsubscribeRef.current = unsubscribe;

        // Update connection state
        isConnectedRef.current = true;
        errorRef.current = null;

        if (onStatusChange) {
          onStatusChange('connecting');
          // Simulate connection success after a brief delay
          setTimeout(() => onStatusChange('connected'), 100);
        }

        logger.realtime(`✅ Subscription setup complete: ${subscriptionId}`);
      } catch (error) {
        logger.error(`❌ Failed to setup subscription: ${subscriptionId}`, error);

        isConnectedRef.current = false;
        errorRef.current =
          error instanceof Error ? error : new Error(String(error));

        if (onError) {
          onError(errorRef.current);
        }

        if (onStatusChange) {
          onStatusChange('error');
        }
      }
    }, delay);

    // Cleanup function
    return () => {
      logger.realtime(`🧹 Cleaning up subscription: ${subscriptionId}`);

      // Clear the setup timeout to prevent memory leaks
      clearTimeout(setupTimeoutId);

      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }

      isConnectedRef.current = false;

      if (onStatusChange) {
        onStatusChange('disconnected');
      }
    };
  }, [
    subscriptionId,
    table,
    event,
    filter,
    schema,
    enabled,
    stableOnDataChange,
    onError,
    onStatusChange,
    subscriptionManager,
  ]);

  // Reconnect function
  const reconnect = useCallback(() => {
    logger.realtime(`🔄 Manual reconnect requested: ${subscriptionId}`);

    // Clean up existing subscription
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    if (onStatusChange) {
      onStatusChange('connecting');
    }

    // Recreate subscription after a brief delay
    setTimeout(() => {
      if (!enabled) return;

      try {
        const config: SubscriptionConfig = {
          table,
          event,
          schema,
          filter,
          callback: stableOnDataChange,
        };

        const unsubscribe = subscriptionManager.subscribe(
          subscriptionId,
          config,
        );
        unsubscribeRef.current = unsubscribe;

        isConnectedRef.current = true;
        errorRef.current = null;

        if (onStatusChange) {
          onStatusChange('connected');
        }

        logger.realtime(`✅ Manual reconnect successful: ${subscriptionId}`);
      } catch (error) {
        logger.error(`❌ Manual reconnect failed: ${subscriptionId}`, error);

        isConnectedRef.current = false;
        errorRef.current =
          error instanceof Error ? error : new Error(String(error));

        if (onError) {
          onError(errorRef.current);
        }

        if (onStatusChange) {
          onStatusChange('error');
        }
      }
    }, 100);
  }, [
    subscriptionId,
    table,
    event,
    filter,
    schema,
    enabled,
    stableOnDataChange,
    onError,
    onStatusChange,
    subscriptionManager,
  ]);

  // Get stats function
  const getStats = useCallback(() => {
    return subscriptionManager.getStats();
  }, [subscriptionManager]);

  return {
    isConnected: isConnectedRef.current,
    error: errorRef.current,
    reconnect,
    getStats,
  };
}

/**
 * Hook for subscribing to event-specific table changes
 * Provides a simplified interface for common event-scoped subscriptions
 */
export function useEventSubscription({
  eventId,
  table,
  event = '*',
  onDataChange,
  onError,
  enabled = true,
}: {
  eventId: string | null;
  table: string;
  event?: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
  onDataChange: (payload: RealtimePostgresChangesPayload<any>) => void;
  onError?: (error: Error) => void;
  enabled?: boolean;
}): UseRealtimeSubscriptionReturn {
  return useRealtimeSubscription({
    subscriptionId: `${table}-${eventId}`,
    table,
    event,
    filter: eventId ? `event_id=eq.${eventId}` : undefined,
    enabled: enabled && Boolean(eventId),
    onDataChange,
    onError,
  });
}
