'use client';

import { useEffect } from 'react';
import { initializePerformanceMonitoring } from '@/lib/performance-monitoring';
import {
  initializeDevelopmentAlerts,
  PerformanceAlertOverlay,
} from '@/lib/performance/monitoring/developmentAlerts';

interface PerformanceMonitorProps {
  children: React.ReactNode;
}

export function PerformanceMonitor({ children }: PerformanceMonitorProps) {
  useEffect(() => {
    // Only initialize in browser environment
    if (typeof window !== 'undefined') {
      // Initialize performance monitoring
      initializePerformanceMonitoring();

      // Initialize development alerts system
      initializeDevelopmentAlerts();
    }
  }, []);

  return (
    <>
      {children}
      {/* Development-only performance alert overlay - re-enabled with stability fixes */}
      {process.env.NODE_ENV === 'development' && <PerformanceAlertOverlay />}
    </>
  );
}
