"use client";

import { useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface UseNavigationDebounceOptions {
  delay?: number;
  enableLogging?: boolean;
}

/**
 * Hook to debounce navigation calls and prevent rapid route changes
 * that can cause state corruption or performance issues
 */
export function useNavigationDebounce(options: UseNavigationDebounceOptions = {}) {
  const { delay = 250, enableLogging = process.env.NODE_ENV === 'development' } = options;
  const router = useRouter();
  const debounceTimeoutRef = useRef<number | null>(null);
  const lastNavigationRef = useRef<string>('');

  const clearDebounceTimeout = useCallback(() => {
    if (debounceTimeoutRef.current) {
      window.clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
  }, []);

  const debouncedPush = useCallback((path: string) => {
    // Prevent duplicate navigation to same path
    if (lastNavigationRef.current === path) {
      if (enableLogging) {
        console.log(`[NAV] Ignoring duplicate navigation to: ${path}`);
      }
      return;
    }

    clearDebounceTimeout();
    
    debounceTimeoutRef.current = window.setTimeout(() => {
      lastNavigationRef.current = path;
      if (enableLogging) {
        console.log(`[NAV] Navigating to: ${path}`);
      }
      router.push(path);
    }, delay);
  }, [router, delay, enableLogging, clearDebounceTimeout]);

  const debouncedReplace = useCallback((path: string) => {
    // Prevent duplicate navigation to same path
    if (lastNavigationRef.current === path) {
      if (enableLogging) {
        console.log(`[NAV] Ignoring duplicate replace to: ${path}`);
      }
      return;
    }

    clearDebounceTimeout();
    
    debounceTimeoutRef.current = window.setTimeout(() => {
      lastNavigationRef.current = path;
      if (enableLogging) {
        console.log(`[NAV] Replacing to: ${path}`);
      }
      router.replace(path);
    }, delay);
  }, [router, delay, enableLogging, clearDebounceTimeout]);

  const cancel = useCallback(() => {
    clearDebounceTimeout();
    if (enableLogging) {
      console.log(`[NAV] Cancelled pending navigation`);
    }
  }, [clearDebounceTimeout, enableLogging]);

  return {
    push: debouncedPush,
    replace: debouncedReplace,
    cancel,
    // Direct access to router for immediate navigation when needed
    immediate: router,
  };
}
