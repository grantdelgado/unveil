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
    // Create a stable, deterministic key for pooling subscriptions
    // Use a hash-like approach to avoid overly long channel names
    const eventPart = eventId ? `event-${eventId}` : 'global';
    
    // Simplify filter to avoid complex channel names that might cause issues
    let filterPart = 'all';
    if (filter) {
      // Extract the core filter pattern to create stable keys
      if (filter.includes('event_id=eq.')) {
        filterPart = 'by-event';
      } else if (filter.includes('user_id=eq.')) {
        filterPart = 'by-user';
      } else {
        // For other filters, create a simple hash
        filterPart = `filter-${filter.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8)}`;
      }
    }
    
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
      // Create new pool with shared subscription - STABLE KEY (no timestamp)
      const sharedSubscriptionId = `pooled-${poolKey}`;
      
      pool = {
        subscriptionId: sharedSubscriptionId,
        callbacks: new Map(),
        refCount: 0,
        config: {
          ...config,
          // Enhanced stability configuration
          enableBackoff: true,
          maxBackoffDelay: 30000,
          connectionTimeout: 15000,
          maxRetries: 3,
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
      
      logger.realtime(`🏊 Created new subscription pool: ${poolKey}`, {
        pooling: true,
        batching: false,
        rateLimit: false,
        batchDelay: 100,
        maxUpdatesPerSecond: 5,
      });
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
    
    // Clean up pool if no more references, with delay to prevent thrashing
    if (pool.refCount === 0) {
      logger.realtime(`🧹 Cleaning up empty pool: ${poolKey}`);
      
      // Add small delay to prevent immediate recreation if components are remounting
      setTimeout(() => {
        const currentPool = this.pools.get(poolKey);
        if (currentPool && currentPool.refCount === 0) {
          if ((currentPool as any).unsubscribe) {
            (currentPool as any).unsubscribe();
          }
          this.pools.delete(poolKey);
        }
      }, 1000); // 1 second delay to prevent thrashing
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
    const poolDetails = Array.from(this.pools.entries()).map(([key, pool]) => ({
      poolKey: key,
      refCount: pool.refCount,
      callbackCount: pool.callbacks.size,
    }));

    return {
      totalPools: this.pools.size,
      totalSubscriptions: this.pools.size,
      poolDetails,
    };
  }
}

interface PerformanceOptions {
  enableBatching?: boolean;
  enableRateLimit?: boolean;
  batchDelay?: number;
  maxUpdatesPerSecond?: number;
  // New pooling options
  enablePooling?: boolean;
  eventId?: string; // For event-specific pooling
}

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
  const subscriptionManager = getSubscriptionManager();
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isConnectedRef = useRef(false);
  const errorRef = useRef<Error | null>(null);
  // Use stable component ID to prevent unnecessary subscription churn
  const componentId = useMemo(() => `${subscriptionId}-${Math.random().toString(36).substr(2, 9)}`, [subscriptionId]);

  // Enhanced error handling with reduced noise
  const handleError = useCallback((error: Error) => {
    // Only log errors that aren't connection-related or are significant
    if (!error.message.includes('CHANNEL_ERROR') && !error.message.includes('timeout')) {
      logger.realtimeError('Subscription error', error);
    }
    errorRef.current = error;
    onError?.(error);
  }, [onError]);

  // Enhanced status change handling
  const handleStatusChange = useCallback((status: 'connecting' | 'connected' | 'disconnected' | 'error') => {
    const wasConnected = isConnectedRef.current;
    isConnectedRef.current = status === 'connected';
    
    // Only log status changes that are meaningful
    if (status === 'connected' && !wasConnected) {
      logger.realtime('Subscription connected');
    } else if (status === 'error' && wasConnected) {
      logger.realtime('Subscription error state');
    }
    
    onStatusChange?.(status);
  }, [onStatusChange]);

  // Enhanced data change handling with error boundaries
  const handleDataChange = useCallback((payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
    try {
      onDataChange?.(payload);
    } catch (error) {
      logger.error('Error in data change handler', error);
      // Don't propagate data change errors to avoid cascading failures
    }
  }, [onDataChange]);

  // Set up subscription with enhanced stability and mounting guard
  useEffect(() => {
    if (!enabled || !subscriptionId) {
      return;
    }

    // Prevent multiple subscriptions for the same component
    if (unsubscribeRef.current) {
      logger.realtime(`⚠️ Subscription already exists for ${subscriptionId}, skipping`);
      return;
    }

    try {
      // Use pooling if enabled and appropriate
      if (performanceOptions.enablePooling && performanceOptions.eventId) {
        const pool = SubscriptionPool.getInstance();
        const config: SubscriptionConfig = {
          table,
          event,
          schema,
          filter,
          callback: handleDataChange,
          onError: handleError,
          onStatusChange: handleStatusChange,
          // Enhanced stability configuration
          enableBackoff: true,
          maxBackoffDelay: 30000,
          connectionTimeout: 15000,
          maxRetries: 3,
          timeoutMs: 30000,
          retryOnTimeout: true,
        };

        unsubscribeRef.current = pool.addToPool(
          componentId,
          table,
          config,
          performanceOptions.eventId,
          handleDataChange
        );
      } else {
        // Direct subscription with enhanced stability
        const config: SubscriptionConfig = {
          table,
          event,
          schema,
          filter,
          callback: handleDataChange,
          onError: handleError,
          onStatusChange: handleStatusChange,
          // Enhanced stability configuration
          enableBackoff: true,
          maxBackoffDelay: 30000,
          connectionTimeout: 15000,
          maxRetries: 3,
          timeoutMs: 30000,
          retryOnTimeout: true,
        };

        unsubscribeRef.current = subscriptionManager.subscribe(subscriptionId, config);
      }

      logger.realtime(`📡 Creating enhanced subscription: ${subscriptionId}`, {
        table,
        event,
        filter,
        timeout: 30000,
        retryOnTimeout: true,
        enableBackoff: true,
      });
    } catch (error) {
      logger.error(`Failed to create subscription: ${subscriptionId}`, error);
      handleError(error instanceof Error ? error : new Error(String(error)));
    }

    // Enhanced cleanup function with memory leak prevention
    return () => {
      if (unsubscribeRef.current) {
        try {
          logger.realtime(`🧹 Cleaning up subscription: ${subscriptionId}`);
          unsubscribeRef.current();
          unsubscribeRef.current = null;
          
          // Clear error state to prevent memory leaks
          errorRef.current = null;
          isConnectedRef.current = false;
        } catch (error) {
          logger.warn(`Error during subscription cleanup: ${subscriptionId}`, error);
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
    // Remove callback dependencies to prevent unnecessary re-subscriptions
    // handleDataChange, handleError, handleStatusChange,
    componentId,
    performanceOptions.enablePooling,
    performanceOptions.eventId,
  ]);

  // Manual reconnect function with stability checks
  const reconnect = useCallback(() => {
    if (!enabled || !subscriptionId) return;

    // Check if we're already reconnecting
    const stats = subscriptionManager.getStats();
    if (stats.connectionState === 'connecting') {
      logger.warn('Already reconnecting, skipping manual reconnect');
      return;
    }

    logger.realtime(`🔄 Manual reconnect requested for: ${subscriptionId}`);
    
    // Clean up existing subscription
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    // Recreate subscription with delay to avoid overwhelming
    setTimeout(() => {
      if (enabled) {
        try {
          const config: SubscriptionConfig = {
            table,
            event,
            schema,
            filter,
            callback: handleDataChange,
            onError: handleError,
            onStatusChange: handleStatusChange,
            enableBackoff: true,
            maxBackoffDelay: 30000,
            connectionTimeout: 15000,
            maxRetries: 3,
            timeoutMs: 30000,
            retryOnTimeout: true,
          };

          unsubscribeRef.current = subscriptionManager.subscribe(subscriptionId, config);
        } catch (error) {
          logger.error(`Failed to reconnect subscription: ${subscriptionId}`, error);
          handleError(error instanceof Error ? error : new Error(String(error)));
        }
      }
    }, 1000); // 1 second delay before reconnecting
  }, [
    enabled,
    subscriptionId,
    table,
    event,
    schema,
    filter,
    handleDataChange,
    handleError,
    handleStatusChange,
  ]);

  // Get stats with enhanced error handling
  const getStats = useCallback(() => {
    try {
      return subscriptionManager.getStats();
    } catch (error) {
      logger.error('Error getting subscription stats', error);
      return {
        totalSubscriptions: 0,
        activeSubscriptions: 0,
        errorCount: 0,
        connectionState: 'error' as const,
        uptime: 0,
        totalRetries: 0,
        recentErrors: 0,
        lastError: null,
      };
    }
  }, []);

  // Get performance metrics
  const getPerformanceMetrics = useCallback(() => {
    const poolStats = performanceOptions.enablePooling 
      ? SubscriptionPool.getInstance().getPoolStats()
      : undefined;

    return {
      subscriptionId,
      enabled,
      isConnected: isConnectedRef.current,
      performanceOptions: {
        enableBatching: performanceOptions.enableBatching ?? false,
        enableRateLimit: performanceOptions.enableRateLimit ?? false,
        batchDelay: performanceOptions.batchDelay ?? 100,
        maxUpdatesPerSecond: performanceOptions.maxUpdatesPerSecond ?? 5,
        enablePooling: performanceOptions.enablePooling ?? false,
      },
      poolStats,
    };
  }, [subscriptionId, enabled, performanceOptions]);

  return {
    isConnected: isConnectedRef.current,
    error: errorRef.current,
    reconnect,
    getStats,
    getPerformanceMetrics,
  };
}

// Convenience hook for event-specific subscriptions
export function useEventSubscription({
  eventId,
  table,
  event = '*',
  filter,
  onDataChange,
  onError,
  enabled = true,
  performanceOptions,
}: {
  eventId: string | null;
  table: string;
  event?: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
  filter?: string;
  onDataChange: (payload: RealtimePostgresChangesPayload<any>) => void;
  onError?: (error: Error) => void;
  enabled?: boolean;
  performanceOptions?: UseRealtimeSubscriptionOptions['performanceOptions'];
}): UseRealtimeSubscriptionReturn {
  const subscriptionId = eventId ? `${table}-${eventId}-${event}` : null;

  return useRealtimeSubscription({
    subscriptionId: subscriptionId || 'disabled',
    table,
    event,
    filter,
    enabled: enabled && Boolean(eventId),
    performanceOptions: {
      enablePooling: true,
      eventId: eventId || undefined,
      ...performanceOptions,
    },
    onDataChange,
    onError,
  });
}
