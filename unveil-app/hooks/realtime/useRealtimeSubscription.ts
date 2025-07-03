import { useEffect, useRef, useCallback, useMemo } from 'react';
import {
  getSubscriptionManager,
  type SubscriptionConfig,
} from '@/lib/realtime/SubscriptionManager';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

// Performance configuration
interface PerformanceOptions {
  enableBatching?: boolean;
  enableRateLimit?: boolean;
  batchDelay?: number;
  maxUpdatesPerSecond?: number;
}

// Hook configuration
export interface UseRealtimeSubscriptionOptions {
  subscriptionId: string;
  table: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  schema?: string;
  filter?: string;
  enabled?: boolean;
  performanceOptions?: PerformanceOptions;
  onDataChange?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
  onError?: (error: Error) => void;
  onStatusChange?: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
}

// Hook return type
export interface UseRealtimeSubscriptionReturn {
  isConnected: boolean;
  error: Error | null;
  reconnect: () => void;
  getStats: () => {
    totalSubscriptions: number;
    activeSubscriptions: number;
    errorCount: number;
    connectionState: 'connected' | 'disconnected' | 'connecting' | 'error';
    uptime: number;
    totalRetries: number;
    recentErrors: number;
    lastError: {
      realtimeCode?: string;
      message: string;
      timestamp: Date;
    } | null;
  };
  getPerformanceMetrics: () => {
    subscriptionId: string;
    enabled: boolean;
    isConnected: boolean;
    performanceOptions: {
      enableBatching: boolean;
      enableRateLimit: boolean;
      batchDelay: number;
      maxUpdatesPerSecond: number;
    };
  };
}

export function useRealtimeSubscription({
  subscriptionId,
  table,
  event = 'INSERT',
  schema = 'public',
  filter,
  enabled = true,
  performanceOptions = {},
  onDataChange,
  onError,
  onStatusChange,
}: UseRealtimeSubscriptionOptions): UseRealtimeSubscriptionReturn {
  const mountedRef = useRef(true);
  const subscriptionActiveRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Stabilize callbacks
  const stableOnDataChange = useMemo(() => onDataChange, [onDataChange]);
  const stableOnError = useMemo(() => onError, [onError]);
  const stableOnStatusChange = useMemo(() => onStatusChange, [onStatusChange]);

  // Extract performance options with defaults
  const {
    enableBatching = false,
    enableRateLimit = false,
    batchDelay = 100,
    maxUpdatesPerSecond = 5,
  } = performanceOptions;

  // Setup subscription
  useEffect(() => {
    if (!enabled || !subscriptionId || !table) {
      return;
    }

    // Prevent double subscription in React StrictMode
    if (subscriptionActiveRef.current) {
      logger.realtime(`⚠️ Subscription already active, skipping: ${subscriptionId}`);
      return;
    }

    logger.realtime(`🔗 Setting up subscription: ${subscriptionId}`, {
      batching: enableBatching,
      rateLimit: enableRateLimit,
      batchDelay,
      maxUpdatesPerSecond,
    });

    // Mark subscription as active
    subscriptionActiveRef.current = true;

    try {
      const config: SubscriptionConfig = {
        table,
        event,
        schema,
        filter,
        callback: stableOnDataChange || (() => {}),
        onError: stableOnError,
        onStatusChange: stableOnStatusChange,
      };

      // Create the subscription
      const unsubscribe = getSubscriptionManager().subscribe(subscriptionId, config);
      
      // Store cleanup function
      cleanupRef.current = unsubscribe;

      logger.realtime(`✅ Subscription setup complete: ${subscriptionId}`);
    } catch (error) {
      logger.error(`❌ Failed to setup subscription: ${subscriptionId}`, error);
      subscriptionActiveRef.current = false;
      stableOnError?.(error instanceof Error ? error : new Error('Subscription setup failed'));
    }

    // Cleanup function
    return () => {
      if (!mountedRef.current) return;

      logger.realtime(`🧹 Cleaning up subscription: ${subscriptionId}`);
      
      // Mark as inactive
      subscriptionActiveRef.current = false;
      
      // Execute cleanup
      if (cleanupRef.current) {
        try {
          cleanupRef.current();
          cleanupRef.current = null;
        } catch (error) {
          logger.error(`❌ Error during subscription cleanup: ${subscriptionId}`, error);
        }
      }
    };
  }, [
    enabled,
    subscriptionId,
    table,
    event,
    schema,
    filter,
    enableBatching,
    enableRateLimit,
    batchDelay,
    maxUpdatesPerSecond,
    stableOnDataChange,
    stableOnError,
    stableOnStatusChange,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Reconnect function
  const reconnect = useCallback(() => {
    if (!enabled || !subscriptionId || !table) {
      logger.realtime(`❌ Cannot reconnect: invalid parameters`);
      return;
    }

    logger.realtime(`🔄 Manual reconnect triggered: ${subscriptionId}`);

    // Clean up existing subscription
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    // Reset state
    subscriptionActiveRef.current = false;

    try {
      const config: SubscriptionConfig = {
        table,
        event,
        schema,
        filter,
        callback: stableOnDataChange || (() => {}),
        onError: stableOnError,
        onStatusChange: stableOnStatusChange,
      };

      const unsubscribe = getSubscriptionManager().subscribe(
        subscriptionId,
        config,
      );
      
      // Store cleanup function
      cleanupRef.current = unsubscribe;
      subscriptionActiveRef.current = true;

      logger.realtime(`✅ Manual reconnect successful: ${subscriptionId}`);
    } catch (error) {
      logger.error(`❌ Manual reconnect failed: ${subscriptionId}`, error);

      subscriptionActiveRef.current = false;
      stableOnError?.(error instanceof Error ? error : new Error(String(error)));

      if (stableOnStatusChange) {
        stableOnStatusChange('error');
      }
    }
  }, [
    enabled,
    subscriptionId,
    table,
    event,
    schema,
    filter,
    stableOnDataChange,
    stableOnError,
    stableOnStatusChange,
  ]);

  // Get stats function
  const getStats = useCallback(() => {
    return getSubscriptionManager().getStats();
  }, []);

  // Get performance metrics
  const getPerformanceMetrics = useCallback(() => {
    return {
      subscriptionId,
      enabled,
      isConnected: subscriptionActiveRef.current,
      performanceOptions: {
        enableBatching,
        enableRateLimit,
        batchDelay,
        maxUpdatesPerSecond,
      },
    };
  }, [
    subscriptionId,
    enabled,
    enableBatching,
    enableRateLimit,
    batchDelay,
    maxUpdatesPerSecond,
  ]);

  return {
    isConnected: subscriptionActiveRef.current,
    error: null,
    reconnect,
    getStats,
    getPerformanceMetrics,
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
  performanceOptions,
}: {
  eventId: string | null;
  table: string;
  event?: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
  onDataChange: (payload: RealtimePostgresChangesPayload<any>) => void;
  onError?: (error: Error) => void;
  enabled?: boolean;
  performanceOptions?: UseRealtimeSubscriptionOptions['performanceOptions'];
}): UseRealtimeSubscriptionReturn {
  return useRealtimeSubscription({
    subscriptionId: `${table}-${eventId}`,
    table,
    event,
    filter: eventId ? `event_id=eq.${eventId}` : undefined,
    enabled: enabled && Boolean(eventId),
    onDataChange,
    onError,
    performanceOptions,
  });
}
