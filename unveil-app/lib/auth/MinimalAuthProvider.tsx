'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
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

interface MinimalAuthProviderProps {
  children: ReactNode;
}

/**
 * 🚀 MINIMAL AUTH PROVIDER: For deterministic first paint
 *
 * Minimal auth provider without GuestLinkingManager to avoid circular dependencies:
 * - No useQueryClient dependencies that require QueryClientProvider to be mounted first
 * - Provides essential auth state management only
 * - GuestLinkingManager can be added separately after providers are mounted
 * - Maintains same AuthContext interface for compatibility
 *
 * This prevents the "Cannot read properties of undefined (reading 'call')" error
 * that occurs when AuthProvider tries to use QueryClient before it's available.
 */
export function MinimalAuthProvider({ children }: MinimalAuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let isMounted = true;

    // Get initial session with proper error handling
    const initializeAuth = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (error) {
          logger.error('Error getting initial session:', error);

          // If it's a refresh token error, clear the corrupted state
          if (isRefreshTokenError(error)) {
            logger.auth(
              'Detected refresh token error, clearing corrupted auth state',
            );
            await clearCorruptedAuthState();
            setSession(null);
            setUser(null);
          }
        } else {
          setSession(session);
          setUser(session?.user ?? null);
        }
      } catch (error: unknown) {
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
        logger.auth(`Auth state changed: ${event}`, {
          userId: session?.user?.id || null,
        });
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
  const normalizedUserPhone = extractedPhone
    ? normalizePhoneNumber(extractedPhone)
    : null;

  const value: AuthContextType = {
    session,
    user,
    loading,
    isAuthenticated: !!session,
    userPhone: normalizedUserPhone?.isValid
      ? normalizedUserPhone.normalized
      : extractedPhone,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within a MinimalAuthProvider');
  }
  return context;
}

// Export alias for compatibility with existing code
export const useSupabase = useAuth;
