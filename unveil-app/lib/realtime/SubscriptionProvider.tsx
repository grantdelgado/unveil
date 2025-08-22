'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  ReactNode,
} from 'react';
import { SubscriptionManager } from './SubscriptionManager';
import { logger } from '@/lib/logger';
import { useAuth } from '@/lib/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import {
  emitTokenRefreshSuccess,
  emitTokenRefreshFailure,
  emitManagerReinit,
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
 * Enhanced SubscriptionProvider with auto re-init on auth changes
 *
 * Features:
 * - Automatically destroys manager on sign-out
 * - Creates fresh manager instance on sign-in
 * - Provides version number for hook dependencies
 * - Ensures components get new manager instance after auth transitions
 * - Prevents "SubscriptionManager is destroyed" errors
 */
export function SubscriptionProvider({ children }: SubscriptionProviderProps) {
  const [manager, setManager] = useState<SubscriptionManager | null>(null);
  const [version, setVersion] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const { isAuthenticated, session } = useAuth();
  const previousAuthState = useRef<boolean | null>(null);
  const managerRef = useRef<SubscriptionManager | null>(null);

  // Separate effect for comprehensive auth state monitoring including token refresh
  useEffect(() => {
    let isMounted = true;

    // Monitor all auth state changes including token refresh
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      logger.realtime(`🔐 Auth event in SubscriptionProvider: ${event}`, {
        hasSession: !!session,
        userId: session?.user?.id,
        hasManager: !!managerRef.current,
        version,
      });

      if (event === 'TOKEN_REFRESHED' && session) {
        // Critical: Update realtime connection with new token
        const startTime = Date.now();
        try {
          supabase.realtime.setAuth(session.access_token);
          const duration = Date.now() - startTime;

          logger.realtime(
            `🔄 Realtime auth token updated (provider) v${version}`,
            {
              userId: session.user?.id,
              hasManager: !!managerRef.current,
              duration,
            },
          );

          // Emit telemetry for successful token refresh
          emitTokenRefreshSuccess({
            duration,
            userId: session.user?.id,
          });

          // Notify manager if it exists
          if (managerRef.current && !managerRef.current.destroyed) {
            // The manager will handle its own token refresh via its auth listener
            logger.realtime('✅ Manager notified of token refresh');
          }
        } catch (error) {
          const duration = Date.now() - startTime;
          logger.error(
            '❌ Failed to update realtime auth token in provider:',
            error,
          );

          // Emit telemetry for failed token refresh
          emitTokenRefreshFailure({
            duration,
            userId: session.user?.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } else if (event === 'SIGNED_IN' && session) {
        // Ensure realtime auth is set on sign-in
        try {
          supabase.realtime.setAuth(session.access_token);
          logger.realtime(
            `🔑 Realtime auth set on sign-in (provider) v${version}`,
          );
        } catch (error) {
          logger.error('❌ Failed to set realtime auth on sign-in:', error);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [version]);

  useEffect(() => {
    const wasAuthenticated = previousAuthState.current;
    const isNowAuthenticated = isAuthenticated;

    // Track auth state changes with detailed logging
    if (wasAuthenticated !== isNowAuthenticated) {
      logger.realtime(
        `🔄 Auth transition detected: ${wasAuthenticated} → ${isNowAuthenticated}`,
        {
          wasAuthenticated,
          isNowAuthenticated,
          hasSession: !!session,
          userId: session?.user?.id,
          currentManagerExists: !!managerRef.current,
          currentVersion: version,
        },
      );

      if (!isNowAuthenticated) {
        // User signed out - destroy manager
        logger.realtime('🔐 User signed out - destroying SubscriptionManager', {
          hadManager: !!managerRef.current,
          version,
        });

        const hadManager = !!managerRef.current;
        if (managerRef.current) {
          try {
            managerRef.current.destroy();
            logger.realtime('✅ SubscriptionManager destroyed successfully');
          } catch (error) {
            logger.error('❌ Error destroying SubscriptionManager:', error);
          }
          managerRef.current = null;
        }
        setManager(null);
        setIsReady(false);
        setVersion((prev) => {
          const newVersion = prev + 1;
          logger.realtime(
            `📊 Version incremented: ${prev} → ${newVersion} (sign out)`,
          );

          // Emit telemetry for manager reinit (destruction)
          emitManagerReinit({
            version: newVersion,
            reason: 'sign_out',
            userId: session?.user?.id,
            hadPreviousManager: hadManager,
          });

          return newVersion;
        });
      } else if (isNowAuthenticated && session) {
        // User signed in - create fresh manager
        const hadExistingManager = !!managerRef.current;
        logger.realtime(
          '🔑 User signed in - creating fresh SubscriptionManager',
          {
            userId: session.user?.id,
            hadExistingManager,
            version,
          },
        );

        // Ensure any existing manager is destroyed first
        if (managerRef.current) {
          logger.realtime(
            '🧹 Destroying existing manager before creating new one',
          );
          try {
            managerRef.current.destroy();
          } catch (error) {
            logger.error('❌ Error destroying existing manager:', error);
          }
        }

        // Create new manager instance
        try {
          const newManager = new SubscriptionManager();
          managerRef.current = newManager;
          setManager(newManager);
          setIsReady(true);
          setVersion((prev) => {
            const newVersion = prev + 1;
            logger.realtime(
              `📊 Version incremented: ${prev} → ${newVersion} (sign in)`,
            );
            logger.realtime(
              `✅ Enhanced SubscriptionManager initialized (version ${newVersion})`,
            );

            // Emit telemetry for manager reinit (creation)
            emitManagerReinit({
              version: newVersion,
              reason: 'sign_in',
              userId: session.user?.id,
              hadPreviousManager: hadExistingManager,
            });

            return newVersion;
          });
        } catch (error) {
          logger.error('❌ Failed to create new SubscriptionManager:', error);
          setManager(null);
          setIsReady(false);
        }
      }
    } else if (wasAuthenticated === null && isNowAuthenticated === null) {
      // Initial load - no change needed
      logger.realtime('🔄 Initial auth state check (both null)', {
        hasSession: !!session,
        version,
      });
    }

    previousAuthState.current = isNowAuthenticated;
  }, [isAuthenticated, session, version]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (managerRef.current) {
        logger.realtime(
          '🧹 Cleaning up SubscriptionManager on provider unmount',
        );
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
 *
 * Features:
 * - Returns null if manager is not ready (prevents crashes)
 * - Provides version for dependency arrays
 * - Automatically gets fresh manager after auth transitions
 * - Enhanced debugging for troubleshooting
 */
export function useSubscriptionManager(): SubscriptionContextType {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error(
      'useSubscriptionManager must be used within a SubscriptionProvider',
    );
  }

  // Debug logging for hook usage
  useEffect(() => {
    logger.realtime('🎣 useSubscriptionManager hook called', {
      hasManager: !!context.manager,
      isReady: context.isReady,
      version: context.version,
      managerState: context.manager ? 'active' : 'null',
    });
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
