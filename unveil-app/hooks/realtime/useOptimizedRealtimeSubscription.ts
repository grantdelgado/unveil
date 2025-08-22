import { useEffect, useMemo, useRef } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useSubscriptionManager } from '@/lib/realtime/SubscriptionProvider';
import { logger } from '@/lib/logger';

interface OptimizedRealtimeSubscriptionOptions {
  subscriptionId: string;
  table: string;
  eventId: string;
  enabled?: boolean;
  onDataChange?: (
    payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
  ) => void;
  onError?: (error: Error) => void;
}

interface OptimizedRealtimeSubscriptionReturn {
  isConnected: boolean;
  reconnect: () => void;
}

/**
 * Optimized real-time subscription hook with minimal dependencies
 * Simplified from the complex useRealtimeSubscription for better performance
 */
export function useOptimizedRealtimeSubscription({
  subscriptionId,
  table,
  eventId,
  enabled = true,
  onDataChange,
  onError,
}: OptimizedRealtimeSubscriptionOptions): OptimizedRealtimeSubscriptionReturn {
  const { manager, isReady } = useSubscriptionManager();
  const mountedRef = useRef(true);
  const subscriptionActiveRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Stable callback references to prevent unnecessary re-subscriptions
  const stableOnDataChange = useRef(onDataChange);
  const stableOnError = useRef(onError);

  // Update refs when callbacks change
  stableOnDataChange.current = onDataChange;
  stableOnError.current = onError;

  // Stable subscription configuration
  const subscriptionConfig = useMemo(
    () => ({
      table,
      event: '*' as const, // Listen to all events for simplicity
      schema: 'public' as const,
      filter: `event_id=eq.${eventId}`,
    }),
    [table, eventId],
  );

  // Setup subscription with minimal dependencies
  useEffect(() => {
    if (!enabled || !subscriptionId || !table || !eventId) {
      return;
    }

    // Prevent double subscription
    if (subscriptionActiveRef.current) {
      logger.realtime(
        `⚠️ Subscription already active, skipping: ${subscriptionId}`,
      );
      return;
    }

    logger.realtime(`🔗 Setting up optimized subscription: ${subscriptionId}`, {
      table,
      eventId,
    });

    subscriptionActiveRef.current = true;

    try {
      if (!isReady || !manager) {
        logger.warn('⚠️ SubscriptionManager not ready, skipping subscription', {
          isReady,
          hasManager: !!manager,
        });
        return;
      }

      const unsubscribe = manager.subscribe(subscriptionId, {
        ...subscriptionConfig,
        callback: (
          payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
        ) => {
          if (mountedRef.current && stableOnDataChange.current) {
            stableOnDataChange.current(payload);
          }
        },
        onError: (error: Error) => {
          if (mountedRef.current && stableOnError.current) {
            stableOnError.current(error);
          }
        },
      });

      cleanupRef.current = unsubscribe;
      logger.realtime(
        `✅ Optimized subscription setup complete: ${subscriptionId}`,
      );
    } catch (error) {
      logger.error(`❌ Failed to setup subscription: ${subscriptionId}`, error);
      subscriptionActiveRef.current = false;
      if (stableOnError.current) {
        stableOnError.current(
          error instanceof Error
            ? error
            : new Error('Subscription setup failed'),
        );
      }
    }

    // Cleanup function
    return () => {
      if (!mountedRef.current) return;

      logger.realtime(
        `🧹 Cleaning up optimized subscription: ${subscriptionId}`,
      );

      subscriptionActiveRef.current = false;

      if (cleanupRef.current) {
        try {
          cleanupRef.current();
          cleanupRef.current = null;
        } catch (error) {
          logger.error(
            `❌ Error during subscription cleanup: ${subscriptionId}`,
            error,
          );
        }
      }
    };
  }, [enabled, subscriptionId, table, eventId, manager, isReady]); // Essential dependencies only

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Simplified reconnect function
  const reconnect = () => {
    if (cleanupRef.current) {
      cleanupRef.current();
      subscriptionActiveRef.current = false;
    }
    // Force re-subscription by toggling enabled state would happen in the calling component
  };

  return {
    isConnected: subscriptionActiveRef.current,
    reconnect,
  };
}
