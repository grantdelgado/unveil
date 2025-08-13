"use client";

import React, { useEffect } from 'react';
import { useTransitionStore } from './useTransitionStore';

/**
 * Hook to ensure transition completes when a page component mounts.
 * Use this in page components as a fallback to guarantee transition completion.
 */
export function useTransitionComplete() {
  const { completeTransition, forceComplete } = useTransitionStore();

  useEffect(() => {
    // Always try to complete transition when component mounts
    const state = useTransitionStore.getState();
    
    if (state.isLoading && state.lastNavigationId) {
      if (state.debugMode) {
        console.log(`[TRANSITION] Page mounted with active transition (navId: ${state.lastNavigationId}) - completing`);
      }
      
      // Small delay to ensure the page has had time to render
      const timeoutId = setTimeout(() => {
        completeTransition(state.lastNavigationId!);
      }, 50);

      return () => clearTimeout(timeoutId);
    } else if (state.isLoading && !state.lastNavigationId) {
      // Fallback if no navigation ID but still loading
      if (state.debugMode) {
        console.log('[TRANSITION] Page mounted with loading state but no navId - force completing');
      }
      
      const timeoutId = setTimeout(() => {
        forceComplete();
      }, 50);

      return () => clearTimeout(timeoutId);
    }
  }, [completeTransition, forceComplete]); // Include dependencies
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
