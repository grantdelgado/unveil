"use client";

import { create } from 'zustand';

interface TransitionState {
  isLoading: boolean;
  currentRoute: string;
  startedAt: number | null;
  lastNavigationId: string | null;
  debugMode: boolean;
}

interface TransitionActions {
  startTransition: (route: string, navigationId: string) => void;
  completeTransition: (navigationId: string) => void;
  cancelTransition: (navigationId: string) => void;
  forceComplete: () => void;
  setDebugMode: (enabled: boolean) => void;
}

type TransitionStore = TransitionState & TransitionActions;

const isDev = process.env.NODE_ENV === 'development';

export const useTransitionStore = create<TransitionStore>((set, get) => ({
  // State
  isLoading: false,
  currentRoute: '',
  startedAt: null,
  lastNavigationId: null,
  debugMode: isDev,

  // Actions
  startTransition: (route: string, navigationId: string) => {
    const state = get();
    
    if (state.debugMode) {
      console.log(`[TRANSITION] Start: ${route} (ID: ${navigationId})`);
      console.log(`[TRANSITION] Previous state - Loading: ${state.isLoading}, NavId: ${state.lastNavigationId}`);
    }
    
    // Cancel any existing transition
    if (state.isLoading && state.lastNavigationId !== navigationId) {
      if (state.debugMode) {
        console.log(`[TRANSITION] Cancelling previous: ${state.lastNavigationId}`);
      }
    }
    
    set({
      isLoading: true,
      currentRoute: route,
      startedAt: Date.now(),
      lastNavigationId: navigationId,
    });

    if (state.debugMode) {
      console.log(`[TRANSITION] New state set - Loading: true, NavId: ${navigationId}`);
    }
  },

  completeTransition: (navigationId: string) => {
    const state = get();
    
    if (state.debugMode) {
      console.log(`[TRANSITION] Complete called for navId: ${navigationId}, current: ${state.lastNavigationId}`);
    }
    
    // Only complete if this is the current navigation
    if (state.lastNavigationId !== navigationId) {
      if (state.debugMode) {
        console.log(`[TRANSITION] Ignoring complete for stale navigation: ${navigationId} (current: ${state.lastNavigationId})`);
      }
      return;
    }
    
    if (state.debugMode) {
      const duration = state.startedAt ? Date.now() - state.startedAt : 0;
      console.log(`[TRANSITION] Complete: ${state.currentRoute} (${duration}ms)`);
    }
    
    set({
      isLoading: false,
      startedAt: null,
      lastNavigationId: null,
    });

    if (state.debugMode) {
      console.log(`[TRANSITION] State cleared - Loading: false`);
    }
  },

  cancelTransition: (navigationId: string) => {
    const state = get();
    
    if (state.lastNavigationId !== navigationId) {
      return;
    }
    
    if (state.debugMode) {
      console.log(`[TRANSITION] Cancel: ${navigationId}`);
    }
    
    set({
      isLoading: false,
      startedAt: null,
      lastNavigationId: null,
    });
  },

  forceComplete: () => {
    const state = get();
    
    if (state.debugMode) {
      console.log(`[TRANSITION] Force complete (timeout/error)`);
    }
    
    set({
      isLoading: false,
      startedAt: null,
      lastNavigationId: null,
    });
  },

  setDebugMode: (enabled: boolean) => {
    set({ debugMode: enabled });
  },
}));
