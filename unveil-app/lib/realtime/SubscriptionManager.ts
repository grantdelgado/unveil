import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { createRealtimeError, type RealtimeError } from '@/lib/types/errors';
import { emitSubscribeWhileDestroyed, emitTimeout, emitColdReconnect } from '@/lib/telemetry/realtime';
import { RealtimeFlags, RealtimeTunables, getAdaptiveTimeout, getCleanupInterval } from '@/lib/config/realtime';
import { normalizeRealtimeError, type RTErrorContext } from '@/lib/realtime/error-normalize';
import { shouldLog } from '@/lib/realtime/log-sampler';
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
    payload: RealtimePostgresChangesPayload<
      Record<string, string | number | boolean | null>
    >,
  ) => void;
  onStatusChange?: (
    state: 'connected' | 'disconnected' | 'connecting' | 'error',
  ) => void;
  onError?: (error: Error) => void;
  // Enhanced timeout configuration
  timeoutMs?: number;
  retryOnTimeout?: boolean;
  maxRetries?: number;
  // New: Connection stability options
  enableBackoff?: boolean;
  maxBackoffDelay?: number;
  connectionTimeout?: number;
}

export interface SubscriptionState {
  id: string;
  config: SubscriptionConfig;
  channel: RealtimeChannel | null;
  isActive: boolean;
  createdAt: Date;
  lastActivity?: Date;
  lastError?: Error | null;
  retryCount: number;
  connectionAttempts: number;
  lastHeartbeat?: Date;
  // New: Connection stability tracking
  consecutiveErrors: number;
  lastSuccessfulConnection?: Date;
  backoffDelay: number;
  isReconnecting: boolean;
  unsubscribe?: () => void;
  connectionStartTime?: Date;
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
 * Enhanced Subscription Manager for Supabase Real-time Features
 *
 * This class provides centralized management of Supabase real-time subscriptions with:
 * - Automatic cleanup and memory leak prevention
 * - Enhanced error handling with exponential backoff
 * - Token refresh integration for seamless auth updates
 * - Network state and visibility change handling
 * - Health monitoring and debugging utilities
 *
 * ## Key Features:
 *
 * ### Token Refresh Handling
 * - Automatically updates realtime auth tokens when refreshed
 * - Listens for 'TOKEN_REFRESHED' events from Supabase auth
 * - Calls `supabase.realtime.setAuth(newToken)` to maintain connections
 *
 * ### Network State Management
 * - Monitors online/offline events to trigger reconnection
 * - Handles visibility changes for mobile Safari backgrounding
 * - Automatically reconnects when network is restored
 *
 * ### Connection Stability
 * - Exponential backoff for failed connections (2s → 30s max)
 * - Global cooldown to prevent overwhelming the server
 * - Health scoring based on error rates and connection stability
 * - Automatic cleanup of stale connections and memory leaks
 *
 * ### Error Recovery
 * - Distinguishes between recoverable and unrecoverable errors
 * - Logs recoverable errors at warn/info level to reduce noise
 * - Attempts reconnection up to configurable retry limits
 * - Graceful degradation when max retries exceeded
 *
 * ## Usage:
 * ```typescript
 * const subscriptionManager = getSubscriptionManager();
 * const unsubscribe = subscriptionManager.subscribe('my-subscription', {
 *   table: 'messages',
 *   event: 'INSERT',
 *   filter: 'event_id=eq.123',
 *   callback: (payload) => console.log('New message:', payload),
 *   onError: (error) => console.error('Subscription error:', error),
 *   enableBackoff: true,
 *   maxRetries: 3
 * });
 * ```
 *
 * @since 2024-01 - Initial implementation
 * @since 2024-01 - Added token refresh integration and stability improvements
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

  // New: Global connection stability
  private globalConsecutiveErrors = 0;
  private lastGlobalReconnect = 0;
  private globalReconnectCooldown = RealtimeTunables.reconnectCooldownMs; // Reduced from 30s to 12s

  // Enhanced configuration - now using config module
  private readonly DEFAULT_TIMEOUT = RealtimeTunables.joinTimeoutFgMs; // 30 seconds (fallback)
  private readonly HEARTBEAT_INTERVAL = 15000; // 15 seconds
  private readonly MAX_RETRIES = 3;
  private readonly DEFAULT_BACKOFF_DELAY = 2000; // 2 seconds
  private readonly MAX_BACKOFF_DELAY = 30000; // 30 seconds
  private readonly CONNECTION_TIMEOUT = 15000; // 15 seconds

  // Cold reconnect state
  private consecutiveGlobalTimeouts = 0;
  private lastColdReconnect = 0;
  private suppressTimeoutLogging = false;
  private foregroundReconnectDebounce: NodeJS.Timeout | null = null;

  // Bound event handlers for proper cleanup
  private boundVisibilityHandler: (() => void) | null = null;
  private boundOnlineHandler: (() => void) | null = null;
  private boundOfflineHandler: (() => void) | null = null;

  constructor() {
    logger.realtime('🚀 Enhanced SubscriptionManager initialized');
    this.setupConnectionMonitoring();
    this.startHealthChecking();
  }

  /**
   * Get adaptive timeout based on document visibility state
   */
  private getAdaptiveTimeout(): number {
    if (!RealtimeFlags.adaptiveTimeout) {
      return this.DEFAULT_TIMEOUT;
    }
    
    return getAdaptiveTimeout();
  }

  /**
   * Log realtime error with normalization and sampling
   */
  private logRealtimeError(
    error: unknown,
    subscriptionId: string,
    phase: RTErrorContext['phase'],
    additionalContext?: Record<string, unknown>
  ): void {
    const subscription = this.subscriptions.get(subscriptionId);
    const ctx: RTErrorContext = {
      phase,
      channelKey: subscriptionId,
      state: subscription?.channel?.state || 'unknown',
    };

    if (!RealtimeFlags.quietConnectionErrors) {
      // Original behavior - always log as error
      logger.error(`❌ Subscription error: ${subscriptionId}`, { error, ...additionalContext });
      return;
    }

    // New behavior - normalize and sample
    const normalized = normalizeRealtimeError(error, ctx, { 
      max: RealtimeTunables.maxRawErrorLength 
    });

    const okToLog = shouldLog(
      normalized.key,
      Date.now(),
      RealtimeTunables.logSampleWindowMs,
      RealtimeTunables.logMaxPerWindow
    );

    if (okToLog) {
      const prefix = normalized.ignorable ? '⚠️' : '❌';
      const logMessage = `${prefix} ${normalized.summary}: ${subscriptionId}`;
      const logData = {
        kind: normalized.kind,
        ctx: normalized.ctx,
        raw: normalized.raw,
        ...additionalContext,
      };
      
      // Direct method calls to avoid binding issues
      if (normalized.ignorable) {
        logger.warn(logMessage, logData);
      } else {
        logger.error(logMessage, logData);
      }
    }
  }

  /**
   * Check if we should suppress timeout logging (e.g., during background)
   */
  private shouldSuppressTimeoutLogging(): boolean {
    return this.suppressTimeoutLogging && 
           typeof document !== 'undefined' && 
           document.hidden;
  }

  /**
   * Create a new subscription with enhanced timeout and retry management
   */
  public subscribe(
    subscriptionId: string,
    config: SubscriptionConfig,
  ): () => void {
    if (this.isDestroyed) {
      const warningMessage =
        '⚠️ Cannot create subscription: SubscriptionManager is destroyed - this may indicate an auth transition';
      const context = { subscriptionId, table: config.table };

      if (process.env.NODE_ENV === 'development') {
        // Enhanced dev warning with stack trace
        const stackTrace = new Error().stack
          ?.split('\n')
          .slice(1, 6)
          .join('\n');
        console.warn(
          `[realtime] subscribe() while destroyed; request ignored`,
          {
            id: subscriptionId,
            table: config.table,
            stack: stackTrace,
          },
        );

        // Emit telemetry with stack trace in dev
        emitSubscribeWhileDestroyed({
          subscriptionId,
          table: config.table,
          stackTrace,
        });
      } else {
        // Emit telemetry without stack trace in production
        emitSubscribeWhileDestroyed({
          subscriptionId,
          table: config.table,
        });
      }

      logger.warn(warningMessage, context);

      // Return a no-op unsubscribe function instead of throwing
      return () => {};
    }

    try {
      // Check if there's already an active subscription to prevent "subscribe multiple times" error
      const existingSubscription = this.subscriptions.get(subscriptionId);
      if (existingSubscription?.channel && existingSubscription.channel.state !== 'closed') {
        logger.realtime(`⚠️ Subscription ${subscriptionId} already exists with state: ${existingSubscription.channel.state}`);
        return existingSubscription.unsubscribe || (() => {});
      }

      // Clean up any existing subscription with the same ID
      this.cleanupExistingSubscription(subscriptionId);

      const startTime = Date.now();
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
            private: false,
          },
        })
        .on(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          'postgres_changes' as any,
          {
            event: config.event,
            schema: config.schema || 'public',
            table: config.table,
            filter: config.filter,
          },
          (
            payload: RealtimePostgresChangesPayload<
              Record<string, string | number | boolean | null>
            >,
          ) => {
            // Update last activity
            const subscription = this.subscriptions.get(subscriptionId);
            if (subscription) {
              subscription.lastActivity = new Date();
              subscription.consecutiveErrors = 0; // Reset error count on successful data
            }

            config.callback(payload);
          },
        );

      const adaptiveTimeout = config.timeoutMs || this.getAdaptiveTimeout();
      
      logger.realtime(`📡 Creating enhanced subscription: ${subscriptionId}`, {
        table: config.table,
        event: config.event,
        filter: config.filter,
        timeout: adaptiveTimeout,
        retryOnTimeout: config.retryOnTimeout ?? true,
        enableBackoff: config.enableBackoff ?? true,
        isBackground: typeof document !== 'undefined' && document.hidden,
      });

      // Enhanced subscription with adaptive timeout handling
      new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          // Suppress noisy timeout logs during background state
          if (!this.shouldSuppressTimeoutLogging()) {
            logger.warn(
              `⏰ Subscription timeout: ${subscriptionId} (${adaptiveTimeout}ms) - retrying connection`,
            );
          }

          // Track consecutive timeouts for cold reconnect
          this.consecutiveGlobalTimeouts++;

          // Emit timeout telemetry
          emitTimeout({
            subscriptionId,
            timeoutMs: adaptiveTimeout,
            isBackground: typeof document !== 'undefined' && document.hidden,
            consecutiveTimeouts: this.consecutiveGlobalTimeouts,
          });

          // Handle timeout based on config
          if (config.retryOnTimeout !== false) {
            this.handleSubscriptionTimeout(subscriptionId);
            resolve(); // Don't reject, let retry handle it
          } else {
            const timeoutError = new Error(
              `Subscription timeout: ${subscriptionId}`,
            );
            this.handleSubscriptionError(subscriptionId, timeoutError);
            reject(timeoutError);
          }
        }, adaptiveTimeout);

        // Subscribe with enhanced error handling
        channel.subscribe((status, error) => {
          clearTimeout(timeout);

          if (error) {
            this.logRealtimeError(error, subscriptionId, 'subscribe');
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
            logger.realtime(
              `✅ Subscription active: ${subscriptionId} (${connectionTime}ms)`,
            );
            config.onStatusChange?.('connected');
            this.connectionState = 'connected';

            // Reset retry count and error tracking on successful connection
            const subscription = this.subscriptions.get(subscriptionId);
            if (subscription) {
              subscription.retryCount = 0;
              subscription.connectionAttempts = 0;
              subscription.lastError = null;
              subscription.lastHeartbeat = new Date();
              subscription.lastSuccessfulConnection = new Date();
              subscription.consecutiveErrors = 0;
              subscription.isReconnecting = false;
              subscription.backoffDelay =
                config.enableBackoff !== false ? this.DEFAULT_BACKOFF_DELAY : 0;
              
              // Reset global timeout counter when any subscription succeeds
              this.consecutiveGlobalTimeouts = 0;
            }
          } else if (status === 'CHANNEL_ERROR') {
            // Use normalized error logging
            this.logRealtimeError(
              new Error(`Channel error: ${status}`),
              subscriptionId,
              'join'
            );
            this.handleSubscriptionError(
              subscriptionId,
              new Error(`Channel error: ${status}`),
            );
          } else if (status === 'TIMED_OUT') {
            logger.info(
              `⏰ Subscription timeout: ${subscriptionId} - will reconnect`,
            );
            this.handleSubscriptionTimeout(subscriptionId);
          } else if (status === 'CLOSED') {
            logger.realtime(`🔌 Subscription closed: ${subscriptionId}`);
            config.onStatusChange?.('disconnected');
          }
        });
      });

      // Store enhanced subscription info
      const unsubscribeFn = () => this.unsubscribe(subscriptionId);
      
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
        consecutiveErrors: 0,
        backoffDelay:
          config.enableBackoff !== false ? this.DEFAULT_BACKOFF_DELAY : 0,
        isReconnecting: false,
        connectionStartTime: new Date(),
        unsubscribe: unsubscribeFn,
      };

      this.subscriptions.set(subscriptionId, subscription);
      config.onStatusChange?.('connecting');

      // Return cleanup function
      return unsubscribeFn;
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
    if (!subscription) return;

    // Increment consecutive errors
    subscription.consecutiveErrors++;

    // Use exponential backoff for reconnection
    if (subscription.config.enableBackoff !== false) {
      subscription.backoffDelay = Math.min(
        subscription.backoffDelay * 1.5,
        subscription.config.maxBackoffDelay || this.MAX_BACKOFF_DELAY,
      );
    }

    // Only log timeout warnings for the first few attempts to reduce noise
    if (subscription.consecutiveErrors <= 2) {
      logger.warn(
        `⏰ Subscription timeout: ${subscriptionId} (attempt ${subscription.consecutiveErrors})`,
      );
    }

    // Don't attempt reconnection if we have too many consecutive errors
    if (subscription.consecutiveErrors > 5) {
      logger.error(
        `❌ Too many timeouts for ${subscriptionId}, pausing reconnection attempts`,
      );
      return;
    }

    // Schedule reconnection with backoff
    setTimeout(() => {
      if (!this.isDestroyed && subscription.isActive) {
        this.reconnectSubscription(subscriptionId);
      }
    }, subscription.backoffDelay);
  }

  /**
   * Reconnect a single subscription with stability checks
   */
  private reconnectSubscription(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription || subscription.isReconnecting) return;

    // Check if we're in a global error state
    if (this.globalConsecutiveErrors > 5) {
      const timeSinceLastGlobalReconnect =
        Date.now() - this.lastGlobalReconnect;
      if (timeSinceLastGlobalReconnect < this.globalReconnectCooldown) {
        logger.warn(
          `⏸️ Skipping reconnect for ${subscriptionId} due to global error state`,
        );
        return;
      }
    }

    subscription.isReconnecting = true;
    subscription.connectionAttempts++;

    logger.realtime(
      `🔄 Reconnecting subscription: ${subscriptionId} (attempt ${subscription.connectionAttempts})`,
    );

    // Clean up existing channel
    this.cleanupExistingSubscription(subscriptionId);

    // Recreate subscription
    setTimeout(() => {
      if (!this.isDestroyed && subscription.isActive) {
        try {
          this.subscribe(subscriptionId, subscription.config);
        } catch (error) {
          logger.error(
            `❌ Failed to reconnect subscription: ${subscriptionId}`,
            error,
          );
          subscription.isReconnecting = false;
        }
      }
    }, subscription.backoffDelay);
  }

  private cleanupExistingSubscription(subscriptionId: string): void {
    const existing = this.subscriptions.get(subscriptionId);
    if (existing?.channel) {
      try {
        // Add state check before cleanup to prevent race conditions
        if (existing.channel.state === 'joined') {
          existing.channel.unsubscribe();
          logger.realtime(`🔌 Unsubscribing: ${subscriptionId}`);
        } else {
          logger.realtime(`🔌 Skipping unsubscribe for ${subscriptionId} (state: ${existing.channel.state})`);
        }
      } catch (error) {
        logger.warn(`⚠️ Error during cleanup: ${subscriptionId}`, error);
      }
      
      // Clear the channel reference but keep the subscription metadata for reconnection
      existing.channel = null;
      existing.isActive = false;
      existing.isReconnecting = false;
      
      logger.realtime(`🧹 Cleaned up channel for ${subscriptionId}, keeping subscription metadata`);
    }
  }

  public unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return;

    logger.realtime(`🔌 Unsubscribing: ${subscriptionId}`);

    try {
      if (subscription.channel) {
        subscription.channel.unsubscribe();
        subscription.channel = null;
      }
      subscription.isActive = false;
      subscription.isReconnecting = false;

      logger.realtime(`✅ Channel removed: ${subscriptionId}`);
    } catch (error) {
      logger.warn(`⚠️ Error during unsubscribe: ${subscriptionId}`, error);
    }

    this.subscriptions.delete(subscriptionId);
    logger.realtime(`✅ Unsubscribed: ${subscriptionId}`);
  }

  public getStats(): SubscriptionStats {
    const now = Date.now();
    const uptime = now - this.startTime.getTime();
    const activeSubscriptions = Array.from(this.subscriptions.values()).filter(
      (sub) => sub.isActive,
    ).length;

    const avgConnectionTime =
      this.connectionTimes.length > 0
        ? this.connectionTimes.reduce((a, b) => a + b, 0) /
          this.connectionTimes.length
        : 0;

    const healthScore = this.calculateHealthScore();

    return {
      totalSubscriptions: this.subscriptions.size,
      activeSubscriptions,
      errorCount: this.errorCount,
      connectionState: this.connectionState,
      uptime,
      totalRetries: Array.from(this.subscriptions.values()).reduce(
        (sum, sub) => sum + sub.retryCount,
        0,
      ),
      recentErrors: Array.from(this.subscriptions.values()).reduce(
        (sum, sub) => sum + sub.consecutiveErrors,
        0,
      ),
      avgConnectionTime,
      healthScore,
      lastError: this.getLastError(),
    };
  }

  private calculateHealthScore(): number {
    if (this.subscriptions.size === 0) return 100;

    const activeSubscriptions = Array.from(this.subscriptions.values()).filter(
      (sub) => sub.isActive,
    ).length;

    if (activeSubscriptions === 0) return 0;

    // Base score from connection state
    let score = this.connectionState === 'connected' ? 80 : 40;

    // Deduct for errors
    const totalErrors = Array.from(this.subscriptions.values()).reduce(
      (sum, sub) => sum + sub.consecutiveErrors,
      0,
    );
    score -= Math.min(totalErrors * 5, 30);

    // Deduct for retries
    const totalRetries = Array.from(this.subscriptions.values()).reduce(
      (sum, sub) => sum + sub.retryCount,
      0,
    );
    score -= Math.min(totalRetries * 2, 20);

    // Bonus for stable connections
    const stableConnections = Array.from(this.subscriptions.values()).filter(
      (sub) =>
        sub.lastSuccessfulConnection &&
        Date.now() - sub.lastSuccessfulConnection.getTime() > 60000,
    ).length;
    score += Math.min(stableConnections * 5, 20);

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private getLastError(): SubscriptionStats['lastError'] {
    const subscriptionsWithErrors = Array.from(
      this.subscriptions.values(),
    ).filter((sub) => sub.lastError);

    if (subscriptionsWithErrors.length === 0) return null;

    const mostRecentError = subscriptionsWithErrors.reduce(
      (latest, current) => {
        if (!latest.lastError || !current.lastError) return latest;
        return current.lastError > latest.lastError ? current : latest;
      },
    );

    return {
      message: mostRecentError.lastError?.message || 'Unknown error',
      timestamp: mostRecentError.lastActivity || new Date(),
      subscriptionId: mostRecentError.id,
    };
  }

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
    const now = new Date();
    return Array.from(this.subscriptions.values()).map((sub) => {
      const uptime = now.getTime() - sub.createdAt.getTime();
      const errorCount = sub.consecutiveErrors;

      let healthStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (errorCount > 3) healthStatus = 'critical';
      else if (errorCount > 1) healthStatus = 'warning';

      return {
        id: sub.id,
        table: sub.config.table,
        event: sub.config.event,
        isActive: sub.isActive,
        createdAt: sub.createdAt,
        lastActivity: sub.lastActivity || sub.createdAt,
        lastHeartbeat: sub.lastHeartbeat,
        errorCount,
        connectionAttempts: sub.connectionAttempts,
        uptime,
        healthStatus,
      };
    });
  }

  public get destroyed(): boolean {
    return this.isDestroyed;
  }

  public destroy(): void {
    if (this.isDestroyed) return;

    logger.realtime('🧹 Destroying SubscriptionManager');

    this.isDestroyed = true;

    // Clear health check interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Clear any pending foreground reconnect debounce
    if (this.foregroundReconnectDebounce) {
      clearTimeout(this.foregroundReconnectDebounce);
      this.foregroundReconnectDebounce = null;
    }

    // Remove event listeners with proper bound references
    if (typeof document !== 'undefined' && this.boundVisibilityHandler) {
      document.removeEventListener('visibilitychange', this.boundVisibilityHandler);
      this.boundVisibilityHandler = null;
    }
    if (typeof window !== 'undefined') {
      if (this.boundOnlineHandler) {
        window.removeEventListener('online', this.boundOnlineHandler);
        this.boundOnlineHandler = null;
      }
      if (this.boundOfflineHandler) {
        window.removeEventListener('offline', this.boundOfflineHandler);
        this.boundOfflineHandler = null;
      }
    }

    // Unsubscribe from all channels
    const subscriptionIds = Array.from(this.subscriptions.keys());
    subscriptionIds.forEach((id) => this.unsubscribe(id));

    logger.realtime('✅ SubscriptionManager destroyed');
  }

  public reconnectAll(): void {
    if (this.isDestroyed) return;

    // Check if we should trigger cold reconnect instead
    if (this.shouldTriggerColdReconnect()) {
      this.performColdReconnect();
      return;
    }

    // Check global reconnect cooldown
    const timeSinceLastGlobalReconnect = Date.now() - this.lastGlobalReconnect;
    if (timeSinceLastGlobalReconnect < this.globalReconnectCooldown) {
      logger.warn(
        `⏸️ Skipping global reconnect due to cooldown (${Math.round((this.globalReconnectCooldown - timeSinceLastGlobalReconnect) / 1000)}s remaining)`,
      );
      return;
    }

    this.lastGlobalReconnect = Date.now();
    this.globalConsecutiveErrors++;

    logger.realtime('🔄 Reconnecting all subscriptions with enhanced logic');

    const subscriptions = Array.from(this.subscriptions.entries());
    const activeSubscriptions = subscriptions.filter(([, sub]) => sub.isActive);

    if (activeSubscriptions.length === 0) {
      logger.realtime('ℹ️ No active subscriptions to reconnect');
      return;
    }

    logger.realtime(
      `🔄 Reconnecting ${activeSubscriptions.length} active subscriptions`,
    );

    // Clean up all existing subscriptions
    activeSubscriptions.forEach(([id]) => this.unsubscribe(id));

    // Recreate all subscriptions with staggered timing to avoid overwhelming
    activeSubscriptions.forEach(([id, subscription], index) => {
      const delay = index * 500; // Increased delay to 500ms between reconnections
      setTimeout(() => {
        if (!this.isDestroyed) {
          logger.realtime(
            `🔄 Recreating subscription ${id} (${index + 1}/${activeSubscriptions.length})`,
          );
          this.subscribe(id, subscription.config);
        }
      }, delay);
    });
  }

  /**
   * Check if we should trigger cold reconnect based on consecutive failures
   */
  private shouldTriggerColdReconnect(): boolean {
    if (!RealtimeFlags.coldReconnect) return false;
    
    const timeSinceLastCold = Date.now() - this.lastColdReconnect;
    const hasEnoughFailures = this.consecutiveGlobalTimeouts >= RealtimeTunables.consecutiveTimeoutsForCold;
    const cooldownExpired = timeSinceLastCold > RealtimeTunables.coldReconnectCooldownMs;
    
    return hasEnoughFailures && cooldownExpired;
  }

  /**
   * Perform cold reconnect - destroy client and recreate with fresh token
   */
  private async performColdReconnect(): Promise<void> {
    if (this.isDestroyed) return;
    
    const startTime = Date.now();
    logger.realtime('🧊 Performing cold reconnect due to consecutive failures');
    this.lastColdReconnect = startTime;
    
    try {
      // Pause new reconnects briefly
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Store active subscriptions before destroying
      const subscriptions = Array.from(this.subscriptions.entries());
      const activeSubscriptions = subscriptions.filter(([, sub]) => sub.isActive);
      
      if (activeSubscriptions.length === 0) {
        logger.realtime('ℹ️ No active subscriptions for cold reconnect');
        emitColdReconnect({
          reason: 'no_active_subscriptions',
          subscriptionCount: 0,
          duration: Date.now() - startTime,
          success: true,
        });
        return;
      }
      
      // Clean up all existing subscriptions
      activeSubscriptions.forEach(([id]) => this.unsubscribe(id));
      
      // Get fresh token from auth
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        supabase.realtime.setAuth(session.access_token);
        logger.realtime('✅ Fresh token applied during cold reconnect');
      }
      
      // Reset failure counters
      this.consecutiveGlobalTimeouts = 0;
      this.globalConsecutiveErrors = 0;
      
      // Recreate subscriptions (single coordinated attempt)
      logger.realtime(`🔄 Cold reconnect: recreating ${activeSubscriptions.length} subscriptions`);
      
      for (const [id, subscription] of activeSubscriptions) {
        if (!this.isDestroyed) {
          this.subscribe(id, subscription.config);
          // Small delay between subscriptions to avoid overwhelming
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      logger.realtime('✅ Cold reconnect completed');
      
      // Emit successful cold reconnect telemetry
      emitColdReconnect({
        reason: 'consecutive_timeouts',
        subscriptionCount: activeSubscriptions.length,
        duration: Date.now() - startTime,
        success: true,
      });
      
    } catch (error) {
      logger.error('❌ Cold reconnect failed', error);
      
      // Emit failed cold reconnect telemetry
      emitColdReconnect({
        reason: 'consecutive_timeouts',
        subscriptionCount: this.subscriptions.size,
        duration: Date.now() - startTime,
        success: false,
      });
      
      // Fall back to regular reconnect logic
      this.reconnectAll();
    }
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
      logger.error(
        `❌ Cannot handle error for unknown subscription: ${subscriptionId}`,
        error,
      );
      return;
    }

    // Convert to Error if needed
    const normalizedError =
      error instanceof Error
        ? error
        : new Error(error.message || 'Unknown subscription error');

    // Update subscription error state
    subscription.lastError = normalizedError;
    subscription.retryCount = (subscription.retryCount || 0) + 1;
    subscription.consecutiveErrors++;

    // Update global error tracking
    this.globalConsecutiveErrors++;

    // Log errors appropriately based on recoverability
    const isRecoverableError =
      subscription.retryCount <
      (subscription.config.maxRetries || this.MAX_RETRIES);
    // Use normalized error logging instead of direct logger call
    this.logRealtimeError(normalizedError, subscriptionId, 'message', {
      retryCount: subscription.retryCount,
      consecutiveErrors: subscription.consecutiveErrors,
      subscriptionAge: Date.now() - subscription.createdAt.getTime(),
      lastActivity: subscription.lastActivity?.toISOString(),
      table: subscription.config.table,
      filter: subscription.config.filter,
      isRecoverable: isRecoverableError,
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
      logger.error(
        `❌ Max retries exceeded for ${subscriptionId}, cleaning up`,
      );
      this.unsubscribe(subscriptionId);
    } else if (subscription.consecutiveErrors <= 3) {
      // Only attempt reconnection for reasonable error counts
      logger.info(
        `🔄 Attempting recovery for ${subscriptionId} (retry ${subscription.retryCount + 1}/${maxRetries})`,
      );
      this.reconnectSubscription(subscriptionId);
    }
  }

  /**
   * Enhanced connection monitoring with conditional token refresh integration
   * Note: Auth state changes are now handled by SubscriptionProvider when singleTokenAuthority is enabled
   */
  private setupConnectionMonitoring(): void {
    // Monitor token refresh events only when not using single token authority
    if (!RealtimeFlags.singleTokenAuthority) {
      supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'TOKEN_REFRESHED' && session) {
          // Critical: Update realtime connection with new token
          logger.realtime('🔄 Token refreshed, updating realtime auth (Manager)');
          this.updateRealtimeAuth(session.access_token);
        }
      });
    } else {
      logger.realtime('🔄 Single token authority enabled - Manager will not handle token refresh');
    }

    // Monitor visibility changes for mobile Safari backgrounding
    if (typeof document !== 'undefined') {
      this.boundVisibilityHandler = this.handleVisibilityChange.bind(this);
      document.addEventListener('visibilitychange', this.boundVisibilityHandler);
    }

    // Monitor online/offline events
    if (typeof window !== 'undefined') {
      this.boundOnlineHandler = this.handleOnlineStateChange.bind(this);
      this.boundOfflineHandler = this.handleOnlineStateChange.bind(this);
      window.addEventListener('online', this.boundOnlineHandler);
      window.addEventListener('offline', this.boundOfflineHandler);
    }
  }

  /**
   * Update realtime connection with new auth token
   */
  private updateRealtimeAuth(accessToken: string): void {
    try {
      // Update the realtime connection with the new token
      supabase.realtime.setAuth(accessToken);
      logger.realtime('✅ Realtime auth token updated');
    } catch (error) {
      logger.error('❌ Failed to update realtime auth token', error);
    }
  }

  /**
   * Handle visibility changes (mobile Safari backgrounding) with adaptive behavior
   */
  private handleVisibilityChange(): void {
    if (typeof document === 'undefined') return;

    if (document.hidden) {
      logger.realtime('📱 Tab backgrounded, enabling adaptive timeout mode');
      // Enable timeout logging suppression for background state
      if (RealtimeFlags.adaptiveTimeout) {
        this.suppressTimeoutLogging = true;
      }
      // Modern browsers handle WebSocket suspension automatically
    } else {
      logger.realtime('📱 Tab foregrounded, checking connection health');
      // Disable timeout logging suppression
      this.suppressTimeoutLogging = false;
      
      // Clear any existing debounce
      if (this.foregroundReconnectDebounce) {
        clearTimeout(this.foregroundReconnectDebounce);
      }
      
      // Single debounced health check and reconnect if needed
      this.foregroundReconnectDebounce = setTimeout(() => {
        const stats = this.getStats();
        if (stats.healthScore < 50 && stats.activeSubscriptions > 0) {
          logger.realtime(
            '🔄 Poor health after backgrounding, triggering single reconnect',
          );
          this.reconnectAll();
        }
        this.foregroundReconnectDebounce = null;
      }, RealtimeTunables.foregroundReconnectDelayMs);
    }
  }

  /**
   * Handle online/offline state changes
   */
  private handleOnlineStateChange(): void {
    if (typeof navigator === 'undefined') return;

    if (navigator.onLine) {
      logger.realtime('🌐 Back online, checking connection health');
      // Trigger reconnection after coming back online
      setTimeout(() => {
        const stats = this.getStats();
        if (
          stats.activeSubscriptions > 0 &&
          stats.connectionState !== 'connected'
        ) {
          logger.realtime('🔄 Reconnecting after coming back online');
          this.reconnectAll();
        }
      }, 1000);
    } else {
      logger.realtime('🌐 Gone offline, subscriptions may be affected');
    }
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

      // Log health check only when there are issues or every 5 minutes
      const shouldLogHealth =
        stats.healthScore < 80 ||
        stats.errorCount > 5 ||
        Date.now() % (5 * 60 * 1000) < this.HEARTBEAT_INTERVAL; // Every 5 minutes

      if (shouldLogHealth) {
        logger.realtime('💓 Enhanced health check', {
          activeSubscriptions: stats.activeSubscriptions,
          connectionState: stats.connectionState,
          errorCount: stats.errorCount,
          healthScore: stats.healthScore,
          avgConnectionTime: Math.round(stats.avgConnectionTime),
        });
      }

      // Check for unhealthy subscriptions
      const unhealthySubscriptions = details.filter(
        (s) => s.healthStatus === 'critical',
      );
      if (unhealthySubscriptions.length > 0) {
        logger.error(
          `⚠️ ${unhealthySubscriptions.length} critical subscriptions detected`,
          {
            subscriptions: unhealthySubscriptions.map((s) => ({
              id: s.id,
              table: s.table,
              errorCount: s.errorCount,
              uptime: s.uptime,
            })),
          },
        );
      }

      // Only trigger reconnect if health score is very low and we haven't recently reconnected
      if (stats.healthScore < 25 && stats.activeSubscriptions > 0) {
        const timeSinceLastGlobalReconnect =
          Date.now() - this.lastGlobalReconnect;
        if (timeSinceLastGlobalReconnect > this.globalReconnectCooldown) {
          logger.error(
            `🚨 Health score critically low (${stats.healthScore}), triggering reconnect`,
          );
          this.reconnectAll();
        } else {
          logger.warn(
            `⏸️ Health score low (${stats.healthScore}) but reconnect cooldown active`,
          );
        }
      }

      // Log warning if we have many errors
      if (stats.errorCount > 10) {
        logger.error(
          `⚠️ High error count detected: ${stats.errorCount} errors`,
        );
      }

      // Reset error counters immediately when stability is restored
      if (stats.healthScore > 80 && (this.globalConsecutiveErrors > 0 || this.consecutiveGlobalTimeouts > 0)) {
        this.globalConsecutiveErrors = 0;
        this.consecutiveGlobalTimeouts = 0; // Also reset timeout counter
        logger.realtime(
          '✅ Connection stability restored, resetting all error counters',
        );
      }

      // Perform memory cleanup
      this.cleanupMemoryLeaks();
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

      const checkStatus = () => {
        if (channel.state === 'joined') {
          clearTimeout(timeout);
          resolve();
        } else if (channel.state === 'errored') {
          clearTimeout(timeout);
          reject(new Error('Connection failed'));
        } else {
          setTimeout(checkStatus, 100);
        }
      };

      checkStatus();
    });
  }

  /**
   * Clean up memory leaks by removing old connection times and error references
   * Uses adaptive cleanup interval based on environment
   */
  private cleanupMemoryLeaks(): void {
    // Keep only last 10 connection times to prevent memory buildup
    if (this.connectionTimes.length > 10) {
      this.connectionTimes = this.connectionTimes.slice(-10);
    }

    // Clear old error references from subscriptions with adaptive timing
    const now = Date.now();
    const cleanupThreshold = getCleanupInterval();
    
    Array.from(this.subscriptions.values()).forEach((subscription) => {
      if (subscription.lastError && subscription.lastActivity) {
        const timeSinceError = now - subscription.lastActivity.getTime();
        if (timeSinceError > cleanupThreshold) {
          subscription.lastError = null;
        }
      }
    });
  }
}

// Legacy singleton instance - deprecated in favor of SubscriptionProvider
let subscriptionManager: SubscriptionManager | null = null;

/**
 * @deprecated Use SubscriptionProvider and useSubscriptionManager hook instead
 * This function is kept for backward compatibility only
 */
export function getSubscriptionManager(): SubscriptionManager {
  logger.warn(
    '⚠️ getSubscriptionManager() is deprecated - use SubscriptionProvider and useSubscriptionManager hook instead',
  );
  if (!subscriptionManager) {
    subscriptionManager = new SubscriptionManager();
  }
  return subscriptionManager;
}

/**
 * @deprecated Use SubscriptionProvider lifecycle instead
 */
export function destroySubscriptionManager(): void {
  logger.warn(
    '⚠️ destroySubscriptionManager() is deprecated - use SubscriptionProvider lifecycle instead',
  );
  if (subscriptionManager) {
    subscriptionManager.destroy();
    subscriptionManager = null;
  }
}
