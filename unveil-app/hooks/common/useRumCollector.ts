import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { logger } from '@/lib/logger';

// Web Vitals types
interface WebVitalsMetric {
  name: 'LCP' | 'INP' | 'CLS' | 'FCP' | 'TTFB';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  entries: PerformanceEntry[];
  id: string;
}

interface RumEventData {
  route: string;
  metric: 'LCP' | 'INP' | 'CLS';
  value: number;
  device: 'mobile' | 'desktop';
  build_id?: string;
}

function detectDevice(): 'mobile' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop';
  
  // Check for mobile characteristics
  const isMobile = 
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.innerWidth <= 768 ||
    ('ontouchstart' in window);
    
  return isMobile ? 'mobile' : 'desktop';
}

function getBuildId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  
  // Try to extract build ID from Next.js
  try {
    // Look for build ID in script tags or __NEXT_DATA__
    const nextData = (window as any).__NEXT_DATA__;
    if (nextData?.buildId) {
      return nextData.buildId;
    }
    
    // Fallback to deployment info or environment
    const deploymentId = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;
    return deploymentId ? deploymentId.slice(0, 8) : undefined;
  } catch {
    return undefined;
  }
}

async function sendRumEvent(eventData: RumEventData): Promise<void> {
  try {
    const response = await fetch('/api/rum', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventData),
    });

    if (!response.ok) {
      const error = await response.json();
      logger.warn('Failed to send RUM event', { 
        status: response.status, 
        error: error.error,
        eventData 
      });
    } else {
      logger.debug('RUM event sent successfully', { eventData });
    }
  } catch (error) {
    logger.warn('Network error sending RUM event', { error, eventData });
  }
}

/**
 * Hook to collect Real User Monitoring (RUM) data using Web Vitals
 * Sends LCP, INP, and CLS metrics once per route load
 */
export function useRumCollector() {
  const pathname = usePathname();
  const sentMetrics = useRef(new Set<string>());
  const currentRoute = useRef<string>('');

  useEffect(() => {
    // Reset sent metrics when route changes
    if (currentRoute.current !== pathname) {
      sentMetrics.current.clear();
      currentRoute.current = pathname;
    }

    // Only run in browser environment
    if (typeof window === 'undefined') return;

    // Dynamically import web-vitals to avoid SSR issues
    let cleanup: (() => void) | undefined;

    import('web-vitals').then(({ onLCP, onINP, onCLS }) => {
      const device = detectDevice();
      const buildId = getBuildId();

      const handleMetric = (metric: WebVitalsMetric) => {
        // Only collect LCP, INP, CLS metrics
        if (!['LCP', 'INP', 'CLS'].includes(metric.name)) {
          return;
        }

        const metricKey = `${pathname}-${metric.name}`;

        // Only send once per route per metric
        if (sentMetrics.current.has(metricKey)) {
          return;
        }

        sentMetrics.current.add(metricKey);

        const eventData: RumEventData = {
          route: pathname,
          metric: metric.name as 'LCP' | 'INP' | 'CLS',
          value: metric.value,
          device,
          build_id: buildId,
        };

        // Send asynchronously without blocking
        sendRumEvent(eventData);

        logger.debug('Web Vital collected', {
          metric: metric.name,
          value: metric.value,
          rating: metric.rating,
          route: pathname,
          device,
        });
      };

      // Set up web vitals collection
      onLCP(handleMetric);
      onINP(handleMetric);
      onCLS(handleMetric);

      logger.debug('RUM collector initialized', { 
        pathname, 
        device,
        buildId 
      });

      // Cleanup function
      cleanup = () => {
        // Web vitals doesn't provide explicit cleanup,
        // but we can clear our sent metrics
        sentMetrics.current.clear();
      };
    }).catch((error) => {
      logger.warn('Failed to initialize web-vitals', { error });
    });

    return cleanup;
  }, [pathname]);

  // Return current collection status
  return {
    currentRoute: pathname,
    metricsCollected: sentMetrics.current.size,
  };
}
