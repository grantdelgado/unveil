/**
 * Performance Monitoring Hook for Guest Management
 * 
 * Tracks key performance metrics and provides insights into
 * component performance, rendering times, and user interactions.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '@/lib/logger';

interface PerformanceMetrics {
  // Rendering metrics
  initialLoadTime: number;
  renderCount: number;
  lastRenderTime: number;
  averageRenderTime: number;
  
  // Interaction metrics
  filterResponseTime: number;
  rsvpUpdateTime: number;
  searchResponseTime: number;
  
  // Memory metrics
  memoryUsage: number;
  guestCount: number;
  
  // Real-time metrics
  realtimeLatency: number;
  subscriptionHealth: 'healthy' | 'degraded' | 'disconnected';
}

interface PerformanceThresholds {
  maxRenderTime: number;
  maxFilterResponseTime: number;
  maxRSVPUpdateTime: number;
  maxMemoryUsage: number;
}

const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  maxRenderTime: 16, // 60fps target
  maxFilterResponseTime: 100,
  maxRSVPUpdateTime: 500,
  maxMemoryUsage: 50 * 1024 * 1024, // 50MB
};

/**
 * Hook for monitoring guest management performance
 */
export function usePerformanceMonitoring(eventId: string, enabled = true) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    initialLoadTime: 0,
    renderCount: 0,
    lastRenderTime: 0,
    averageRenderTime: 0,
    filterResponseTime: 0,
    rsvpUpdateTime: 0,
    searchResponseTime: 0,
    memoryUsage: 0,
    guestCount: 0,
    realtimeLatency: 0,
    subscriptionHealth: 'healthy',
  });

  const renderTimes = useRef<number[]>([]);
  const componentMountTime = useRef<number>(performance.now());
  const lastInteractionTime = useRef<number>(0);

  // Track component renders
  useEffect(() => {
    if (!enabled) return;

    const renderTime = performance.now();
    const renderDuration = renderTime - (lastInteractionTime.current || componentMountTime.current);
    
    renderTimes.current.push(renderDuration);
    
    // Keep only last 100 render times for rolling average
    if (renderTimes.current.length > 100) {
      renderTimes.current.shift();
    }

    const averageRenderTime = renderTimes.current.reduce((sum, time) => sum + time, 0) / renderTimes.current.length;

    setMetrics(prev => ({
      ...prev,
      renderCount: prev.renderCount + 1,
      lastRenderTime: renderDuration,
      averageRenderTime,
    }));

    // Log slow renders in development
    if (process.env.NODE_ENV === 'development' && renderDuration > DEFAULT_THRESHOLDS.maxRenderTime) {
      logger.performance('Slow render detected', {
        eventId,
        renderTime: renderDuration,
        renderCount: renderTimes.current.length,
      });
    }
  });

  // Measure memory usage periodically
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const measureMemory = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        setMetrics(prev => ({
          ...prev,
          memoryUsage: memory.usedJSHeapSize,
        }));

        // Alert on high memory usage
        if (memory.usedJSHeapSize > DEFAULT_THRESHOLDS.maxMemoryUsage) {
          logger.performance('High memory usage detected', {
            eventId,
            memoryUsage: memory.usedJSHeapSize,
            memoryLimit: memory.jsHeapSizeLimit,
          });
        }
      }
    };

    measureMemory();
    const interval = setInterval(measureMemory, 10000); // Every 10 seconds

    return () => clearInterval(interval);
  }, [enabled, eventId]);

  // Performance measurement utilities
  const measureFilterPerformance = useCallback(async (filterOperation: () => Promise<void> | void) => {
    if (!enabled) {
      await filterOperation();
      return;
    }

    const startTime = performance.now();
    lastInteractionTime.current = startTime;

    try {
      await filterOperation();
    } finally {
      const endTime = performance.now();
      const duration = endTime - startTime;

      setMetrics(prev => ({
        ...prev,
        filterResponseTime: duration,
      }));

      if (duration > DEFAULT_THRESHOLDS.maxFilterResponseTime) {
        logger.performance('Slow filter response', {
          eventId,
          duration,
          threshold: DEFAULT_THRESHOLDS.maxFilterResponseTime,
        });
      }
    }
  }, [enabled, eventId]);

  const measureRSVPUpdate = useCallback(async (updateOperation: () => Promise<void>) => {
    if (!enabled) {
      await updateOperation();
      return;
    }

    const startTime = performance.now();
    lastInteractionTime.current = startTime;

    try {
      await updateOperation();
    } finally {
      const endTime = performance.now();
      const duration = endTime - startTime;

      setMetrics(prev => ({
        ...prev,
        rsvpUpdateTime: duration,
      }));

      if (duration > DEFAULT_THRESHOLDS.maxRSVPUpdateTime) {
        logger.performance('Slow RSVP update', {
          eventId,
          duration,
          threshold: DEFAULT_THRESHOLDS.maxRSVPUpdateTime,
        });
      }
    }
  }, [enabled, eventId]);

  const measureSearchPerformance = useCallback(async (searchOperation: () => Promise<void> | void) => {
    if (!enabled) {
      await searchOperation();
      return;
    }

    const startTime = performance.now();
    lastInteractionTime.current = startTime;

    try {
      await searchOperation();
    } finally {
      const endTime = performance.now();
      const duration = endTime - startTime;

      setMetrics(prev => ({
        ...prev,
        searchResponseTime: duration,
      }));
    }
  }, [enabled, eventId]);

  // Update guest count for metrics
  const updateGuestCount = useCallback((count: number) => {
    setMetrics(prev => ({
      ...prev,
      guestCount: count,
    }));
  }, []);

  // Update real-time metrics
  const updateRealtimeMetrics = useCallback((latency: number, health: PerformanceMetrics['subscriptionHealth']) => {
    setMetrics(prev => ({
      ...prev,
      realtimeLatency: latency,
      subscriptionHealth: health,
    }));
  }, []);

  // Record initial load time
  useEffect(() => {
    if (!enabled) return;

    const loadTime = performance.now() - componentMountTime.current;
    setMetrics(prev => ({
      ...prev,
      initialLoadTime: loadTime,
    }));

    logger.performance('Guest management loaded', {
      eventId,
      loadTime,
    });
  }, [enabled, eventId]);

  // Performance report for debugging
  const getPerformanceReport = useCallback(() => {
    const report = {
      eventId,
      timestamp: new Date().toISOString(),
      metrics,
      thresholds: DEFAULT_THRESHOLDS,
      health: {
        renderingHealthy: metrics.averageRenderTime <= DEFAULT_THRESHOLDS.maxRenderTime,
        filteringHealthy: metrics.filterResponseTime <= DEFAULT_THRESHOLDS.maxFilterResponseTime,
        rsvpHealthy: metrics.rsvpUpdateTime <= DEFAULT_THRESHOLDS.maxRSVPUpdateTime,
        memoryHealthy: metrics.memoryUsage <= DEFAULT_THRESHOLDS.maxMemoryUsage,
        realtimeHealthy: metrics.subscriptionHealth === 'healthy',
      },
    };

    logger.performance('Performance report generated', report);
    return report;
  }, [eventId, metrics]);

  return {
    metrics,
    measureFilterPerformance,
    measureRSVPUpdate,
    measureSearchPerformance,
    updateGuestCount,
    updateRealtimeMetrics,
    getPerformanceReport,
  };
}

/**
 * Hook for lightweight performance tracking (production-safe)
 */
export function useLightweightPerformanceMonitoring(eventId: string) {
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  return usePerformanceMonitoring(eventId, isDevelopment);
}