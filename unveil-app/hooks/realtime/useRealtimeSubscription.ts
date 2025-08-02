import { useEffect, useRef, useCallback, useMemo } from 'react';
import {
  getSubscriptionManager,
  type SubscriptionConfig,
} from '@/lib/realtime/SubscriptionManager';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

// Subscription pooling manager for efficient WebSocket usage
class SubscriptionPool {
  private static instance: SubscriptionPool;
  private pools = new Map<string, {
    subscriptionId: string;
    callbacks: Map<string, (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void>;
    refCount: number;
    config: SubscriptionConfig;
  }>();
  
  static getInstance(): SubscriptionPool {
    if (!SubscriptionPool.instance) {
      SubscriptionPool.instance = new SubscriptionPool();
    }
    return SubscriptionPool.instance;
  }

  private getPoolKey(table: string, eventId?: string, filter?: string): string {
    // Create a unique key for pooling subscriptions with same table+event combination
    const eventPart = eventId ? `event:${eventId}` : 'global';
    const filterPart = filter ? `filter:${filter}` : 'all';
    return `${table}-${eventPart}-${filterPart}`;
  }

  public addToPool(
    componentId: string,
    table: string,
    config: SubscriptionConfig,
    eventId?: string,
    callback?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
  ): () => void {
    const poolKey = this.getPoolKey(table, eventId, config.filter);
    
    let pool = this.pools.get(poolKey);
    
    if (!pool) {
      // Create new pool with shared subscription
      const sharedSubscriptionId = `pooled-${poolKey}-${Date.now()}`;
      
      pool = {
        subscriptionId: sharedSubscriptionId,
        callbacks: new Map(),
        refCount: 0,
        config: {
          ...config,
          callback: (payload) => {
            // Broadcast to all subscribers in this pool
            pool!.callbacks.forEach((cb) => {
              try {
                cb(payload);
              } catch (error) {
                logger.error('Error in pooled callback', error);
              }
            });
          }
        }
      };
      
      this.pools.set(poolKey, pool);
      
      // Create the shared subscription
      const unsubscribe = getSubscriptionManager().subscribe(sharedSubscriptionId, pool.config);
      
      // Store unsubscribe function for cleanup
      (pool as any).unsubscribe = unsubscribe;
      
      logger.realtime(`🏊 Created new subscription pool: ${poolKey}`);
    }
    
    // Add component's callback to the pool
    if (callback) {
      pool.callbacks.set(componentId, callback);
    }
    pool.refCount++;
    
    logger.realtime(`🔗 Added component ${componentId} to pool ${poolKey} (refs: ${pool.refCount})`);
    
    // Return cleanup function for this component
    return () => {
      this.removeFromPool(componentId, poolKey);
    };
  }

  private removeFromPool(componentId: string, poolKey: string): void {
    const pool = this.pools.get(poolKey);
    if (!pool) return;
    
    pool.callbacks.delete(componentId);
    pool.refCount--;
    
    logger.realtime(`🔌 Removed component ${componentId} from pool ${poolKey} (refs: ${pool.refCount})`);
    
    // If no more references, clean up the pool
    if (pool.refCount <= 0) {
      if ((pool as any).unsubscribe) {
        (pool as any).unsubscribe();
      }
      this.pools.delete(poolKey);
      logger.realtime(`🗑️ Cleaned up empty subscription pool: ${poolKey}`);
    }
  }

  public getPoolStats(): {
    totalPools: number;
    totalSubscriptions: number;
    poolDetails: Array<{
      poolKey: string;
      refCount: number;
      callbackCount: number;
    }>;
  } {
    return {
      totalPools: this.pools.size,
      totalSubscriptions: Array.from(this.pools.values()).reduce((sum, pool) => sum + pool.refCount, 0),
      poolDetails: Array.from(this.pools.entries()).map(([key, pool]) => ({
        poolKey: key,
        refCount: pool.refCount,
        callbackCount: pool.callbacks.size,
      }))
    };
  }
}

// Performance configuration
interface PerformanceOptions {
  enableBatching?: boolean;
  enableRateLimit?: boolean;
  batchDelay?: number;
  maxUpdatesPerSecond?: number;
  // New pooling options
  enablePooling?: boolean;
  eventId?: string; // For event-specific pooling
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
      enablePooling: boolean;
    };
    poolStats?: {
      totalPools: number;
      totalSubscriptions: number;
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
    enablePooling = true, // Enable pooling by default for better performance
    eventId,
  } = performanceOptions;

  // Generate unique component ID for pooling
  const componentId = useMemo(() => `${subscriptionId}-${Date.now()}-${Math.random()}`, [subscriptionId]);

  // Setup subscription with optional pooling
  useEffect(() => {
    if (!enabled || !subscriptionId || !table) {
      return;
    }

    // Prevent double subscription in React StrictMode
    if (subscriptionActiveRef.current) {
      logger.realtime(`⚠️ Subscription already active, skipping: ${subscriptionId}`);
      return;
    }

    // Debounce subscription creation in development to handle React Strict Mode
    const isDevelopment = process.env.NODE_ENV === 'development';
    const setupDelay = isDevelopment ? 100 : 0; // Small delay in development only

    const setupTimer = setTimeout(() => {
      if (!mountedRef.current || subscriptionActiveRef.current) {
        return; // Component unmounted or subscription already active
      }

      logger.realtime(`🔗 Setting up ${enablePooling ? 'pooled' : 'direct'} subscription: ${subscriptionId}`, {
        pooling: enablePooling,
        eventId,
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

        if (enablePooling) {
          // Use pooled subscription for better performance
          const poolCleanup = SubscriptionPool.getInstance().addToPool(
            componentId,
            table,
            config,
            eventId,
            stableOnDataChange
          );
          cleanupRef.current = poolCleanup;
          logger.realtime(`✅ Pooled subscription setup complete: ${subscriptionId}`);
        } else {
          // Use direct subscription (original behavior)
          const unsubscribe = getSubscriptionManager().subscribe(subscriptionId, config);
          cleanupRef.current = unsubscribe;
          logger.realtime(`✅ Direct subscription setup complete: ${subscriptionId}`);
        }
      } catch (error) {
        logger.error(`❌ Failed to setup subscription: ${subscriptionId}`, error);
        subscriptionActiveRef.current = false;
        stableOnError?.(error instanceof Error ? error : new Error('Subscription setup failed'));
      }
    }, setupDelay);

    // Cleanup function
    return () => {
      // Clear setup timer if still pending
      clearTimeout(setupTimer);
      
      if (!mountedRef.current) return;

      logger.realtime(`🧹 Cleaning up ${enablePooling ? 'pooled' : 'direct'} subscription: ${subscriptionId}`);
      
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
    enablePooling,
    eventId,
    componentId,
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

      if (enablePooling) {
        const poolCleanup = SubscriptionPool.getInstance().addToPool(
          componentId,
          table,
          config,
          eventId,
          stableOnDataChange
        );
        cleanupRef.current = poolCleanup;
      } else {
        const unsubscribe = getSubscriptionManager().subscribe(subscriptionId, config);
        cleanupRef.current = unsubscribe;
      }

      subscriptionActiveRef.current = true;
      logger.realtime(`✅ Reconnect successful: ${subscriptionId}`);
    } catch (error) {
      logger.error(`❌ Reconnect failed: ${subscriptionId}`, error);
      stableOnError?.(error instanceof Error ? error : new Error('Reconnect failed'));
    }
  }, [
    enabled,
    subscriptionId,
    table,
    event,
    schema,
    filter,
    enablePooling,
    eventId,
    componentId,
    stableOnDataChange,
    stableOnError,
    stableOnStatusChange,
  ]);

  // Get stats from subscription manager
  const getStats = useCallback(() => {
    const managerStats = getSubscriptionManager().getStats();
    return {
      totalSubscriptions: managerStats.totalSubscriptions,
      activeSubscriptions: managerStats.activeSubscriptions,
      errorCount: managerStats.errorCount,
      connectionState: managerStats.connectionState,
      uptime: managerStats.uptime,
      totalRetries: managerStats.totalRetries,
      recentErrors: managerStats.recentErrors,
      lastError: managerStats.lastError,
    };
  }, []);

  // Get performance metrics including pooling stats
  const getPerformanceMetrics = useCallback(() => {
    const poolStats = SubscriptionPool.getInstance().getPoolStats();
    
    return {
      subscriptionId,
      enabled,
      isConnected: subscriptionActiveRef.current,
      performanceOptions: {
        enableBatching,
        enableRateLimit,
        batchDelay,
        maxUpdatesPerSecond,
        enablePooling,
      },
      poolStats: enablePooling ? {
        totalPools: poolStats.totalPools,
        totalSubscriptions: poolStats.totalSubscriptions,
      } : undefined,
    };
  }, [
    subscriptionId,
    enabled,
    enableBatching,
    enableRateLimit,
    batchDelay,
    maxUpdatesPerSecond,
    enablePooling,
  ]);

  const stats = getStats();

  return {
    isConnected: stats.connectionState === 'connected',
    error: stats.lastError ? new Error(stats.lastError.message) : null,
    reconnect,
    getStats,
    getPerformanceMetrics,
  };
}

/**
 * Convenience hook for event-scoped subscriptions with automatic pooling
 * This is optimized for components that subscribe to the same event data
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
    subscriptionId: `event-${eventId}-${table}`,
    table,
    event,
    filter: eventId ? `event_id=eq.${eventId}` : undefined,
    enabled: enabled && Boolean(eventId),
    performanceOptions: {
      ...performanceOptions,
      enablePooling: true, // Always enable pooling for event subscriptions
      eventId: eventId || undefined,
    },
    onDataChange,
    onError,
  });
}
