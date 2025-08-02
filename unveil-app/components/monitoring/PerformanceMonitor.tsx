'use client';

import { useEffect } from 'react';
import { initializePerformanceMonitoring } from '@/lib/performance-monitoring';
import { initializeDevelopmentAlerts } from '@/performance/monitoring/developmentAlerts';

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
      {/* Development-only performance alert overlay - temporarily disabled due to infinite loop */}
      {/* <PerformanceAlertOverlay /> */}
    </>
  );
} 