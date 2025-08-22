/**
 * Realtime Telemetry - Metrics and Breadcrumbs
 *
 * Emits telemetry events for realtime subscription management.
 * Currently logs to console in development, ready for production telemetry integration.
 */

import { logger } from '@/lib/logger';

interface TelemetryEvent {
  event: string;
  data?: Record<string, unknown>;
  timestamp?: Date;
}

interface TokenRefreshMetric {
  success: boolean;
  duration?: number;
  error?: string;
  userId?: string;
}

interface ManagerReinitMetric {
  version: number;
  reason: 'sign_in' | 'sign_out' | 'error';
  userId?: string;
  hadPreviousManager: boolean;
}

interface SubscribeWhileDestroyedMetric {
  subscriptionId: string;
  table: string;
  stackTrace?: string;
}

/**
 * Emit telemetry events for realtime operations
 */
class RealtimeTelemetry {
  private isProduction = process.env.NODE_ENV === 'production';
  private isDevelopment = process.env.NODE_ENV === 'development';

  /**
   * Emit token refresh success/failure metrics
   */
  tokenRefresh(metric: TokenRefreshMetric): void {
    const event = metric.success
      ? 'realtime.token_refresh.success'
      : 'realtime.token_refresh.fail';

    this.emit({
      event,
      data: {
        duration: metric.duration,
        error: metric.error,
        userId: metric.userId,
      },
    });

    if (this.isDevelopment) {
      const status = metric.success ? '✅' : '❌';
      logger.realtime(
        `${status} Token refresh ${metric.success ? 'succeeded' : 'failed'}`,
        metric,
      );
    }
  }

  /**
   * Emit manager re-initialization metrics
   */
  managerReinit(metric: ManagerReinitMetric): void {
    this.emit({
      event: 'realtime.manager.reinit',
      data: {
        version: metric.version,
        reason: metric.reason,
        userId: metric.userId,
        hadPreviousManager: metric.hadPreviousManager,
      },
    });

    if (this.isDevelopment) {
      logger.realtime(`🔄 Manager reinit v${metric.version}`, {
        reason: metric.reason,
        hadPrevious: metric.hadPreviousManager,
      });
    }
  }

  /**
   * Emit subscribe-while-destroyed breadcrumb
   */
  subscribeWhileDestroyed(metric: SubscribeWhileDestroyedMetric): void {
    this.emit({
      event: 'realtime.subscribe.whileDestroyed',
      data: {
        subscriptionId: metric.subscriptionId,
        table: metric.table,
        stackTrace: metric.stackTrace,
      },
    });

    if (this.isDevelopment) {
      logger.warn(`⚠️ Subscribe while destroyed`, {
        id: metric.subscriptionId,
        table: metric.table,
      });
    }
  }

  /**
   * Generic telemetry emission
   */
  private emit(telemetryEvent: TelemetryEvent): void {
    const event = {
      ...telemetryEvent,
      timestamp: telemetryEvent.timestamp || new Date(),
    };

    if (this.isProduction) {
      // TODO: Replace with actual telemetry service
      // Examples:
      // - Sentry breadcrumb: Sentry.addBreadcrumb({ message: event.event, data: event.data })
      // - DataDog: StatsD.increment(event.event, 1, event.data)
      // - PostHog: posthog.capture(event.event, event.data)
      // - Custom analytics: analytics.track(event.event, event.data)

      console.log('[TELEMETRY]', event);
    } else if (this.isDevelopment) {
      // Development logging
      logger.info(`📊 [TELEMETRY] ${event.event}`, event.data);
    }
  }
}

// Singleton instance
export const realtimeTelemetry = new RealtimeTelemetry();

// Convenience exports
export const emitTokenRefreshSuccess = (
  data: Omit<TokenRefreshMetric, 'success'>,
) => realtimeTelemetry.tokenRefresh({ ...data, success: true });

export const emitTokenRefreshFailure = (
  data: Omit<TokenRefreshMetric, 'success'>,
) => realtimeTelemetry.tokenRefresh({ ...data, success: false });

export const emitManagerReinit = (data: ManagerReinitMetric) =>
  realtimeTelemetry.managerReinit(data);

export const emitSubscribeWhileDestroyed = (
  data: SubscribeWhileDestroyedMetric,
) => realtimeTelemetry.subscribeWhileDestroyed(data);
