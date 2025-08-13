"use client";

import React, { useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { LoadingOverlay } from './LoadingOverlay';
import { useTransitionStore } from '@/lib/hooks/useTransitionStore';

const TRANSITION_TIMEOUT = 8000; // 8 seconds max
const DEBOUNCE_DELAY = 100; // Debounce rapid navigation
const HIDE_DELAY = 150; // Extra delay before hiding to ensure paint

export const RobustRouteTransitionOverlay: React.FC = () => {
  const pathname = usePathname();
  const { isLoading, startTransition, completeTransition, forceComplete, debugMode } = useTransitionStore();
  
  const timeoutRef = useRef<number | null>(null);
  const debounceRef = useRef<number | null>(null);
  const lastPathnameRef = useRef<string>(pathname);
  const navigationIdRef = useRef<number>(0);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  const generateNavigationId = useCallback(() => {
    navigationIdRef.current += 1;
    return navigationIdRef.current.toString();
  }, []);

  const handleTransitionStart = useCallback((targetUrl?: string) => {
    clearTimers();
    
    // Debounce rapid navigation attempts
    debounceRef.current = window.setTimeout(() => {
      const navigationId = generateNavigationId();
      const route = targetUrl || window.location.pathname;
      
      if (debugMode) {
        console.log(`[TRANSITION] Debounced start: ${route}`);
      }
      
      startTransition(route, navigationId);
      
      // Set timeout to force complete if transition hangs
      timeoutRef.current = window.setTimeout(() => {
        if (debugMode) {
          console.warn(`[TRANSITION] Timeout reached, force completing`);
        }
        forceComplete();
      }, TRANSITION_TIMEOUT);
      
    }, DEBOUNCE_DELAY);
  }, [startTransition, forceComplete, generateNavigationId, clearTimers, debugMode]);

  const handleTransitionComplete = useCallback(() => {
    if (!isLoading) return;
    
    // Get the current navigation ID from the store
    const currentNavId = useTransitionStore.getState().lastNavigationId;
    
    if (debugMode) {
      console.log(`[TRANSITION] Completing transition for navId: ${currentNavId}`);
    }
    
    // Add minimal delay to ensure new page is painted
    setTimeout(() => {
      if (currentNavId) {
        completeTransition(currentNavId);
      } else {
        // Fallback: force complete if no navigation ID
        forceComplete();
      }
      clearTimers();
    }, HIDE_DELAY);
  }, [isLoading, completeTransition, forceComplete, clearTimers, debugMode]);

  // Setup navigation event listeners
  useEffect(() => {
    // Click handler for link navigation
    const handleClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return; // Only left click
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // Ignore modified clicks
      
      let el = e.target as HTMLElement | null;
      while (el && el.tagName !== 'A') {
        el = el.parentElement;
      }
      
      if (!el) return;
      
      const a = el as HTMLAnchorElement;
      const href = a.getAttribute('href');
      
      if (!href) return;
      if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      if (a.target && a.target !== '_self') return;
      
      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        
        // Same page navigation check
        const currentPath = window.location.pathname + window.location.search + window.location.hash;
        const targetPath = url.pathname + url.search + url.hash;
        
        if (currentPath === targetPath) {
          if (debugMode) {
            console.log(`[TRANSITION] Same page navigation ignored: ${targetPath}`);
          }
          return;
        }
        
        handleTransitionStart(targetPath);
      } catch (error) {
        if (debugMode) {
          console.warn(`[TRANSITION] Invalid URL in link: ${href}`, error);
        }
      }
    };

    // History navigation handler (back/forward)
    const handlePopState = () => {
      handleTransitionStart();
    };

    // Patch history methods to catch programmatic navigation
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    type PushArgs = Parameters<typeof history.pushState>;
    type ReplaceArgs = Parameters<typeof history.replaceState>;
    
    history.pushState = ((...args: PushArgs) => {
      const urlArg = args[2];
      if (urlArg != null) {
        try {
          const url = new URL(String(urlArg), window.location.href);
          const targetPath = url.pathname + url.search + url.hash;
          const currentPath = window.location.pathname + window.location.search + window.location.hash;
          
          if (targetPath !== currentPath) {
            handleTransitionStart(targetPath);
          }
        } catch (error) {
          if (debugMode) {
            console.warn(`[TRANSITION] Invalid URL in pushState: ${urlArg}`, error);
          }
        }
      }
      return originalPushState.apply(history, args);
    });
    
    history.replaceState = ((...args: ReplaceArgs) => {
      const urlArg = args[2];
      if (urlArg != null) {
        try {
          const url = new URL(String(urlArg), window.location.href);
          const targetPath = url.pathname + url.search + url.hash;
          const currentPath = window.location.pathname + window.location.search + window.location.hash;
          
          if (targetPath !== currentPath) {
            handleTransitionStart(targetPath);
          }
        } catch (error) {
          if (debugMode) {
            console.warn(`[TRANSITION] Invalid URL in replaceState: ${urlArg}`, error);
          }
        }
      }
      return originalReplaceState.apply(history, args);
    });

    // Add event listeners
    document.addEventListener('click', handleClick, true);
    window.addEventListener('popstate', handlePopState);

    return () => {
      // Cleanup
      document.removeEventListener('click', handleClick, true);
      window.removeEventListener('popstate', handlePopState);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
      clearTimers();
    };
  }, [handleTransitionStart, clearTimers, debugMode]);

  // Handle pathname changes (route completion)
  useEffect(() => {
    if (lastPathnameRef.current !== pathname) {
      const previousPath = lastPathnameRef.current;
      lastPathnameRef.current = pathname;
      
      if (debugMode) {
        console.log(`[TRANSITION] Pathname changed from ${previousPath} to: ${pathname}`);
        console.log(`[TRANSITION] Current loading state: ${isLoading}`);
      }
      
      // Only complete transition if we're currently loading
      if (isLoading) {
        // Add small delay to ensure the new page is rendered
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            handleTransitionComplete();
          });
        });
      }
    }
  }, [pathname, handleTransitionComplete, debugMode, isLoading]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers();
      if (isLoading) {
        forceComplete();
      }
    };
  }, [clearTimers, isLoading, forceComplete]);

  if (!isLoading) return null;
  
  return <LoadingOverlay message="Loading..." />;
};

RobustRouteTransitionOverlay.displayName = 'RobustRouteTransitionOverlay';
