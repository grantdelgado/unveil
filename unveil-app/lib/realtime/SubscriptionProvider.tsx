'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  ReactNode,
} from 'react';
import { SubscriptionManager } from './SubscriptionManager';
import { logger } from '@/lib/logger';
import { useAuth } from '@/lib/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { RealtimeFlags } from '@/lib/config/realtime';
import {
  emitTokenRefreshSuccess,
  emitTokenRefreshFailure,
  emitManagerReinit,
  emitSetAuth,
} from '@/lib/telemetry/realtime';

interface SubscriptionContextType {
  manager: SubscriptionManager | null;
  version: number;
  isReady: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(
  undefined,
);

interface SubscriptionProviderProps {
  children: ReactNode;
}

/**
 * FIXED: Enhanced SubscriptionProvider with race condition protection
 * 
 * Fixes:
 * - Eliminated rapid auth transition loops
 * - Proper initialization state management  
 * - Prevented manager operation race conditions
 * - Stabilized isReady state transitions
 */
export function SubscriptionProvider({ children }: SubscriptionProviderProps) {
  const [manager, setManager] = useState<SubscriptionManager | null>(null);
  const [version, setVersion] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const { isAuthenticated, session } = useAuth();
  
  // Stabilized refs to prevent race conditions
  const managerRef = useRef<SubscriptionManager | null>(null);
  const initializationRef = useRef<Promise<void> | null>(null);
  const isInitializedRef = useRef(false);
  const tokenUpdateInFlight = useRef(false);
  
  // Track auth state more precisely
  const lastAuthState = useRef<{
    isAuthenticated: boolean | null;
    userId: string | null;
    sessionId: string | null;
  }>({
    isAuthenticated: null,
    userId: null, 
    sessionId: null,
  });

  // Centralized token refresh handler with mutex
  const applyToken = useCallback(async (newToken: string): Promise<void> => {
    if (tokenUpdateInFlight.current) {
      logger.realtime('🔄 Token update already in flight, skipping duplicate');
      emitSetAuth({
        source: 'provider',
        deduped: true,
        duration: 0,
      });
      return;
    }
    
    tokenUpdateInFlight.current = true;
    const startTime = Date.now();
    
    try {
      supabase.realtime.setAuth(newToken);
      const duration = Date.now() - startTime;
      
      logger.realtime(`🔄 Realtime auth token updated v${version}`, {
        duration,
        singleAuthority: RealtimeFlags.singleTokenAuthority,
      });
      
      emitTokenRefreshSuccess({
        duration,
        userId: session?.user?.id,
      });
      
      emitSetAuth({
        source: 'provider',
        deduped: false,
        duration,
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('❌ Failed to update realtime auth token:', error);
      
      emitTokenRefreshFailure({
        duration,
        userId: session?.user?.id,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      tokenUpdateInFlight.current = false;
    }
  }, [version, session?.user?.id]);

  // Initialize manager with proper async handling
  const initializeManager = useCallback(async (): Promise<void> => {
    // Prevent concurrent initialization
    if (initializationRef.current) {
      return initializationRef.current;
    }
    
    const initPromise = (async () => {
      try {
        logger.realtime('🚀 Initializing SubscriptionManager', {
          userId: session?.user?.id,
          hasSession: !!session,
        });

        // Clean up any existing manager
        if (managerRef.current) {
          try {
            managerRef.current.destroy();
          } catch (error) {
            logger.error('❌ Error destroying existing manager:', error);
          }
        }

        // Create new manager
        const newManager = new SubscriptionManager();
        
        // Set auth token if we have a session
        if (session?.access_token) {
          await applyToken(session.access_token);
        }
        
        // Update refs and state
        managerRef.current = newManager;
        setManager(newManager);
        setIsReady(true);
        isInitializedRef.current = true;
        
        setVersion((prev) => {
          const newVersion = prev + 1;
          logger.realtime(
            `✅ SubscriptionManager initialized successfully (v${newVersion})`,
          );
          
          emitManagerReinit({
            version: newVersion,
            reason: 'sign_in',
            userId: session?.user?.id,
            hadPreviousManager: false,
          });
          
          return newVersion;
        });
        
      } catch (error) {
        logger.error('❌ Failed to initialize SubscriptionManager:', error);
        setManager(null);
        setIsReady(false);
        isInitializedRef.current = false;
      }
    })();
    
    initializationRef.current = initPromise;
    await initPromise;
    initializationRef.current = null;
  }, [session, applyToken]);

  // Destroy manager with proper cleanup
  const destroyManager = useCallback(() => {
    logger.realtime('🧹 Destroying SubscriptionManager');
    
    if (managerRef.current) {
      try {
        managerRef.current.destroy();
      } catch (error) {
        logger.error('❌ Error destroying SubscriptionManager:', error);
      }
    }
    
    managerRef.current = null;
    setManager(null);
    setIsReady(false);
    isInitializedRef.current = false;
    
    setVersion((prev) => {
      const newVersion = prev + 1;
      emitManagerReinit({
        version: newVersion,
        reason: 'sign_out',
        hadPreviousManager: true,
      });
      return newVersion;
    });
  }, []);

  // Handle auth state changes with stabilization
  useEffect(() => {
    const currentState = {
      isAuthenticated,
      userId: session?.user?.id || null,
      sessionId: session?.access_token ? 'present' : null,
    };
    
    const lastState = lastAuthState.current;
    
    // Check if this is a meaningful state change
    const hasChanged = 
      currentState.isAuthenticated !== lastState.isAuthenticated ||
      currentState.userId !== lastState.userId ||
      currentState.sessionId !== lastState.sessionId;
    
    if (!hasChanged) {
      return; // No meaningful change, skip
    }
    
    logger.realtime('🔄 Auth state change detected', {
      was: lastState,
      now: currentState,
      hasManager: !!managerRef.current,
      isInitialized: isInitializedRef.current,
    });
    
    // Update tracked state
    lastAuthState.current = currentState;
    
    if (isAuthenticated && session) {
      // User is authenticated - ensure manager exists
      if (!isInitializedRef.current) {
        initializeManager();
      }
    } else {
      // User is not authenticated - cleanup manager
      if (isInitializedRef.current) {
        destroyManager();
      }
    }
  }, [isAuthenticated, session, initializeManager, destroyManager]);

  // Handle token refresh events
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'TOKEN_REFRESHED' && session) {
        if (RealtimeFlags.singleTokenAuthority) {
          await applyToken(session.access_token);
        } else {
          // Legacy behavior for token refresh
          try {
            supabase.realtime.setAuth(session.access_token);
            logger.realtime('🔄 Token refreshed (legacy mode)');
          } catch (error) {
            logger.error('❌ Token refresh failed:', error);
          }
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [applyToken]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (managerRef.current) {
        logger.realtime('🧹 Provider unmount cleanup');
        managerRef.current.destroy();
        managerRef.current = null;
      }
    };
  }, []);

  const value: SubscriptionContextType = {
    manager,
    version,
    isReady,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

/**
 * Hook to access the current SubscriptionManager
 * FIXED: Reduced debug logging to prevent console spam
 */
export function useSubscriptionManager(): SubscriptionContextType {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error(
      'useSubscriptionManager must be used within a SubscriptionProvider',
    );
  }

  // Reduced debug logging - only log significant state changes
  const previousState = useRef<{
    hasManager: boolean;
    isReady: boolean;
    version: number;
  }>({ hasManager: false, isReady: false, version: 0 });
  
  useEffect(() => {
    const current = {
      hasManager: !!context.manager,
      isReady: context.isReady,
      version: context.version,
    };
    
    const prev = previousState.current;
    
    if (
      current.hasManager !== prev.hasManager ||
      current.isReady !== prev.isReady ||
      current.version !== prev.version
    ) {
      logger.realtime('🎣 useSubscriptionManager state change', {
        hasManager: current.hasManager,
        isReady: current.isReady,
        version: current.version,
        changed: {
          manager: current.hasManager !== prev.hasManager,
          ready: current.isReady !== prev.isReady,
          version: current.version !== prev.version,
        },
      });
      
      previousState.current = current;
    }
  }, [context.manager, context.isReady, context.version]);

  return context;
}

/**
 * Legacy compatibility function - now uses provider-managed instance
 * @deprecated Use useSubscriptionManager hook instead
 */
export function getSubscriptionManager(): SubscriptionManager | null {
  // In a provider context, we should use the hook instead
  // This is for backward compatibility only
  logger.warn(
    '⚠️ getSubscriptionManager() called outside provider context - use useSubscriptionManager hook instead',
  );
  return null;
}
