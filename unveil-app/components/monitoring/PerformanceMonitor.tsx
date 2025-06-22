'use client';

import { useEffect } from 'react';
import { initializePerformanceMonitoring } from '@/lib/performance-monitoring';

interface PerformanceMonitorProps {
  children: React.ReactNode;
}

export function PerformanceMonitor({ children }: PerformanceMonitorProps) {
  useEffect(() => {
    // Only initialize in browser environment
    if (typeof window !== 'undefined') {
      // Initialize performance monitoring
      initializePerformanceMonitoring();
    }
  }, []);

  return <>{children}</>;
} 