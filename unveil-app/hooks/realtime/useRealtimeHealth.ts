import { useState, useEffect, useCallback } from 'react';
import { useSubscriptionManager } from '@/lib/realtime/SubscriptionProvider';
import { type SubscriptionStats } from '@/lib/realtime/SubscriptionManager';
import { logger } from '@/lib/logger';

/**
 * Realtime Health Monitoring Hook
 *
 * Provides lightweight monitoring of realtime connection health.
 * Currently used only in development, but designed to be production-ready
 * for future telemetry integration.
 */

export interface RealtimeHealthMetrics {
  /** Overall health score (0-100) */
  healthScore: number;
  /** Number of active subscriptions */
  activeSubscriptions: number;
  /** Current connection state */
  connectionState: 'connected' | 'disconnected' | 'connecting' | 'error';
  /** Total error count */
  errorCount: number;
  /** Recent error count (last 5 minutes) */
  recentErrors: number;
  /** Average connection time in milliseconds */
  avgConnectionTime: number;
  /** Uptime in milliseconds */
  uptime: number;
  /** Last error information */
  lastError: {
    message: string;
    timestamp: Date;
    subscriptionId?: string;
  } | null;
  /** Whether monitoring is enabled */
  isMonitoring: boolean;
}

export interface UseRealtimeHealthOptions {
  /** Enable health monitoring (default: development only) */
  enabled?: boolean;
  /** Update interval in milliseconds (default: 5000) */
  updateInterval?: number;
  /** Enable console logging of health changes */
  enableLogging?: boolean;
}

export interface UseRealtimeHealthReturn {
  /** Current health metrics */
  health: RealtimeHealthMetrics;
  /** Manually refresh health metrics */
  refreshHealth: () => void;
  /** Force reconnect all subscriptions */
  reconnectAll: () => void;
  /** Get detailed subscription information */
  getSubscriptionDetails: () => Array<{
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
  }>;
}

/**
 * Hook for monitoring realtime connection health
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   const { health, refreshHealth } = useRealtimeHealth({
 *     enabled: process.env.NODE_ENV === 'development',
 *     enableLogging: true
 *   });
 *
 *   if (health.healthScore < 50) {
 *     console.warn('Poor realtime health:', health);
 *   }
 *
 *   return <div>Health: {health.healthScore}%</div>;
 * }
 * ```
 */
export function useRealtimeHealth({
  enabled = process.env.NODE_ENV === 'development',
  updateInterval = 5000,
  enableLogging = process.env.NODE_ENV === 'development',
}: UseRealtimeHealthOptions = {}): UseRealtimeHealthReturn {
  const [health, setHealth] = useState<RealtimeHealthMetrics>({
    healthScore: 100,
    activeSubscriptions: 0,
    connectionState: 'disconnected',
    errorCount: 0,
    recentErrors: 0,
    avgConnectionTime: 0,
    uptime: 0,
    lastError: null,
    isMonitoring: enabled,
  });

  const { manager } = useSubscriptionManager();

  const refreshHealth = useCallback(() => {
    if (!enabled || !manager) return;

    try {
      const stats: SubscriptionStats = manager.getStats();

      const newHealth: RealtimeHealthMetrics = {
        healthScore: stats.healthScore,
        activeSubscriptions: stats.activeSubscriptions,
        connectionState: stats.connectionState,
        errorCount: stats.errorCount,
        recentErrors: stats.recentErrors,
        avgConnectionTime: stats.avgConnectionTime,
        uptime: stats.uptime,
        lastError: stats.lastError,
        isMonitoring: enabled,
      };

      setHealth((prevHealth) => {
        // Log significant health changes
        if (enableLogging) {
          const healthChanged =
            prevHealth.healthScore !== newHealth.healthScore;
          const connectionChanged =
            prevHealth.connectionState !== newHealth.connectionState;
          const errorsIncreased = newHealth.errorCount > prevHealth.errorCount;

          if (
            healthChanged &&
            Math.abs(prevHealth.healthScore - newHealth.healthScore) > 10
          ) {
            logger.info(
              `📊 Realtime health changed: ${prevHealth.healthScore}% → ${newHealth.healthScore}%`,
            );
          }

          if (connectionChanged) {
            logger.info(
              `🔌 Realtime connection: ${prevHealth.connectionState} → ${newHealth.connectionState}`,
            );
          }

          if (errorsIncreased) {
            logger.warn(
              `⚠️ Realtime errors increased: ${prevHealth.errorCount} → ${newHealth.errorCount}`,
            );
          }
        }

        return newHealth;
      });
    } catch (error) {
      if (enableLogging) {
        logger.error('Failed to refresh realtime health metrics', error);
      }
    }
  }, [enabled, enableLogging, manager]);

  const reconnectAll = useCallback(() => {
    if (!enabled || !manager) return;

    try {
      manager.reconnectAll();

      if (enableLogging) {
        logger.info('🔄 Manually triggered realtime reconnect');
      }

      // Refresh health after reconnect attempt
      setTimeout(refreshHealth, 2000);
    } catch (error) {
      if (enableLogging) {
        logger.error('Failed to reconnect realtime subscriptions', error);
      }
    }
  }, [enabled, enableLogging, refreshHealth, manager]);

  const getSubscriptionDetails = useCallback(() => {
    if (!enabled || !manager) return [];

    try {
      return manager.getSubscriptionDetails();
    } catch (error) {
      if (enableLogging) {
        logger.error('Failed to get subscription details', error);
      }
      return [];
    }
  }, [enabled, enableLogging, manager]);

  // Set up periodic health monitoring
  useEffect(() => {
    if (!enabled) return;

    // Initial health check
    refreshHealth();

    // Set up interval for periodic updates
    const interval = setInterval(refreshHealth, updateInterval);

    return () => clearInterval(interval);
  }, [enabled, updateInterval, refreshHealth]);

  return {
    health,
    refreshHealth,
    reconnectAll,
    getSubscriptionDetails,
  };
}

/**
 * Lightweight health check function for telemetry integration
 *
 * @example
 * ```typescript
 * // For future telemetry integration
 * const healthSnapshot = getRealtimeHealthSnapshot();
 * await sendTelemetry('realtime_health', healthSnapshot);
 * ```
 */
export function getRealtimeHealthSnapshot(): Pick<
  RealtimeHealthMetrics,
  'healthScore' | 'activeSubscriptions' | 'connectionState' | 'errorCount'
> {
  try {
    const { manager: subscriptionManager } = useSubscriptionManager();
    if (!subscriptionManager)
      throw new Error('SubscriptionManager not available');
    const stats = subscriptionManager.getStats();

    return {
      healthScore: stats.healthScore,
      activeSubscriptions: stats.activeSubscriptions,
      connectionState: stats.connectionState,
      errorCount: stats.errorCount,
    };
  } catch (error) {
    logger.error('Failed to get realtime health snapshot', error);
    return {
      healthScore: 0,
      activeSubscriptions: 0,
      connectionState: 'error',
      errorCount: 1,
    };
  }
}

/**
 * Hook for basic realtime connection status (lightweight version)
 *
 * Use this for simple connection status indicators without full health monitoring.
 */
export function useRealtimeConnectionStatus(): {
  isConnected: boolean;
  connectionState: RealtimeHealthMetrics['connectionState'];
} {
  const [connectionState, setConnectionState] =
    useState<RealtimeHealthMetrics['connectionState']>('disconnected');

  useEffect(() => {
    const updateConnectionState = () => {
      try {
        const { manager: subscriptionManager } = useSubscriptionManager();
        if (!subscriptionManager) return;
        const stats = subscriptionManager.getStats();
        setConnectionState(stats.connectionState);
      } catch (error) {
        setConnectionState('error');
      }
    };

    updateConnectionState();
    const interval = setInterval(updateConnectionState, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, []);

  return {
    isConnected: connectionState === 'connected',
    connectionState,
  };
}
