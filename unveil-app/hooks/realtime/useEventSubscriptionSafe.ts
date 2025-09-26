import { useCallback } from 'react';
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

  // If provider is available, set up the subscription
  // This would be the normal subscription logic, but for now we'll keep it simple
  return {
    isConnected: false,
    subscribe: () => {
      if (process.env.NODE_ENV === 'development') {
        logger.realtime('Safe realtime subscription requested but not implemented yet');
      }
    },
    unsubscribe: () => {},
    reconnect: () => {},
    getStats: () => ({ totalPools: 0, totalSubscriptions: 0 }),
    getPerformanceMetrics: () => ({
      healthScore: 100,
      activeSubscriptions: 0,
      connectionState: 'disconnected' as const,
      errorCount: 0,
    }),
  };
}
