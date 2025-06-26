import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { createRealtimeError, type RealtimeError } from '@/lib/types/errors';
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';

// Subscription configuration types
export interface SubscriptionConfig {
  table: string;
  event: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
  schema?: string;
  filter?: string;
  callback: (
    payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
  ) => void;
}

export interface SubscriptionState {
  channel: RealtimeChannel;
  config: SubscriptionConfig;
  isActive: boolean;
  createdAt: Date;
  lastActivity: Date;
  errorCount: number;
  errors: RealtimeError[];
}

export interface SubscriptionStats {
  totalSubscriptions: number;
  activeSubscriptions: number;
  errorCount: number;
  connectionState: 'connected' | 'disconnected' | 'connecting' | 'error';
  uptime: number;
  lastError: RealtimeError | null;
}

/**
 * Centralized subscription manager for Supabase real-time features
 * Provides automatic cleanup, error handling, and debugging utilities
 */
export class SubscriptionManager {
  private subscriptions = new Map<string, SubscriptionState>();
  private connectionState:
    | 'connected'
    | 'disconnected'
    | 'connecting'
    | 'error' = 'disconnected';
  private startTime = new Date();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private maxReconnectDelay = 30000; // Max 30 seconds
  private isDestroyed = false;

  constructor() {
    logger.realtime('🚀 SubscriptionManager initialized');
    this.setupConnectionMonitoring();
  }

  /**
   * Create a new subscription with automatic lifecycle management
   */
  public subscribe(
    subscriptionId: string,
    config: SubscriptionConfig,
  ): () => void {
    if (this.isDestroyed) {
      logger.error(
        '❌ Cannot create subscription: SubscriptionManager is destroyed',
      );
      throw createRealtimeError(
        'SUBSCRIPTION_FAILED',
        'Cannot create subscription: SubscriptionManager is destroyed',
        { subscriptionId },
      );
    }

    // Check if subscription already exists
    if (this.subscriptions.has(subscriptionId)) {
      logger.realtime(
        `⚠️ Subscription ${subscriptionId} already exists, cleaning up old one`,
      );
      this.unsubscribe(subscriptionId);
    }

    try {
      logger.realtime(`📡 Creating subscription: ${subscriptionId}`, {
        table: config.table,
        event: config.event,
        filter: config.filter,
      });

      // Create channel with unique name
      const channelName = `${config.table}:${subscriptionId}`;
      const channel = supabase.channel(channelName);

      // Set up postgres changes listener
      channel.on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        {
          event: config.event,
          schema: config.schema || 'public',
          table: config.table,
          filter: config.filter,
        },
        ((payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          try {
            // Update last activity
            const subscription = this.subscriptions.get(subscriptionId);
            if (subscription) {
              subscription.lastActivity = new Date();
            }

            logger.realtime(`📨 Real-time event received: ${subscriptionId}`, {
              eventType: payload.eventType,
              table: payload.table,
              new: payload.new ? Object.keys(payload.new) : null,
            });

            // Call the user's callback
            config.callback(payload);
          } catch (error) {
            this.handleSubscriptionError(subscriptionId, error);
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any,
      );

      // Subscribe to the channel
      channel.subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          logger.realtime(`✅ Subscription active: ${subscriptionId}`);
          this.connectionState = 'connected';
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000; // Reset delay on successful connection
        } else if (status === 'CHANNEL_ERROR') {
          logger.error(`❌ Subscription error: ${subscriptionId}`, err);
          this.handleSubscriptionError(subscriptionId, err);
        } else if (status === 'TIMED_OUT') {
          logger.error(`⏰ Subscription timeout: ${subscriptionId}`);
          this.handleSubscriptionError(
            subscriptionId,
            createRealtimeError('CONNECTION_FAILED', 'Subscription timed out'),
          );
        } else if (status === 'CLOSED') {
          logger.realtime(`🔌 Subscription closed: ${subscriptionId}`);
          this.connectionState = 'disconnected';
        }
      });

      // Store subscription state
      const subscriptionState: SubscriptionState = {
        channel,
        config,
        isActive: true,
        createdAt: new Date(),
        lastActivity: new Date(),
        errorCount: 0,
        errors: [],
      };

      this.subscriptions.set(subscriptionId, subscriptionState);
      this.connectionState = 'connecting';

      // Return unsubscribe function
      return () => this.unsubscribe(subscriptionId);
    } catch (error) {
      logger.error(
        `❌ Failed to create subscription: ${subscriptionId}`,
        error,
      );
      throw createRealtimeError(
        'SUBSCRIPTION_FAILED',
        `Failed to create subscription: ${subscriptionId}`,
        error,
        { subscriptionId, config },
      );
    }
  }

  /**
   * Remove a subscription and clean up resources
   */
  public unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      logger.realtime(`⚠️ Subscription not found: ${subscriptionId}`);
      return;
    }

    try {
      logger.realtime(`🔌 Unsubscribing: ${subscriptionId}`);

      // Mark as inactive first
      subscription.isActive = false;

      // Add a small delay before removing channel to prevent rapid connect/disconnect cycles
      // This helps with React Strict Mode in development
      setTimeout(() => {
        try {
          // Double-check it's still in our map and wasn't re-created
          const currentSub = this.subscriptions.get(subscriptionId);
          if (currentSub === subscription && !subscription.isActive) {
            // Remove the channel
            supabase.removeChannel(subscription.channel);
            
            // Remove from our tracking
            this.subscriptions.delete(subscriptionId);
            
            logger.realtime(`✅ Unsubscribed: ${subscriptionId}`);
          }
        } catch (cleanupError) {
          logger.error(`❌ Error during delayed cleanup: ${subscriptionId}`, cleanupError);
        }
      }, 50); // 50ms delay to prevent rapid connect/disconnect cycles

    } catch (error) {
      logger.error(`❌ Error unsubscribing: ${subscriptionId}`, error);
      
      // Still try to remove from our tracking even if channel removal failed
      this.subscriptions.delete(subscriptionId);
    }
  }

  /**
   * Get current subscription statistics
   */
  public getStats(): SubscriptionStats {
    const subscriptions = Array.from(this.subscriptions.values());
    const activeSubscriptions = subscriptions.filter((s) => s.isActive).length;
    const totalErrors = subscriptions.reduce((sum, s) => sum + s.errorCount, 0);
    const lastError =
      subscriptions
        .flatMap((s) => s.errors)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0] ||
      null;

    return {
      totalSubscriptions: this.subscriptions.size,
      activeSubscriptions,
      errorCount: totalErrors,
      connectionState: this.connectionState,
      uptime: Date.now() - this.startTime.getTime(),
      lastError,
    };
  }

  /**
   * Get detailed information about all subscriptions (for debugging)
   */
  public getSubscriptionDetails(): Array<{
    id: string;
    table: string;
    event: string;
    isActive: boolean;
    createdAt: Date;
    lastActivity: Date;
    errorCount: number;
    uptime: number;
  }> {
    return Array.from(this.subscriptions.entries()).map(
      ([id, subscription]) => ({
        id,
        table: subscription.config.table,
        event: subscription.config.event,
        isActive: subscription.isActive,
        createdAt: subscription.createdAt,
        lastActivity: subscription.lastActivity,
        errorCount: subscription.errorCount,
        uptime: Date.now() - subscription.createdAt.getTime(),
      }),
    );
  }

  /**
   * Clean up all subscriptions (call on app unmount)
   */
  public destroy(): void {
    if (this.isDestroyed) return;

    logger.realtime('🧹 Destroying SubscriptionManager');

    // Unsubscribe from all active subscriptions
    const subscriptionIds = Array.from(this.subscriptions.keys());
    subscriptionIds.forEach((id) => this.unsubscribe(id));

    this.isDestroyed = true;
    this.connectionState = 'disconnected';

    logger.realtime('✅ SubscriptionManager destroyed');
  }

  /**
   * Manually trigger reconnection for all subscriptions
   */
  public reconnectAll(): void {
    if (this.isDestroyed) return;

    logger.realtime('🔄 Reconnecting all subscriptions');

    const subscriptions = Array.from(this.subscriptions.entries());

    // Clean up all existing subscriptions
    subscriptions.forEach(([id]) => this.unsubscribe(id));

    // Recreate all subscriptions
    subscriptions.forEach(([id, subscription]) => {
      if (subscription.isActive) {
        setTimeout(() => {
          this.subscribe(id, subscription.config);
        }, 100); // Small delay to avoid overwhelming the connection
      }
    });
  }

  /**
   * Handle subscription errors with automatic retry logic
   */
  private handleSubscriptionError(
    subscriptionId: string,
    error: unknown,
  ): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return;

    const realtimeError = createRealtimeError(
      'SUBSCRIPTION_FAILED',
      `Subscription error: ${subscriptionId}`,
      error,
      { subscriptionId },
      subscription.channel.topic,
      subscriptionId,
    );

    subscription.errorCount++;
    subscription.errors.push(realtimeError);

    // Keep only last 10 errors per subscription
    if (subscription.errors.length > 10) {
      subscription.errors = subscription.errors.slice(-10);
    }

    logger.error(`❌ Subscription error: ${subscriptionId}`, realtimeError);

    // Attempt automatic reconnection for transient errors
    if (this.shouldAttemptReconnect(realtimeError)) {
      this.attemptReconnect(subscriptionId);
    }
  }

  /**
   * Determine if we should attempt reconnection based on error type
   */
  private shouldAttemptReconnect(error: RealtimeError): boolean {
    const transientErrors = [
      'CONNECTION_FAILED',
      'CHANNEL_ERROR',
      'RATE_LIMITED',
    ];
    return (
      transientErrors.includes(error.realtimeCode || '') &&
      this.reconnectAttempts < this.maxReconnectAttempts
    );
  }

  /**
   * Attempt to reconnect a failed subscription
   */
  private attemptReconnect(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription || this.isDestroyed) return;

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay,
    );

    logger.realtime(
      `🔄 Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} for ${subscriptionId} in ${delay}ms`,
    );

    setTimeout(() => {
      if (this.isDestroyed) return;

      // Clean up the failed subscription
      this.unsubscribe(subscriptionId);

      // Recreate it
      try {
        this.subscribe(subscriptionId, subscription.config);
      } catch (error) {
        logger.error(`❌ Reconnection failed for ${subscriptionId}`, error);
      }
    }, delay);
  }

  /**
   * Set up connection monitoring and health checks
   */
  private setupConnectionMonitoring(): void {
    // Monitor connection state changes
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        logger.realtime('🔒 User signed out, cleaning up subscriptions');
        this.destroy();
      } else if (event === 'SIGNED_IN' && session) {
        logger.realtime('🔑 User signed in, connection monitoring active');
        this.connectionState = 'connected';
      }
    });

    // Periodic health check (every 30 seconds)
    const healthCheckInterval = setInterval(() => {
      if (this.isDestroyed) {
        clearInterval(healthCheckInterval);
        return;
      }

      const stats = this.getStats();
      logger.realtime('💓 Health check', {
        activeSubscriptions: stats.activeSubscriptions,
        connectionState: stats.connectionState,
        errorCount: stats.errorCount,
      });

      // Log warning if we have many errors
      if (stats.errorCount > 10) {
        logger.error(
          `⚠️ High error count detected: ${stats.errorCount} errors`,
        );
      }
    }, 30000);
  }
}

// Global singleton instance
let subscriptionManager: SubscriptionManager | null = null;

/**
 * Get the global subscription manager instance
 */
export function getSubscriptionManager(): SubscriptionManager {
  if (!subscriptionManager) {
    subscriptionManager = new SubscriptionManager();
  }
  return subscriptionManager;
}

/**
 * Clean up the global subscription manager
 */
export function destroySubscriptionManager(): void {
  if (subscriptionManager) {
    subscriptionManager.destroy();
    subscriptionManager = null;
  }
}
