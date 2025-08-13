"use client";

import React, { useEffect } from 'react';
import { useTransitionStore } from './useTransitionStore';

/**
 * Hook to ensure transition completes when a page component mounts.
 * Use this in page components as a fallback to guarantee transition completion.
 */
export function useTransitionComplete() {
  const { isLoading, forceComplete, debugMode } = useTransitionStore();

  useEffect(() => {
    // Only act if there's an active transition
    if (isLoading) {
      if (debugMode) {
        console.log('[TRANSITION] Page mounted while transition active - force completing');
      }
      
      // Small delay to ensure the page has had time to render
      const timeoutId = setTimeout(() => {
        forceComplete();
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [isLoading, forceComplete, debugMode]);
}

/**
 * Higher-order component version for class components or easy wrapping
 */
export function withTransitionComplete<T extends object>(Component: React.ComponentType<T>) {
  return function WrappedComponent(props: T) {
    useTransitionComplete();
    return React.createElement(Component, props);
  };
}
