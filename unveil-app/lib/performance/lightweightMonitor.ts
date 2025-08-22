/**
 * 🚀 LIGHTWEIGHT PERFORMANCE MONITOR
 *
 * Minimal performance monitoring for development to replace heavy instrumentation
 * that was causing 150ms slow execution warnings
 */

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  type: 'navigation' | 'query' | 'render' | 'user-interaction';
}

class LightweightMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics = 50; // Keep only latest 50 metrics
  private isEnabled = process.env.NODE_ENV === 'development';

  startTimer(
    name: string,
    type: PerformanceMetric['type'] = 'user-interaction',
  ): () => void {
    if (!this.isEnabled) return () => {};

    const startTime = performance.now();

    return () => {
      const duration = performance.now() - startTime;

      // Only log if duration is significant (>50ms)
      if (duration > 50) {
        this.addMetric({
          name,
          duration,
          timestamp: Date.now(),
          type,
        });

        // Warn for slow operations
        if (duration > 100) {
          console.warn(
            `⚠️ Slow operation detected: ${name} took ${duration.toFixed(2)}ms`,
          );
        }
      }
    };
  }

  private addMetric(metric: PerformanceMetric) {
    this.metrics.push(metric);

    // Keep only latest metrics to prevent memory leaks
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  clearMetrics() {
    this.metrics = [];
  }

  logSummary() {
    if (!this.isEnabled || this.metrics.length === 0) return;

    const byType = this.metrics.reduce(
      (acc, metric) => {
        acc[metric.type] = acc[metric.type] || [];
        acc[metric.type].push(metric.duration);
        return acc;
      },
      {} as Record<string, number[]>,
    );

    console.group('📊 Performance Summary');
    Object.entries(byType).forEach(([type, durations]) => {
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      const max = Math.max(...durations);
      console.log(
        `${type}: avg ${avg.toFixed(1)}ms, max ${max.toFixed(1)}ms (${durations.length} samples)`,
      );
    });
    console.groupEnd();
  }
}

export const lightweightMonitor = new LightweightMonitor();

// Auto-log summary every 30 seconds in development
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    lightweightMonitor.logSummary();
  }, 30000);
}
