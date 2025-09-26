import { useCallback, useRef, useEffect, useState } from 'react';
import { useSubscriptionManagerSafe } from '@/lib/realtime/SubscriptionProvider';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

interface UseEventSubscriptionSafeOptions {
  eventId: string | null;
  table: string;
  event?: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
  filter?: string;
  onDataChange: (payload: RealtimePostgresChangesPayload<any>) => void;
  onError?: (error: Error) => void;
  enabled?: boolean;
}

/**
 * Safe version of useEventSubscription that works without SubscriptionProvider
 * Falls back to no-op when realtime is not available
 * 
 * This allows hooks to work on routes without messaging providers
 */
export function useEventSubscriptionSafe({
  eventId,
  table,
  event = '*',
  filter,
  onDataChange,
  onError,
  enabled = true,
}: UseEventSubscriptionSafeOptions) {
  const subscriptionManager = useSubscriptionManagerSafe();
  
  // Safe callbacks that handle missing provider
  const safeOnDataChange = useCallback((payload: RealtimePostgresChangesPayload<any>) => {
    try {
      onDataChange(payload);
    } catch (error) {
      logger.error('Error in realtime data change callback', error);
      onError?.(error instanceof Error ? error : new Error('Callback error'));
    }
  }, [onDataChange, onError]);

  const safeOnError = useCallback((error: Error) => {
    logger.warn('Realtime subscription error (safe mode)', error);
    onError?.(error);
  }, [onError]);

  // If no subscription manager, return disabled state
  if (!subscriptionManager || !subscriptionManager.isReady) {
    if (process.env.NODE_ENV === 'development' && enabled && eventId) {
      logger.realtime(`🔕 Realtime disabled for ${table} (no SubscriptionProvider)`, {
        eventId,
        table,
        hasManager: !!subscriptionManager,
        isReady: subscriptionManager?.isReady || false
      });
    }
    
    return {
      isConnected: false,
      subscribe: () => {},
      unsubscribe: () => {},
      reconnect: () => {},
      getStats: () => ({ totalPools: 0, totalSubscriptions: 0 }),
      getPerformanceMetrics: () => ({
        healthScore: 100, // No connections, no issues
        activeSubscriptions: 0,
        connectionState: 'disconnected' as const,
        errorCount: 0,
      }),
    };
  }

  // If provider is available, set up the actual subscription
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const [isConnectedState, setIsConnectedState] = useState(false);

  const subscribe = useCallback(() => {
    if (!enabled || !eventId || !subscriptionManager.manager) {
      return;
    }

    // Clean up existing subscription
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    try {
      const subscriptionId = `safe-${eventId}-${table}-${event}`;
      
      unsubscribeRef.current = subscriptionManager.manager.subscribe(subscriptionId, {
        table,
        event,
        schema: 'public',
        filter,
        callback: safeOnDataChange,
        onError: safeOnError,
        onStatusChange: (status) => {
          setIsConnectedState(status === 'connected');
        },
        timeoutMs: 30000,
        retryOnTimeout: true,
        enableBackoff: true,
        maxRetries: 3,
      });

      logger.realtime(`✅ Safe realtime subscription created: ${subscriptionId}`);
    } catch (error) {
      logger.error('Failed to create safe realtime subscription', error);
      safeOnError(error instanceof Error ? error : new Error(String(error)));
    }
  }, [enabled, eventId, table, event, filter, subscriptionManager.manager, safeOnDataChange, safeOnError]);

  const unsubscribe = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
      setIsConnectedState(false);
    }
  }, []);

  const reconnect = useCallback(() => {
    unsubscribe();
    subscribe();
  }, [subscribe, unsubscribe]);

  // Auto-subscribe when manager becomes ready
  useEffect(() => {
    if (subscriptionManager.isReady && enabled && eventId) {
      subscribe();
    }

    return () => {
      unsubscribe();
    };
  }, [subscriptionManager.isReady, enabled, eventId, subscribe, unsubscribe]);

  return {
    isConnected: isConnectedState,
    subscribe,
    unsubscribe,
    reconnect,
    getStats: () => subscriptionManager.manager?.getStats() || { totalPools: 0, totalSubscriptions: 0 },
    getPerformanceMetrics: () => {
      const stats = subscriptionManager.manager?.getStats();
      return {
        healthScore: stats?.healthScore || 100,
        activeSubscriptions: stats?.activeSubscriptions || 0,
        connectionState: isConnectedState ? 'connected' as const : 'disconnected' as const,
        errorCount: stats?.errorCount || 0,
      };
    },
  };
}
