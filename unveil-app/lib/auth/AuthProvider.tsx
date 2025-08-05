'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { useAutoLinkGuests } from '@/hooks/useLinkGuestsToUser';

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
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        logger.error('Error getting initial session:', error);
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Single auth state change listener for the entire app
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Only log auth state changes in debug mode to reduce console noise
if (process.env.UNVEIL_DEBUG === 'true') {
  logger.auth(`Auth state changed: ${event}`, { userId: session?.user?.id || null });
}
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
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

  const value: AuthContextType = {
    session,
    user,
    loading,
    isAuthenticated: !!session,
    userPhone: user?.phone || user?.user_metadata?.phone,
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
 * Internal component to manage automatic guest linking
 * Runs guest linking when user sessions are established
 */
function GuestLinkingManager() {
  useAutoLinkGuests();
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