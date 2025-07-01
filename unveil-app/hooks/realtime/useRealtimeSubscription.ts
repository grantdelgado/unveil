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

  /**
   * Performance optimization options
   */
  performanceOptions?: {
    /**
     * Enable batching of rapid updates (default: false)
     */
    enableBatching?: boolean;
    
    /**
     * Batch delay in milliseconds (default: 100ms)
     */
    batchDelay?: number;
    
    /**
     * Maximum batch size (default: 10)
     */
    maxBatchSize?: number;
    
    /**
     * Enable rate limiting (default: false)
     */
    enableRateLimit?: boolean;
    
    /**
     * Maximum updates per second (default: 5)
     */
    maxUpdatesPerSecond?: number;
    
    /**
     * Enable payload size optimization (default: true)
     */
    optimizePayloadSize?: boolean;
  };
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

  /**
   * Get performance metrics
   */
  getPerformanceMetrics: () => {
    totalUpdates: number;
    batchedUpdates: number;
    rateLimitedUpdates: number;
    averageUpdateInterval: number;
    lastUpdateTime: Date | null;
  };
}

/**
 * React hook for managing real-time subscriptions with automatic cleanup and performance optimizations
 *
 * @example
 * ```typescript
 * const { isConnected, error, reconnect } = useRealtimeSubscription({
 *   subscriptionId: `messages-${eventId}`,
 *   table: 'messages',
 *   event: '*',
 *   filter: `event_id=eq.${eventId}`,
 *   performanceOptions: {
 *     enableBatching: true,
 *     batchDelay: 100,
 *     maxBatchSize: 5,
 *     enableRateLimit: true,
 *     maxUpdatesPerSecond: 3
 *   },
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
  performanceOptions = {},
}: UseRealtimeSubscriptionOptions): UseRealtimeSubscriptionReturn {
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isConnectedRef = useRef(false);
  const errorRef = useRef<Error | null>(null);
  const subscriptionManager = getSubscriptionManager();

  // Performance optimization state
  const batchedUpdatesRef = useRef<RealtimePostgresChangesPayload<any>[]>([]);
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const rateLimitingRef = useRef<{
    lastUpdate: Date | null;
    updateCount: number;
    rateLimitedCount: number;
  }>({
    lastUpdate: null,
    updateCount: 0,
    rateLimitedCount: 0,
  });

  // Performance metrics tracking
  const metricsRef = useRef<{
    totalUpdates: number;
    batchedUpdates: number;
    rateLimitedUpdates: number;
    updateIntervals: number[];
    lastUpdateTime: Date | null;
  }>({
    totalUpdates: 0,
    batchedUpdates: 0,
    rateLimitedUpdates: 0,
    updateIntervals: [],
    lastUpdateTime: null,
  });

  // Extract performance options with defaults
  const {
    enableBatching = false,
    batchDelay = 100,
    maxBatchSize = 10,
    enableRateLimit = false,
    maxUpdatesPerSecond = 5,
    optimizePayloadSize = true,
  } = performanceOptions;

  // Process batched updates
  const processBatch = useCallback(() => {
    if (batchedUpdatesRef.current.length === 0) return;

    const batch = [...batchedUpdatesRef.current];
    batchedUpdatesRef.current = [];

    try {
      // If only one update in batch, process normally
      if (batch.length === 1) {
        onDataChange(batch[0]);
      } else {
        // Process batched updates
        logger.realtime(`📦 Processing batch of ${batch.length} updates for ${subscriptionId}`);
        
        // Group by event type for more efficient processing
        const groupedUpdates = batch.reduce((acc, update) => {
          const key = update.eventType;
          if (!acc[key]) acc[key] = [];
          acc[key].push(update);
          return acc;
        }, {} as Record<string, RealtimePostgresChangesPayload<any>[]>);

        // Process each group
        Object.entries(groupedUpdates).forEach(([eventType, updates]) => {
          if (eventType === 'INSERT' || eventType === 'UPDATE') {
            // For INSERT/UPDATE, only process the latest update per record
            const latestUpdates = new Map<string, RealtimePostgresChangesPayload<any>>();
            updates.forEach(update => {
              const recordId = update.new?.id;
              if (recordId) {
                latestUpdates.set(recordId, update);
              }
            });
            
            latestUpdates.forEach(update => onDataChange(update));
          } else {
            // For DELETE, process all updates
            updates.forEach(update => onDataChange(update));
          }
        });

        metricsRef.current.batchedUpdates += batch.length;
      }
    } catch (error) {
      logger.error(`❌ Error processing batched updates for ${subscriptionId}:`, error);
      if (onError) {
        onError(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }, [subscriptionId, onDataChange, onError]);

  // Optimized payload processor
  const processPayload = useCallback((payload: RealtimePostgresChangesPayload<any>) => {
    // Optimize payload size if enabled
    if (optimizePayloadSize) {
      // Remove unnecessary fields to reduce memory usage
      const optimizedPayload = {
        ...payload,
        // Only keep essential fields
        new: payload.new ? {
          id: (payload.new as any).id,
          ...payload.new
        } : payload.new,
        old: payload.old ? {
          id: (payload.old as any).id,
          ...payload.old  
        } : payload.old,
      } as RealtimePostgresChangesPayload<any>;
      return optimizedPayload;
    }
    return payload;
  }, [optimizePayloadSize]);

  // Rate limiting logic
  const isRateLimited = useCallback(() => {
    if (!enableRateLimit) return false;

    const now = new Date();
    const oneSecondAgo = new Date(now.getTime() - 1000);

    // Reset counter every second
    if (!rateLimitingRef.current.lastUpdate || rateLimitingRef.current.lastUpdate < oneSecondAgo) {
      rateLimitingRef.current.updateCount = 0;
      rateLimitingRef.current.lastUpdate = now;
    }

    // Check if we've exceeded the rate limit
    if (rateLimitingRef.current.updateCount >= maxUpdatesPerSecond) {
      rateLimitingRef.current.rateLimitedCount++;
      metricsRef.current.rateLimitedUpdates++;
      return true;
    }

    rateLimitingRef.current.updateCount++;
    return false;
  }, [enableRateLimit, maxUpdatesPerSecond]);

  // Enhanced callback with performance optimizations
  const stableOnDataChange = useCallback(
    (payload: RealtimePostgresChangesPayload<any>) => {
      try {
        // Update metrics
        const now = new Date();
        if (metricsRef.current.lastUpdateTime) {
          const interval = now.getTime() - metricsRef.current.lastUpdateTime.getTime();
          metricsRef.current.updateIntervals.push(interval);
          
          // Keep only last 100 intervals for average calculation
          if (metricsRef.current.updateIntervals.length > 100) {
            metricsRef.current.updateIntervals = metricsRef.current.updateIntervals.slice(-100);
          }
        }
        metricsRef.current.lastUpdateTime = now;
        metricsRef.current.totalUpdates++;

        // Check rate limiting
        if (isRateLimited()) {
          logger.realtime(`⏱️ Rate limited update for ${subscriptionId}, skipping`);
          return;
        }

        // Optimize payload
        const optimizedPayload = processPayload(payload);

        // Handle batching
        if (enableBatching) {
          batchedUpdatesRef.current.push(optimizedPayload);

          // Clear existing timeout
          if (batchTimeoutRef.current) {
            clearTimeout(batchTimeoutRef.current);
          }

          // Process batch immediately if it reaches max size
          if (batchedUpdatesRef.current.length >= maxBatchSize) {
            processBatch();
          } else {
            // Set timeout for batch processing
            batchTimeoutRef.current = setTimeout(processBatch, batchDelay);
          }
        } else {
          // Process immediately without batching
          onDataChange(optimizedPayload);
        }
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
    [subscriptionId, onDataChange, onError, enableBatching, maxBatchSize, batchDelay, isRateLimited, processPayload, processBatch],
  );

  // Setup subscription
  useEffect(() => {
    if (!enabled || !subscriptionId || !table) {
      return;
    }

    // Prevent React StrictMode subscription race conditions in development
    const isDev = process.env.NODE_ENV === 'development';
    const delay = isDev ? 100 : 0;

    logger.realtime(`🔗 Setting up subscription: ${subscriptionId}`, {
      batching: enableBatching,
      rateLimit: enableRateLimit,
      batchDelay,
      maxUpdatesPerSecond,
    });

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
          setTimeout(() => onStatusChange('connected'), 200);
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

      // Clear timeouts and batches
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
        batchTimeoutRef.current = null;
      }
      
      // Process any remaining batched updates before cleanup
      if (enableBatching && batchedUpdatesRef.current.length > 0) {
        processBatch();
      }

      // Clear the setup timeout to prevent memory leaks
      clearTimeout(setupTimeoutId);

      // Add a small delay before cleanup to prevent race conditions with React Strict Mode
      const cleanupDelay = isDev ? 50 : 0;
      
      setTimeout(() => {
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }

        isConnectedRef.current = false;

        if (onStatusChange) {
          onStatusChange('disconnected');
        }
      }, cleanupDelay);
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
    enableBatching,
    processBatch,
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

  // Get performance metrics
  const getPerformanceMetrics = useCallback(() => {
    const intervals = metricsRef.current.updateIntervals;
    const averageUpdateInterval = intervals.length > 0 
      ? intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length 
      : 0;

    return {
      totalUpdates: metricsRef.current.totalUpdates,
      batchedUpdates: metricsRef.current.batchedUpdates,
      rateLimitedUpdates: metricsRef.current.rateLimitedUpdates,
      averageUpdateInterval,
      lastUpdateTime: metricsRef.current.lastUpdateTime,
    };
  }, []);

  return {
    isConnected: isConnectedRef.current,
    error: errorRef.current,
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
