/**
 * Auth Flow Reliability Monitoring
 *
 * Google-level monitoring, alerting, and diagnostics for authentication flows.
 * Provides real-time insights and automated failure detection.
 */

import { logger } from '@/lib/logger';

interface AuthMetric {
  timestamp: number;
  event: string;
  success: boolean;
  duration: number;
  userAgent?: string;
  errorType?: string;
  retryCount?: number;
  metadata?: Record<string, unknown>;
}

interface AuthFlowMetrics {
  otpSendSuccess: number;
  otpSendFailure: number;
  otpVerifySuccess: number;
  otpVerifyFailure: number;
  sessionSyncSuccess: number;
  sessionSyncFailure: number;
  middlewareRedirects: number;
  pageFlickerEvents: number;
  averageSessionSyncTime: number;
  p95SessionSyncTime: number;
  errorRate: number;
}

interface AlertThresholds {
  errorRatePercent: number;
  sessionSyncTimeMs: number;
  pageFlickerCount: number;
  middlewareRedirectRate: number;
}

class AuthReliabilityMonitor {
  private metrics: AuthMetric[] = [];
  private readonly maxMetricsHistory = 10000;
  private readonly alertThresholds: AlertThresholds = {
    errorRatePercent: 5, // Alert if > 5% error rate
    sessionSyncTimeMs: 3000, // Alert if session sync > 3s
    pageFlickerCount: 10, // Alert if > 10 flicker events per hour
    middlewareRedirectRate: 20, // Alert if > 20% middleware redirects
  };

  /**
   * Record an auth event metric
   */
  recordEvent(
    event: string,
    success: boolean,
    duration: number,
    metadata?: Record<string, unknown>,
  ): void {
    const metric: AuthMetric = {
      timestamp: Date.now(),
      event,
      success,
      duration,
      userAgent:
        typeof window !== 'undefined' ? navigator.userAgent : undefined,
      errorType: metadata?.errorType as string,
      retryCount: metadata?.retryCount as number,
      metadata,
    };

    this.metrics.push(metric);

    // Maintain sliding window
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }

    // Log for external monitoring systems
    logger.info('Auth flow metric recorded', metric);

    // Check for immediate alerts
    this.checkAlerts(metric);
  }

  /**
   * Get current auth flow health metrics
   */
  getHealthMetrics(timeWindowMs: number = 3600000): AuthFlowMetrics {
    const cutoff = Date.now() - timeWindowMs;
    const recentMetrics = this.metrics.filter((m) => m.timestamp > cutoff);

    const otpSendMetrics = recentMetrics.filter((m) => m.event === 'otp_send');
    const otpVerifyMetrics = recentMetrics.filter(
      (m) => m.event === 'otp_verify',
    );
    const sessionSyncMetrics = recentMetrics.filter(
      (m) => m.event === 'session_sync',
    );
    const middlewareMetrics = recentMetrics.filter(
      (m) => m.event === 'middleware_redirect',
    );
    const flickerMetrics = recentMetrics.filter(
      (m) => m.event === 'page_flicker',
    );

    const sessionSyncTimes = sessionSyncMetrics
      .filter((m) => m.success)
      .map((m) => m.duration)
      .sort((a, b) => a - b);

    const totalEvents = recentMetrics.length;
    const failedEvents = recentMetrics.filter((m) => !m.success).length;

    return {
      otpSendSuccess: otpSendMetrics.filter((m) => m.success).length,
      otpSendFailure: otpSendMetrics.filter((m) => !m.success).length,
      otpVerifySuccess: otpVerifyMetrics.filter((m) => m.success).length,
      otpVerifyFailure: otpVerifyMetrics.filter((m) => !m.success).length,
      sessionSyncSuccess: sessionSyncMetrics.filter((m) => m.success).length,
      sessionSyncFailure: sessionSyncMetrics.filter((m) => !m.success).length,
      middlewareRedirects: middlewareMetrics.length,
      pageFlickerEvents: flickerMetrics.length,
      averageSessionSyncTime:
        sessionSyncTimes.length > 0
          ? sessionSyncTimes.reduce((sum, time) => sum + time, 0) /
            sessionSyncTimes.length
          : 0,
      p95SessionSyncTime:
        sessionSyncTimes.length > 0
          ? sessionSyncTimes[Math.floor(sessionSyncTimes.length * 0.95)] || 0
          : 0,
      errorRate: totalEvents > 0 ? (failedEvents / totalEvents) * 100 : 0,
    };
  }

  /**
   * Check for alert conditions
   */
  private checkAlerts(metric: AuthMetric): void {
    const metrics = this.getHealthMetrics();

    // Error rate alert
    if (metrics.errorRate > this.alertThresholds.errorRatePercent) {
      this.triggerAlert('HIGH_ERROR_RATE', {
        currentRate: metrics.errorRate,
        threshold: this.alertThresholds.errorRatePercent,
        recentEvent: metric,
      });
    }

    // Session sync time alert
    if (
      metric.event === 'session_sync' &&
      metric.success &&
      metric.duration > this.alertThresholds.sessionSyncTimeMs
    ) {
      this.triggerAlert('SLOW_SESSION_SYNC', {
        duration: metric.duration,
        threshold: this.alertThresholds.sessionSyncTimeMs,
        metadata: metric.metadata,
      });
    }

    // Page flicker alert
    if (metrics.pageFlickerEvents > this.alertThresholds.pageFlickerCount) {
      this.triggerAlert('EXCESSIVE_PAGE_FLICKER', {
        flickerCount: metrics.pageFlickerEvents,
        threshold: this.alertThresholds.pageFlickerCount,
      });
    }

    // Middleware redirect rate alert
    const totalAuthEvents =
      metrics.otpSendSuccess +
      metrics.otpSendFailure +
      metrics.otpVerifySuccess +
      metrics.otpVerifyFailure;
    const redirectRate =
      totalAuthEvents > 0
        ? (metrics.middlewareRedirects / totalAuthEvents) * 100
        : 0;

    if (redirectRate > this.alertThresholds.middlewareRedirectRate) {
      this.triggerAlert('HIGH_MIDDLEWARE_REDIRECT_RATE', {
        redirectRate,
        threshold: this.alertThresholds.middlewareRedirectRate,
      });
    }
  }

  /**
   * Trigger an alert (integrate with external alerting systems)
   */
  private triggerAlert(alertType: string, data: Record<string, unknown>): void {
    const alert = {
      type: alertType,
      timestamp: Date.now(),
      severity: this.getAlertSeverity(alertType),
      data,
      environment: process.env.NODE_ENV,
    };

    logger.error('Auth reliability alert triggered', alert);

    // In production, this would integrate with:
    // - PagerDuty for critical alerts
    // - Slack for warnings
    // - DataDog/NewRelic for metrics
    // - Custom webhook endpoints

    if (process.env.NODE_ENV === 'production') {
      this.sendToAlertingSystem(alert);
    }
  }

  /**
   * Determine alert severity
   */
  private getAlertSeverity(alertType: string): 'critical' | 'warning' | 'info' {
    const criticalAlerts = ['HIGH_ERROR_RATE', 'EXCESSIVE_PAGE_FLICKER'];
    const warningAlerts = [
      'SLOW_SESSION_SYNC',
      'HIGH_MIDDLEWARE_REDIRECT_RATE',
    ];

    if (criticalAlerts.includes(alertType)) return 'critical';
    if (warningAlerts.includes(alertType)) return 'warning';
    return 'info';
  }

  /**
   * Send alert to external systems (stub for production integration)
   */
  private async sendToAlertingSystem(
    alert: Record<string, unknown>,
  ): Promise<void> {
    // Log the alert for development
    if (process.env.NODE_ENV === 'development') {
      console.debug('Alert would be sent to external systems:', alert);
    }

    // Production implementation would include:
    // 1. PagerDuty for critical alerts
    // await fetch('https://events.pagerduty.com/v2/enqueue', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     routing_key: process.env.PAGERDUTY_ROUTING_KEY,
    //     event_action: 'trigger',
    //     dedup_key: `auth-${alert.type}-${Date.now()}`,
    //     payload: {
    //       summary: `Auth reliability alert: ${alert.type}`,
    //       severity: alert.severity,
    //       source: 'unveil-auth-monitor',
    //       custom_details: alert.data,
    //     },
    //   }),
    // });
    // 2. Slack notifications
    // await fetch(process.env.SLACK_WEBHOOK_URL, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     text: `🚨 Auth Alert: ${alert.type}`,
    //     attachments: [{
    //       color: alert.severity === 'critical' ? 'danger' : 'warning',
    //       fields: Object.entries(alert.data).map(([key, value]) => ({
    //         title: key,
    //         value: String(value),
    //         short: true,
    //       })),
    //     }],
    //   }),
    // });
    // 3. Metrics systems
    // await this.sendToDataDog(alert);
    // await this.sendToNewRelic(alert);
  }

  /**
   * Generate health report for dashboards
   */
  generateHealthReport(): {
    status: 'healthy' | 'degraded' | 'critical';
    metrics: AuthFlowMetrics;
    recommendations: string[];
  } {
    const metrics = this.getHealthMetrics();
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    const recommendations: string[] = [];

    // Determine overall health status
    if (metrics.errorRate > 10 || metrics.pageFlickerEvents > 20) {
      status = 'critical';
      recommendations.push(
        'Immediate attention required: High error rate or page flicker',
      );
    } else if (metrics.errorRate > 5 || metrics.p95SessionSyncTime > 3000) {
      status = 'degraded';
      recommendations.push('Performance degradation detected: Monitor closely');
    }

    // Specific recommendations
    if (metrics.p95SessionSyncTime > 2000) {
      recommendations.push(
        'Session sync times are high - check network latency and server performance',
      );
    }

    if (metrics.pageFlickerEvents > 5) {
      recommendations.push(
        'Page flicker detected - review client-side routing logic',
      );
    }

    if (metrics.errorRate > 3) {
      recommendations.push(
        'Error rate elevated - review recent deployments and error logs',
      );
    }

    return { status, metrics, recommendations };
  }

  /**
   * Reset metrics (for testing)
   */
  reset(): void {
    this.metrics = [];
  }
}

// Global monitor instance
export const authReliabilityMonitor = new AuthReliabilityMonitor();

/**
 * Convenience functions for common events
 */
export const recordOTPSend = (
  success: boolean,
  duration: number,
  metadata?: Record<string, unknown>,
) => {
  authReliabilityMonitor.recordEvent('otp_send', success, duration, metadata);
};

export const recordOTPVerify = (
  success: boolean,
  duration: number,
  metadata?: Record<string, unknown>,
) => {
  authReliabilityMonitor.recordEvent('otp_verify', success, duration, metadata);
};

export const recordSessionSync = (
  success: boolean,
  duration: number,
  metadata?: Record<string, unknown>,
) => {
  authReliabilityMonitor.recordEvent(
    'session_sync',
    success,
    duration,
    metadata,
  );
};

export const recordPageFlicker = () => {
  authReliabilityMonitor.recordEvent('page_flicker', false, 0, {
    userAgent: typeof window !== 'undefined' ? navigator.userAgent : undefined,
    timestamp: Date.now(),
  });
};

export const recordMiddlewareRedirect = (fromPath: string, toPath: string) => {
  authReliabilityMonitor.recordEvent('middleware_redirect', false, 0, {
    fromPath,
    toPath,
    timestamp: Date.now(),
  });
};
