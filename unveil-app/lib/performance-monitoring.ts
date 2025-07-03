/**
 * Performance Monitoring Utilities
 * Tracks key metrics for production monitoring and optimization
 */

import * as Sentry from '@sentry/nextjs';
import type { WindowWithGtag } from './types/analytics';
import { logger } from '@/lib/logger';

// Core Web Vitals tracking
export function trackWebVitals() {
  if (typeof window === 'undefined') return;

  // Track Core Web Vitals
  import('web-vitals').then(({ onCLS, onINP, onFCP, onLCP, onTTFB }) => {
    onCLS(sendToAnalytics);
    onINP(sendToAnalytics);
    onFCP(sendToAnalytics);
    onLCP(sendToAnalytics);
    onTTFB(sendToAnalytics);
  }).catch((error) => {
    console.warn('Failed to load web-vitals:', error);
  });
}

// Send metrics to analytics services
function sendToAnalytics(metric: {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
}) {
  // Send to Sentry
  Sentry.addBreadcrumb({
    category: 'performance',
    message: `${metric.name}: ${metric.value}`,
    level: 'info',
    data: {
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
    },
  });

  // Send to Google Analytics if available
  const windowWithGtag = window as WindowWithGtag;
  if (typeof window !== 'undefined' && windowWithGtag.gtag) {
    windowWithGtag.gtag('event', metric.name, {
      event_category: 'Web Vitals',
      event_label: metric.id,
      value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
      non_interaction: true,
    });
  }
}

// Track custom performance metrics
export function trackCustomMetric(name: string, value: number, unit: string = 'ms') {
  // Send to Sentry
  Sentry.addBreadcrumb({
    category: 'custom_metric',
    message: `${name}: ${value}${unit}`,
    level: 'info',
    data: { name, value, unit },
  });

  // Send to Google Analytics if available
  const windowWithGtag = window as WindowWithGtag;
  if (typeof window !== 'undefined' && windowWithGtag.gtag) {
    windowWithGtag.gtag('event', 'custom_metric', {
      event_category: 'Performance',
      event_label: name,
      value: Math.round(value),
      custom_map: { unit },
    });
  }
}

// Track user interactions
export function trackUserInteraction(action: string, category: string, label?: string) {
  // Send to Sentry
  Sentry.addBreadcrumb({
    category: 'user_interaction',
    message: `${action} in ${category}${label ? ` - ${label}` : ''}`,
    level: 'info',
    data: { action, category, label },
  });

  // Send to Google Analytics if available
  const windowWithGtag = window as WindowWithGtag;
  if (typeof window !== 'undefined' && windowWithGtag.gtag) {
    windowWithGtag.gtag('event', action, {
      event_category: category,
      event_label: label,
    });
  }
}

// Track API performance
export function trackAPIPerformance(endpoint: string, duration: number, status: number) {
  const metric = {
    endpoint,
    duration,
    status,
    timestamp: Date.now(),
  };

  // Send to Sentry
  Sentry.addBreadcrumb({
    category: 'api_performance',
    message: `${endpoint}: ${duration}ms (${status})`,
    level: status >= 400 ? 'error' : 'info',
    data: metric,
  });

  // Track slow API calls
  if (duration > 2000) {
    Sentry.captureMessage(`Slow API call: ${endpoint} took ${duration}ms`, 'warning');
  }
}

// Track feature usage
export function trackFeatureUsage(feature: string, metadata?: Record<string, string | number | boolean>) {
  // Send to Sentry
  Sentry.addBreadcrumb({
    category: 'feature_usage',
    message: `Feature used: ${feature}`,
    level: 'info',
    data: { feature, ...metadata },
  });

  // Send to Google Analytics if available
  const windowWithGtag = window as WindowWithGtag;
  if (typeof window !== 'undefined' && windowWithGtag.gtag) {
    windowWithGtag.gtag('event', 'feature_usage', {
      event_category: 'Features',
      event_label: feature,
      custom_map: metadata,
    });
  }
}

// Initialize performance monitoring
export function initializePerformanceMonitoring() {
  if (typeof window === 'undefined') return;

  // Track Web Vitals
  trackWebVitals();

  // Track route changes
  let startTime = Date.now();
  
  // Listen for route changes (Next.js)
  if (typeof window !== 'undefined') {
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function(...args: Parameters<typeof originalPushState>) {
      trackCustomMetric('route_change_duration', Date.now() - startTime);
      startTime = Date.now();
      return originalPushState.apply(this, args);
    };

    window.history.replaceState = function(...args: Parameters<typeof originalReplaceState>) {
      trackCustomMetric('route_change_duration', Date.now() - startTime);
      startTime = Date.now();
      return originalReplaceState.apply(this, args);
    };
  }

  // Track page visibility changes
  document.addEventListener('visibilitychange', () => {
    trackUserInteraction(
      document.hidden ? 'page_hidden' : 'page_visible',
      'Page Visibility'
    );
  });

  // Track unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    Sentry.captureException(event.reason);
  });

  logger.system('Performance monitoring initialized');
} 