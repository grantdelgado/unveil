import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { createRealtimeError, type RealtimeError } from '@/lib/types/errors';
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';

// Enhanced subscription configuration types
export interface SubscriptionConfig {
  table: string;
  event: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
  schema?: string;
  filter?: string;
  callback: (
    payload: RealtimePostgresChangesPayload<Record<string, string | number | boolean | null>>,
  ) => void;
  onStatusChange?: (state: 'connected' | 'disconnected' | 'connecting' | 'error') => void;
  onError?: (error: Error) => void;
  // Enhanced timeout configuration
  timeoutMs?: number;
  retryOnTimeout?: boolean;
  maxRetries?: number;
}

export interface SubscriptionState {
  id: string;
  config: SubscriptionConfig;
  channel: RealtimeChannel;
  isActive: boolean;
  createdAt: Date;
  lastActivity?: Date;
  lastError?: Error | null;
  retryCount: number;
  connectionAttempts: number;
  lastHeartbeat?: Date;
}

export interface SubscriptionStats {
  totalSubscriptions: number;
  activeSubscriptions: number;
  errorCount: number;
  connectionState: 'connected' | 'disconnected' | 'connecting' | 'error';
  uptime: number;
  totalRetries: number;
  recentErrors: number;
  avgConnectionTime: number;
  healthScore: number;
  lastError: {
    realtimeCode?: string;
    message: string;
    timestamp: Date;
    subscriptionId?: string;
  } | null;
}

/**
 * Enhanced subscription manager for Supabase real-time features
 * Provides automatic cleanup, error handling, timeout management, and debugging utilities
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
  private errorCount = 0;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private connectionTimes: number[] = [];

  // Enhanced configuration
  private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds
  private readonly HEARTBEAT_INTERVAL = 15000; // 15 seconds
  private readonly MAX_RETRIES = 3;

  constructor() {
    logger.realtime('🚀 Enhanced SubscriptionManager initialized');
    this.setupConnectionMonitoring();
    this.startHealthChecking();
  }

  /**
   * Create a new subscription with enhanced timeout and retry management
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

    // Clean up existing subscription if it exists
    if (this.subscriptions.has(subscriptionId)) {
      logger.realtime(
        `⚠️ Subscription ${subscriptionId} already exists, cleaning up old one`,
      );
      this.cleanupExistingSubscription(subscriptionId);
    }

    const startTime = Date.now();

    try {
      // Enhanced channel configuration with timeout and heartbeat
      const channel = supabase
        .channel(subscriptionId, {
          config: {
            presence: { 
              key: subscriptionId,
            },
            broadcast: { 
              self: false, 
              ack: true,
            },
            // Enhanced realtime config
            private: false,
          },
        })
        .on(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          'postgres_changes' as any,
          {
            event: config.event || '*',
            schema: config.schema || 'public',
            table: config.table,
            filter: config.filter,
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (payload: RealtimePostgresChangesPayload<any>) => {
            if (config.callback) {
              try {
                // Update activity timestamp
                const subscription = this.subscriptions.get(subscriptionId);
                if (subscription) {
                  subscription.lastActivity = new Date();
                  subscription.lastHeartbeat = new Date();
                }

                config.callback(payload);
              } catch (callbackError) {
                logger.error(
                  `❌ Error in subscription callback: ${subscriptionId}`,
                  callbackError,
                );
                this.handleSubscriptionError(
                  subscriptionId,
                  callbackError instanceof Error
                    ? callbackError
                    : new Error(String(callbackError)),
                );
              }
            }
          },
        );

      logger.realtime(
        `📡 Creating enhanced subscription: ${subscriptionId}`,
        {
          table: config.table,
          event: config.event,
          filter: config.filter,
          timeout: config.timeoutMs || this.DEFAULT_TIMEOUT,
          retryOnTimeout: config.retryOnTimeout ?? true,
        },
      );

      // Enhanced subscription with timeout handling
      new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          // Use warn instead of error to reduce console noise in development
          logger.warn(`⏰ Subscription timeout: ${subscriptionId} (${config.timeoutMs || this.DEFAULT_TIMEOUT}ms) - retrying connection`);
          
          // Handle timeout based on config
          if (config.retryOnTimeout !== false) {
            this.handleSubscriptionTimeout(subscriptionId);
            resolve(); // Don't reject, let retry handle it
          } else {
            const timeoutError = new Error(`Subscription timeout: ${subscriptionId}`);
            this.handleSubscriptionError(subscriptionId, timeoutError);
            reject(timeoutError);
          }
        }, config.timeoutMs || this.DEFAULT_TIMEOUT);

        // Subscribe with enhanced error handling
        channel.subscribe((status, error) => {
          clearTimeout(timeout);
          
          if (error) {
            logger.error(`❌ Subscription error: ${subscriptionId}`, error);
            this.handleSubscriptionError(
              subscriptionId,
              error instanceof Error ? error : new Error(String(error)),
            );
            return;
          }

          const connectionTime = Date.now() - startTime;
          this.connectionTimes.push(connectionTime);
          if (this.connectionTimes.length > 10) {
            this.connectionTimes.shift(); // Keep only last 10 measurements
          }

          if (status === 'SUBSCRIBED') {
            logger.realtime(`✅ Subscription active: ${subscriptionId} (${connectionTime}ms)`);
            config.onStatusChange?.('connected');
            this.connectionState = 'connected';
            
            // Reset retry count on successful connection
            const subscription = this.subscriptions.get(subscriptionId);
            if (subscription) {
              subscription.retryCount = 0;
              subscription.connectionAttempts = 0;
              subscription.lastError = null;
              subscription.lastHeartbeat = new Date();
            }
            
          } else if (status === 'CHANNEL_ERROR') {
            logger.error(`❌ Channel error: ${subscriptionId}`);
            this.handleSubscriptionError(
              subscriptionId,
              new Error(`Channel error: ${status}`),
            );
          } else if (status === 'TIMED_OUT') {
            logger.warn(`⏰ Subscription timeout: ${subscriptionId} - connection issue detected`);
            this.handleSubscriptionTimeout(subscriptionId);
          } else if (status === 'CLOSED') {
            logger.realtime(`🔌 Subscription closed: ${subscriptionId}`);
            config.onStatusChange?.('disconnected');
          }
        });
      });

      // Store enhanced subscription info
      const subscription: SubscriptionState = {
        id: subscriptionId,
        config,
        channel,
        isActive: true,
        createdAt: new Date(),
        lastActivity: new Date(),
        lastError: null,
        retryCount: 0,
        connectionAttempts: 1,
        lastHeartbeat: new Date(),
      };

      this.subscriptions.set(subscriptionId, subscription);
      config.onStatusChange?.('connecting');

      // Return cleanup function
      return () => this.unsubscribe(subscriptionId);
    } catch (error) {
      logger.error(
        `❌ Failed to create subscription: ${subscriptionId}`,
        error,
      );
      const subscriptionError = createRealtimeError(
        'SUBSCRIPTION_FAILED',
        `Failed to create subscription: ${subscriptionId}`,
        { subscriptionId, error },
      );
      this.handleSubscriptionError(subscriptionId, subscriptionError);
      throw subscriptionError;
    }
  }

  /**
   * Handle subscription timeouts with retry logic
   */
  private handleSubscriptionTimeout(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      logger.error(`❌ Cannot handle timeout for unknown subscription: ${subscriptionId}`);
      return;
    }

    const maxRetries = subscription.config.maxRetries || this.MAX_RETRIES;
    subscription.retryCount = (subscription.retryCount || 0) + 1;

    logger.realtime(`⏰ Subscription timeout: ${subscriptionId} (attempt ${subscription.retryCount}/${maxRetries})`);

    if (subscription.retryCount <= maxRetries) {
      // Exponential backoff for retry
      const retryDelay = Math.min(
        this.reconnectDelay * Math.pow(2, subscription.retryCount - 1),
        this.maxReconnectDelay
      );

      logger.realtime(`🔄 Retrying subscription ${subscriptionId} in ${retryDelay}ms`);

      setTimeout(() => {
        if (!this.isDestroyed && this.subscriptions.has(subscriptionId)) {
          // Cleanup and recreate subscription
          this.unsubscribe(subscriptionId);
          this.subscribe(subscriptionId, subscription.config);
        }
      }, retryDelay);
    } else {
      logger.error(`❌ Max retries exceeded for ${subscriptionId}, giving up`);
      const timeoutError = new Error(`Subscription timeout after ${maxRetries} retries: ${subscriptionId}`);
      this.handleSubscriptionError(subscriptionId, timeoutError);
      subscription.config.onStatusChange?.('error');
    }
  }

  /**
   * Clean up existing subscription without throwing errors
   */
  private cleanupExistingSubscription(subscriptionId: string): void {
    const existingSubscription = this.subscriptions.get(subscriptionId);
    if (existingSubscription) {
      try {
        // Mark as inactive
        existingSubscription.isActive = false;
        
        // Remove channel
        supabase.removeChannel(existingSubscription.channel);
        
        // Remove from map
        this.subscriptions.delete(subscriptionId);
        
        logger.realtime(`✅ Cleaned up existing subscription: ${subscriptionId}`);
      } catch (error) {
        logger.error(`❌ Error cleaning up existing subscription: ${subscriptionId}`, error);
        
        // Force remove from map
        this.subscriptions.delete(subscriptionId);
      }
    }
  }

  /**
   * Remove a subscription and clean up resources with enhanced error handling
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

      // Remove the channel with enhanced error handling
      try {
        supabase.removeChannel(subscription.channel);
        logger.realtime(`✅ Channel removed: ${subscriptionId}`);
      } catch (channelError) {
        logger.error(`❌ Error removing channel: ${subscriptionId}`, channelError);
      }
      
      // Remove from subscriptions map
      this.subscriptions.delete(subscriptionId);
      logger.realtime(`✅ Unsubscribed: ${subscriptionId}`);

      // Update connection state if no active subscriptions
      if (this.subscriptions.size === 0) {
        this.connectionState = 'disconnected';
      }

      // Notify status change
      subscription.config.onStatusChange?.('disconnected');
    } catch (error) {
      logger.error(`❌ Error during unsubscribe: ${subscriptionId}`, error);
      
      // Force remove from map even if there was an error
      this.subscriptions.delete(subscriptionId);
      
      // Still notify of disconnection
      subscription.config.onStatusChange?.('disconnected');
    }
  }

  /**
   * Get enhanced subscription statistics with health scoring
   */
  public getStats(): SubscriptionStats {
    const activeSubscriptions = Array.from(this.subscriptions.values()).filter(
      sub => sub.isActive
    ).length;

    const totalRetries = Array.from(this.subscriptions.values())
      .reduce((sum, sub) => sum + (sub.retryCount || 0), 0);

    const recentErrors = Array.from(this.subscriptions.values())
      .filter(sub => sub.lastError && sub.lastError instanceof Error)
      .length;

    // Calculate average connection time
    const avgConnectionTime = this.connectionTimes.length > 0
      ? this.connectionTimes.reduce((sum, time) => sum + time, 0) / this.connectionTimes.length
      : 0;

    // Calculate health score (0-100)
    const healthScore = this.calculateHealthScore();

    // Find the most recent error across all subscriptions
    const lastError = Array.from(this.subscriptions.values())
      .map(sub => ({
        error: sub.lastError,
        subscriptionId: sub.id,
        timestamp: sub.lastActivity || sub.createdAt,
      }))
      .filter((item): item is { error: Error; subscriptionId: string; timestamp: Date } => 
        item.error instanceof Error
      )
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

    return {
      totalSubscriptions: this.subscriptions.size,
      activeSubscriptions,
      errorCount: this.errorCount,
      connectionState: this.connectionState,
      uptime: Date.now() - this.startTime.getTime(),
      totalRetries,
      recentErrors,
      avgConnectionTime,
      healthScore,
      lastError: lastError ? {
        message: lastError.error.message,
        timestamp: lastError.timestamp,
        subscriptionId: lastError.subscriptionId,
      } : null,
    };
  }

  /**
   * Calculate health score based on various metrics
   */
  private calculateHealthScore(): number {
    const subscriptions = Array.from(this.subscriptions.values());
    if (subscriptions.length === 0) return 100;

    let score = 100;

    // Deduct points for errors
    const errorRate = this.errorCount / Math.max(subscriptions.length, 1);
    score -= Math.min(errorRate * 20, 40); // Max 40 points deduction

    // Deduct points for recent errors
    const recentErrorRate = subscriptions.filter(s => s.lastError).length / subscriptions.length;
    score -= recentErrorRate * 20; // Max 20 points deduction

    // Deduct points for high retry counts
    const avgRetries = subscriptions.reduce((sum, s) => sum + s.retryCount, 0) / subscriptions.length;
    score -= Math.min(avgRetries * 5, 20); // Max 20 points deduction

    // Deduct points for slow connections
    if (this.connectionTimes.length > 0) {
      const avgTime = this.connectionTimes.reduce((sum, time) => sum + time, 0) / this.connectionTimes.length;
      if (avgTime > 5000) score -= 10; // Deduct 10 points for slow connections
    }

    // Deduct points if not connected
    if (this.connectionState !== 'connected') {
      score -= 20;
    }

    return Math.max(0, Math.round(score));
  }

  /**
   * Get detailed information about all subscriptions with enhanced metrics
   */
  public getSubscriptionDetails(): Array<{
    id: string;
    table: string;
    event: string;
    isActive: boolean;
    createdAt: Date;
    lastActivity: Date;
    lastHeartbeat?: Date;
    errorCount: number;
    connectionAttempts: number;
    uptime: number;
    healthStatus: 'healthy' | 'warning' | 'critical';
  }> {
    return Array.from(this.subscriptions.entries()).map(
      ([id, subscription]) => {
        const uptime = Date.now() - subscription.createdAt.getTime();
        const timeSinceLastActivity = subscription.lastActivity 
          ? Date.now() - subscription.lastActivity.getTime()
          : uptime;

        // Determine health status
        let healthStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
        if (subscription.retryCount > 2 || subscription.lastError) {
          healthStatus = 'critical';
        } else if (subscription.retryCount > 0 || timeSinceLastActivity > 60000) {
          healthStatus = 'warning';
        }

        return {
          id,
          table: subscription.config.table,
          event: subscription.config.event,
          isActive: subscription.isActive,
          createdAt: subscription.createdAt,
          lastActivity: subscription.lastActivity || subscription.createdAt,
          lastHeartbeat: subscription.lastHeartbeat,
          errorCount: subscription.retryCount,
          connectionAttempts: subscription.connectionAttempts,
          uptime,
          healthStatus,
        };
      },
    );
  }

  /**
   * Clean up all subscriptions with enhanced logging
   */
  public destroy(): void {
    if (this.isDestroyed) return;

    logger.realtime('🧹 Destroying Enhanced SubscriptionManager');

    // Clear health check interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Unsubscribe from all active subscriptions
    const subscriptionIds = Array.from(this.subscriptions.keys());
    logger.realtime(`🧹 Cleaning up ${subscriptionIds.length} subscriptions`);
    
    subscriptionIds.forEach((id) => this.unsubscribe(id));

    this.isDestroyed = true;
    this.connectionState = 'disconnected';

    logger.realtime('✅ Enhanced SubscriptionManager destroyed');
  }

  /**
   * Manually trigger reconnection for all subscriptions with enhanced logic
   */
  public reconnectAll(): void {
    if (this.isDestroyed) return;

    logger.realtime('🔄 Reconnecting all subscriptions with enhanced logic');

    const subscriptions = Array.from(this.subscriptions.entries());
    const activeSubscriptions = subscriptions.filter(([, sub]) => sub.isActive);

    if (activeSubscriptions.length === 0) {
      logger.realtime('ℹ️ No active subscriptions to reconnect');
      return;
    }

    logger.realtime(`🔄 Reconnecting ${activeSubscriptions.length} active subscriptions`);

    // Clean up all existing subscriptions
    activeSubscriptions.forEach(([id]) => this.unsubscribe(id));

    // Recreate all subscriptions with staggered timing to avoid overwhelming
    activeSubscriptions.forEach(([id, subscription], index) => {
      const delay = index * 200; // 200ms delay between reconnections
      setTimeout(() => {
        if (!this.isDestroyed) {
          logger.realtime(`🔄 Recreating subscription ${id} (${index + 1}/${activeSubscriptions.length})`);
          this.subscribe(id, subscription.config);
        }
      }, delay);
    });
  }

  /**
   * Handle subscription errors with enhanced logging and recovery
   */
  private handleSubscriptionError(
    subscriptionId: string,
    error: Error | RealtimeError,
  ): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      logger.error(`❌ Cannot handle error for unknown subscription: ${subscriptionId}`, error);
      return;
    }

    // Convert to Error if needed
    const normalizedError = error instanceof Error ? error : new Error(error.message || 'Unknown subscription error');
    
    // Update subscription error state
    subscription.lastError = normalizedError;
    subscription.retryCount = (subscription.retryCount || 0) + 1;

    // Enhanced error logging with context
    logger.error(`❌ Subscription error: ${subscriptionId}`, {
      error: normalizedError.message,
      retryCount: subscription.retryCount,
      subscriptionAge: Date.now() - subscription.createdAt.getTime(),
      lastActivity: subscription.lastActivity?.toISOString(),
      table: subscription.config.table,
      filter: subscription.config.filter,
    });

    // Update global error count
    this.errorCount++;

    // Notify via callback
    subscription.config.onError?.(normalizedError);
    subscription.config.onStatusChange?.('error');

    // Update connection state
    this.connectionState = 'error';

    // Consider cleanup if too many retries
    const maxRetries = subscription.config.maxRetries || this.MAX_RETRIES;
    if (subscription.retryCount >= maxRetries) {
      logger.error(`❌ Max retries exceeded for ${subscriptionId}, cleaning up`);
      this.unsubscribe(subscriptionId);
    }
  }

  /**
   * Enhanced connection monitoring with better health checks
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
        
        // Reset error count on new auth
        this.errorCount = 0;
      } else if (event === 'TOKEN_REFRESHED') {
        logger.realtime('🔄 Token refreshed, subscriptions should continue');
      }
    });
  }

  /**
   * Enhanced health checking with detailed monitoring
   */
  private startHealthChecking(): void {
    this.healthCheckInterval = setInterval(() => {
      if (this.isDestroyed) {
        return;
      }

      const stats = this.getStats();
      const details = this.getSubscriptionDetails();
      
      // Log periodic health check
      logger.realtime('💓 Enhanced health check', {
        activeSubscriptions: stats.activeSubscriptions,
        connectionState: stats.connectionState,
        errorCount: stats.errorCount,
        healthScore: stats.healthScore,
        avgConnectionTime: Math.round(stats.avgConnectionTime),
      });

      // Check for unhealthy subscriptions
      const unhealthySubscriptions = details.filter(s => s.healthStatus === 'critical');
      if (unhealthySubscriptions.length > 0) {
        logger.error(`⚠️ ${unhealthySubscriptions.length} critical subscriptions detected`, {
          subscriptions: unhealthySubscriptions.map(s => ({
            id: s.id,
            table: s.table,
            errorCount: s.errorCount,
            uptime: s.uptime,
          })),
        });
      }

      // Trigger reconnect if health score is very low
      if (stats.healthScore < 30 && stats.activeSubscriptions > 0) {
        logger.error(`🚨 Health score critically low (${stats.healthScore}), triggering reconnect`);
        this.reconnectAll();
      }

      // Log warning if we have many errors
      if (stats.errorCount > 10) {
        logger.error(
          `⚠️ High error count detected: ${stats.errorCount} errors`,
        );
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  private async waitForConnection(
    channel: RealtimeChannel,
    timeoutMs: number = 10000,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, timeoutMs);

      // Wait for channel to be subscribed
      const checkStatus = () => {
        if (channel.state === 'joined') {
          clearTimeout(timeout);
          resolve();
        } else if (channel.state === 'errored' || channel.state === 'closed') {
          clearTimeout(timeout);
          reject(new Error(`Channel connection failed: ${channel.state}`));
        } else {
          // Check again in 100ms
          setTimeout(checkStatus, 100);
        }
      };

      checkStatus();
    });
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
