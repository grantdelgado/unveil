/**
 * 🚨 PERFORMANCE GUARDRAILS: Development Alert System
 * 
 * Provides real-time warnings during development for:
 * - Bundle sizes exceeding 350KB threshold
 * - Too many Supabase subscriptions per page (>2)
 * - Heavy component rendering times
 * - Excessive re-renders
 * - Memory usage warnings
 * 
 * Helps prevent performance regressions before they reach production.
 */

import React from 'react';

// Performance thresholds for alerts
export const PERFORMANCE_ALERTS = {
  BUNDLE_SIZE_WARNING: 350 * 1024, // 350KB in bytes
  BUNDLE_SIZE_ERROR: 500 * 1024,   // 500KB in bytes
  MAX_SUBSCRIPTIONS_PER_PAGE: 2,
  MAX_COMPONENT_RENDER_TIME: 16,   // 16ms for 60fps
  MAX_RE_RENDERS_PER_MINUTE: 30,
  MEMORY_WARNING_MB: 50,
} as const;

interface PerformanceAlert {
  type: 'warning' | 'error' | 'info';
  category: 'bundle' | 'subscription' | 'render' | 'memory';
  message: string;
  details?: Record<string, unknown>;
  timestamp: number;
  url: string;
}

class DevelopmentAlerts {
  private static instance: DevelopmentAlerts;
  private alerts: PerformanceAlert[] = [];
  private subscriptionCounts = new Map<string, number>();
  private renderCounts = new Map<string, number>();
  private lastRenderCountReset = Date.now();

  static getInstance(): DevelopmentAlerts {
    if (!DevelopmentAlerts.instance) {
      DevelopmentAlerts.instance = new DevelopmentAlerts();
    }
    return DevelopmentAlerts.instance;
  }

  /**
   * Add performance alert
   */
  private addAlert(alert: Omit<PerformanceAlert, 'timestamp' | 'url'>) {
    if (process.env.NODE_ENV !== 'development') return;

    const fullAlert: PerformanceAlert = {
      ...alert,
      timestamp: Date.now(),
      url: typeof window !== 'undefined' ? window.location.href : '',
    };

    this.alerts.push(fullAlert);
    this.logAlert(fullAlert);

    // Keep only last 50 alerts
    if (this.alerts.length > 50) {
      this.alerts = this.alerts.slice(-50);
    }
  }

  /**
   * Log alert to console with appropriate styling
   */
  private logAlert(alert: PerformanceAlert) {
    const emoji = {
      warning: '⚠️',
      error: '❌',
      info: 'ℹ️',
    }[alert.type];

    const color = {
      warning: 'orange',
      error: 'red',
      info: 'blue',
    }[alert.type];

    console.group(`%c${emoji} Performance Alert: ${alert.category}`, `color: ${color}; font-weight: bold;`);
    console.log(`Message: ${alert.message}`);
    if (alert.details) {
      console.log('Details:', alert.details);
    }
    console.log(`URL: ${alert.url}`);
    console.log(`Time: ${new Date(alert.timestamp).toLocaleTimeString()}`);
    console.groupEnd();
  }

  /**
   * Check bundle size and warn if too large
   */
  checkBundleSize(bundleInfo: { size: number; name: string }) {
    const { size, name } = bundleInfo;

    if (size > PERFORMANCE_ALERTS.BUNDLE_SIZE_ERROR) {
      this.addAlert({
        type: 'error',
        category: 'bundle',
        message: `Bundle "${name}" exceeds 500KB limit`,
        details: {
          size: `${(size / 1024).toFixed(1)}KB`,
          limit: '500KB',
          recommendation: 'Implement code splitting or lazy loading',
        },
      });
    } else if (size > PERFORMANCE_ALERTS.BUNDLE_SIZE_WARNING) {
      this.addAlert({
        type: 'warning',
        category: 'bundle',
        message: `Bundle "${name}" approaching size limit`,
        details: {
          size: `${(size / 1024).toFixed(1)}KB`,
          limit: '350KB',
          recommendation: 'Consider optimizing imports or lazy loading',
        },
      });
    }
  }

  /**
   * Track Supabase subscription count per page
   */
  trackSupabaseSubscription(subscriptionId: string, action: 'add' | 'remove') {
    const pageKey = typeof window !== 'undefined' ? window.location.pathname : 'unknown';
    
    const currentCount = this.subscriptionCounts.get(pageKey) || 0;
    const newCount = action === 'add' ? currentCount + 1 : Math.max(0, currentCount - 1);
    
    this.subscriptionCounts.set(pageKey, newCount);

    if (newCount > PERFORMANCE_ALERTS.MAX_SUBSCRIPTIONS_PER_PAGE) {
      this.addAlert({
        type: 'warning',
        category: 'subscription',
        message: `Too many Supabase subscriptions on page`,
        details: {
          count: newCount,
          limit: PERFORMANCE_ALERTS.MAX_SUBSCRIPTIONS_PER_PAGE,
          page: pageKey,
          subscriptionId,
          recommendation: 'Use centralized subscription management or combine subscriptions',
        },
      });
    }
  }

  /**
   * Track component render performance
   */
  trackComponentRender(componentName: string, renderTime: number) {
    if (renderTime > PERFORMANCE_ALERTS.MAX_COMPONENT_RENDER_TIME) {
      this.addAlert({
        type: 'warning',
        category: 'render',
        message: `Component render time exceeds 16ms`,
        details: {
          component: componentName,
          renderTime: `${renderTime.toFixed(2)}ms`,
          limit: '16ms',
          recommendation: 'Use React.memo, useMemo, or lazy loading',
        },
      });
    }

    // Track render frequency
    const now = Date.now();
    if (now - this.lastRenderCountReset > 60000) { // Reset every minute
      this.renderCounts.clear();
      this.lastRenderCountReset = now;
    }

    const renderCount = (this.renderCounts.get(componentName) || 0) + 1;
    this.renderCounts.set(componentName, renderCount);

    if (renderCount > PERFORMANCE_ALERTS.MAX_RE_RENDERS_PER_MINUTE) {
      this.addAlert({
        type: 'warning',
        category: 'render',
        message: `Component re-rendering too frequently`,
        details: {
          component: componentName,
          renders: renderCount,
          timeframe: '1 minute',
          recommendation: 'Check dependencies in useEffect, useMemo, or useCallback',
        },
      });
    }
  }

  /**
   * Check memory usage (Chrome only)
   */
  checkMemoryUsage() {
    if (typeof window !== 'undefined' && 'performance' in window) {
      try {
        // Chrome-specific memory API
        const performance = window.performance as {
          memory?: {
            usedJSHeapSize: number;
            totalJSHeapSize: number;
          };
        };
        
        if (performance.memory) {
          const usedMB = performance.memory.usedJSHeapSize / (1024 * 1024);

          if (usedMB > PERFORMANCE_ALERTS.MEMORY_WARNING_MB) {
            this.addAlert({
              type: 'warning',
              category: 'memory',
              message: `High memory usage detected`,
              details: {
                used: `${usedMB.toFixed(1)}MB`,
                limit: `${PERFORMANCE_ALERTS.MEMORY_WARNING_MB}MB`,
                total: `${(performance.memory.totalJSHeapSize / (1024 * 1024)).toFixed(1)}MB`,
                recommendation: 'Check for memory leaks or large object allocations',
              },
            });
          }
        }
      } catch {
        // Memory API not available - ignore silently
      }
    }
  }

  /**
   * Get all alerts
   */
  getAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  /**
   * Clear all alerts
   */
  clearAlerts() {
    this.alerts = [];
    this.subscriptionCounts.clear();
    this.renderCounts.clear();
  }
}

// Singleton instance
export const developmentAlerts = DevelopmentAlerts.getInstance();

/**
 * React hook for component performance monitoring
 */
export function usePerformanceAlert(componentName: string) {
  const renderStart = React.useRef<number | undefined>(undefined);
  const renderCount = React.useRef(0);

  React.useEffect(() => {
    renderStart.current = performance.now();
    renderCount.current++;
  });

  React.useLayoutEffect(() => {
    if (renderStart.current) {
      const renderTime = performance.now() - renderStart.current;
      developmentAlerts.trackComponentRender(componentName, renderTime);
    }
  });

  // Check memory usage occasionally
  React.useEffect(() => {
    const interval = setInterval(() => {
      developmentAlerts.checkMemoryUsage();
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, []);

  return {
    renderCount: renderCount.current,
    clearAlerts: () => developmentAlerts.clearAlerts(),
    getAlerts: () => developmentAlerts.getAlerts(),
  };
}

/**
 * Bundle size monitor for webpack/next.js
 */
export function monitorBundleSize() {
  if (process.env.NODE_ENV !== 'development') return;

  // Monitor route-level bundles
  if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'navigation') {
          // Get bundle size from navigation timing
          const transferSize = (entry as PerformanceNavigationTiming).transferSize;
          if (transferSize) {
            developmentAlerts.checkBundleSize({
              size: transferSize,
              name: window.location.pathname,
            });
          }
        }
      }
    });

    observer.observe({ entryTypes: ['navigation'] });
  }
}

/**
 * Supabase subscription tracker
 */
export function trackSupabaseSubscription(subscriptionId: string) {
  developmentAlerts.trackSupabaseSubscription(subscriptionId, 'add');

  return () => {
    developmentAlerts.trackSupabaseSubscription(subscriptionId, 'remove');
  };
}

/**
 * Initialize development alerts system
 */
export function initializeDevelopmentAlerts() {
  if (process.env.NODE_ENV !== 'development') return;

  console.log('🚨 Performance Alert System initialized');
  console.log('📊 Monitoring bundle sizes, subscriptions, and render performance...');

  // Start bundle monitoring
  monitorBundleSize();

  // Log current thresholds
  console.table(PERFORMANCE_ALERTS);

  // Periodic memory check
  setInterval(() => {
    developmentAlerts.checkMemoryUsage();
  }, 60000); // Every minute
}

/**
 * Development-only performance alert component
 */
export function PerformanceAlertOverlay() {
  const [alerts, setAlerts] = React.useState<PerformanceAlert[]>([]);
  const [showOverlay, setShowOverlay] = React.useState(false);

  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const interval = setInterval(() => {
      const currentAlerts = developmentAlerts.getAlerts();
      setAlerts(currentAlerts);
      setShowOverlay(currentAlerts.length > 0);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  if (process.env.NODE_ENV !== 'development' || !showOverlay) {
    return null;
  }

  const recentAlerts = alerts.slice(-5); // Show last 5 alerts

  return (
    <div className="fixed top-4 right-4 z-50 bg-yellow-100 border border-yellow-400 rounded p-4 max-w-sm shadow-lg">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold text-yellow-800">⚠️ Performance Alerts</h3>
        <button 
          onClick={() => setShowOverlay(false)}
          className="text-yellow-600 hover:text-yellow-800"
        >
          ✕
        </button>
      </div>
      <div className="space-y-2 text-sm">
        {recentAlerts.map((alert, index) => (
          <div key={index} className="border-l-2 border-yellow-400 pl-2">
            <div className="font-medium">{alert.message}</div>
            <div className="text-xs text-yellow-600">
              {alert.category} • {new Date(alert.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ))}
      </div>
      <button 
        onClick={() => developmentAlerts.clearAlerts()}
        className="mt-2 text-xs text-yellow-600 hover:text-yellow-800"
      >
        Clear alerts
      </button>
    </div>
  );
}

// Export for easy integration
const developmentAlertsModule = {
  initialize: initializeDevelopmentAlerts,
  alerts: developmentAlerts,
  usePerformanceAlert,
  trackSupabaseSubscription,
  PerformanceAlertOverlay,
  thresholds: PERFORMANCE_ALERTS,
};

export default developmentAlertsModule;