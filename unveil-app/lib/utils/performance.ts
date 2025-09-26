/**
 * Performance utilities for optimizing Core Web Vitals
 */

/**
 * Defer execution until after critical rendering is complete
 * Uses requestIdleCallback when available, falls back to setTimeout
 */
export function deferUntilIdle(callback: () => void, timeout = 5000): void {
  if (typeof window === 'undefined') {
    // Server-side: execute immediately
    callback();
    return;
  }

  if ('requestIdleCallback' in window) {
    // Use requestIdleCallback when available (Chrome, Firefox)
    (window as unknown as { requestIdleCallback: (callback: () => void, options: { timeout: number }) => void }).requestIdleCallback(callback, { timeout });
  } else {
    // Fallback for Safari: defer until after paint
    setTimeout(callback, 0);
  }
}

/**
 * Defer execution until after the next paint to improve LCP
 */
export function deferAfterPaint(callback: () => void): void {
  if (typeof window === 'undefined') {
    callback();
    return;
  }

  // Use double requestAnimationFrame to ensure we're after paint
  requestAnimationFrame(() => {
    requestAnimationFrame(callback);
  });
}

/**
 * Check if critical content has finished painting
 * Uses paint timing API when available
 */
export function waitForCriticalPaint(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }

    // Check if first contentful paint has occurred
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const fcp = entries.find(entry => entry.name === 'first-contentful-paint');
          
          if (fcp) {
            observer.disconnect();
            resolve();
          }
        });
        
        observer.observe({ entryTypes: ['paint'] });
        
        // Fallback timeout
        setTimeout(() => {
          observer.disconnect();
          resolve();
        }, 3000);
      } catch {
        // Fall back to simple defer
        deferAfterPaint(resolve);
      }
    } else {
      // Fallback for browsers without PerformanceObserver
      deferAfterPaint(resolve);
    }
  });
}

/**
 * Optimize component mounting to happen after LCP
 */
export function useDeferredMount(delay = 0): boolean {
  const [shouldMount, setShouldMount] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      deferAfterPaint(() => setShouldMount(true));
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  return shouldMount;
}

/**
 * Hook to defer provider mounting until after first paint
 * Optimizes LCP by ensuring critical content renders before heavy providers
 */
export function useAfterPaint(): boolean {
  const [afterPaint, setAfterPaint] = useState(false);

  useEffect(() => {
    // Performance marks for observability (dev only)
    if (process.env.NODE_ENV === 'development') {
      performance.mark('perf:providers:defer-start');
    }

    deferAfterPaint(() => {
      setAfterPaint(true);
      
      // Performance marks for observability (dev only)
      if (process.env.NODE_ENV === 'development') {
        performance.mark('perf:providers:after-paint');
        performance.measure(
          'perf:providers:defer-duration', 
          'perf:providers:defer-start', 
          'perf:providers:after-paint'
        );
      }
    });
  }, []);

  return afterPaint;
}

/**
 * Hook to load components when they become visible (below-the-fold optimization)
 * Uses IntersectionObserver to defer loading until element is near viewport
 */
export function useInViewport(threshold = 0.1, rootMargin = '50px'): [boolean, (node: HTMLElement | null) => void] {
  const [isInView, setIsInView] = useState(false);
  const [element, setElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!element || typeof window === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect(); // Only trigger once
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [element, threshold, rootMargin]);

  return [isInView, setElement];
}

/**
 * Hook for below-the-fold components that should load when visible
 * Optimizes LCP by deferring non-critical content
 */
export function useBelowFold(delay = 0): boolean {
  const [shouldLoad, setShouldLoad] = useState(false);
  const [isInView] = useInViewport();

  useEffect(() => {
    if (isInView) {
      const timer = setTimeout(() => setShouldLoad(true), delay);
      return () => clearTimeout(timer);
    }
  }, [isInView, delay]);

  return shouldLoad;
}

// Export for React imports
import { useState, useEffect } from 'react';
