'use client';

import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { useAutoJoinGuests } from '@/hooks/auth/useAutoJoinGuests';
import { clearCorruptedAuthState, isRefreshTokenError } from './clearAuthState';
import { normalizePhoneNumber } from '@/lib/utils/phone';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  userPhone: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * 🚀 PERFORMANCE OPTIMIZATION: Centralized auth provider
 * 
 * Centralized auth provider that manages a single Supabase auth subscription:
 * - Eliminates multiple auth subscriptions across components
 * - Prevents auth state duplication and race conditions
 * - Reduces memory usage and subscription overhead
 * - Provides consistent auth state throughout the app
 * - Better error handling with centralized auth logic
 * 
 * Week 3: Replaced individual useAuth hooks with single provider context
 * Impact: Eliminated N auth subscriptions → 1 centralized subscription
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let isMounted = true;

    // Get initial session with proper error handling
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!isMounted) return;

        if (error) {
          logger.error('Error getting initial session:', error);
          
          // If it's a refresh token error, clear the corrupted state
          if (isRefreshTokenError(error)) {
            logger.auth('Detected refresh token error, clearing corrupted auth state');
            await clearCorruptedAuthState();
            setSession(null);
            setUser(null);
          }
        } else {
          setSession(session);
          setUser(session?.user ?? null);
        }
      } catch (error: any) {
        if (!isMounted) return;
        logger.error('Failed to initialize auth:', error);
        
        // Clear any corrupted auth state
        if (isRefreshTokenError(error)) {
          await clearCorruptedAuthState();
        } else {
          try {
            await supabase.auth.signOut({ scope: 'local' });
          } catch (signOutError) {
            logger.error('Failed to clear auth state:', signOutError);
          }
        }
        setSession(null);
        setUser(null);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Single auth state change listener for the entire app
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      // Only log auth state changes in debug mode to reduce console noise
      if (process.env.UNVEIL_DEBUG === 'true') {
        logger.auth(`Auth state changed: ${event}`, { userId: session?.user?.id || null });
      }

      // Handle specific auth events
      if (event === 'TOKEN_REFRESHED') {
        logger.auth('Token refreshed successfully');
      } else if (event === 'SIGNED_OUT') {
        logger.auth('User signed out');
      } else if (event === 'SIGNED_IN') {
        logger.auth('User signed in');
      }

      setSession(session);
      setUser(session?.user ?? null);
      
      // Ensure loading is false after any auth state change
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) {
        logger.error('Error signing out:', error);
        throw error;
      }
    } catch (error) {
      logger.error('Sign out failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Extract and normalize phone number from user data
  const extractedPhone = user?.phone || user?.user_metadata?.phone;
  const normalizedUserPhone = extractedPhone ? normalizePhoneNumber(extractedPhone) : null;

  const value: AuthContextType = {
    session,
    user,
    loading,
    isAuthenticated: !!session,
    userPhone: normalizedUserPhone?.isValid ? normalizedUserPhone.normalized : extractedPhone,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      <GuestLinkingManager />
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to use the centralized auth context
 * Replaces the individual useAuth hook for better performance
 */
/**
 * Internal component to manage automatic guest joining
 * Runs auto-join when user sessions are established
 */
function GuestLinkingManager() {
  const { processAutoJoin } = useAutoJoinGuests();
  const context = useContext(AuthContext);
  const hasProcessedRef = useRef(false);

  useEffect(() => {
    if (context?.isAuthenticated && context?.user && !hasProcessedRef.current) {
      hasProcessedRef.current = true;
      
      // Log auto-join attempt for debugging (can be removed after verification)
      if (process.env.NODE_ENV === 'development') {
        console.log('GuestLinkingManager: Starting auto-join', {
          userId: context.user.id,
          userPhone: context.userPhone,
          hasPhone: !!context.userPhone
        });
      }
      
      processAutoJoin(context.user.id, context.userPhone || undefined);
    }
  }, [context?.isAuthenticated, context?.user, context?.userPhone, processAutoJoin]);

  return null; // This component has no UI
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Export alias for compatibility with existing code
export const useSupabase = useAuth;