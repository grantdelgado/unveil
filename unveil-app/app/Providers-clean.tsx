'use client';

import { ReactNode, createContext, useContext, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { qk } from '@/lib/queryKeys';
import { initQueryObservability } from '@/lib/queryObservability';

// Create a singleton QueryClient to avoid recreating on re-renders
let queryClient: QueryClient | undefined;

function getQueryClient() {
  if (!queryClient) {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 5 * 60 * 1000, // 5 minutes
          gcTime: 10 * 60 * 1000, // 10 minutes
          retry: (failureCount, error: unknown) => {
            const errorWithStatus = error as { status?: number };
            if (
              errorWithStatus?.status &&
              errorWithStatus.status >= 400 &&
              errorWithStatus.status < 500
            ) {
              return false;
            }
            return failureCount < 3;
          },
          retryDelay: (attemptIndex) =>
            Math.min(1000 * 2 ** attemptIndex, 30000),
          refetchOnWindowFocus: false,
          refetchOnReconnect: 'always',
        },
        mutations: {
          retry: (failureCount, error: unknown) => {
            const errorWithStatus = error as { status?: number };
            if (
              errorWithStatus?.status &&
              errorWithStatus.status >= 400 &&
              errorWithStatus.status < 500
            ) {
              return false;
            }
            return failureCount < 1;
          },
        },
      },
    });

    // Set per-domain query defaults using canonical keys
    queryClient.setQueryDefaults(qk.messages.list('placeholder'), {
      staleTime: 30_000, // 30 seconds
      gcTime: 5 * 60_000, // 5 minutes
      refetchOnWindowFocus: false,
    });

    queryClient.setQueryDefaults(qk.media.feed('placeholder'), {
      staleTime: 10 * 60_000, // 10 minutes 
      gcTime: 20 * 60_000, // 20 minutes
      refetchOnWindowFocus: false,
    });

    queryClient.setQueryDefaults(qk.eventGuests.list('placeholder'), {
      staleTime: 60_000, // 1 minute
      gcTime: 10 * 60_000, // 10 minutes
      refetchOnWindowFocus: false,
    });

    queryClient.setQueryDefaults(qk.eventGuests.counts('placeholder'), {
      staleTime: 30_000, // 30 seconds
      gcTime: 5 * 60_000, // 5 minutes
      refetchOnWindowFocus: false,
    });

    queryClient.setQueryDefaults(qk.scheduledMessages.list('placeholder'), {
      staleTime: 0, // Always stale, always fresh
      gcTime: 10 * 60_000, // 10 minutes
      refetchOnWindowFocus: true,
      refetchOnMount: 'always',
    });

    queryClient.setQueryDefaults(qk.analytics.event('placeholder'), {
      staleTime: 15 * 60_000, // 15 minutes
      gcTime: 30 * 60_000, // 30 minutes
      refetchOnWindowFocus: false,
    });

    queryClient.setQueryDefaults(qk.events.listMine(), {
      staleTime: 15 * 60_000, // 15 minutes
      gcTime: 30 * 60_000, // 30 minutes
      refetchOnWindowFocus: false,
    });

    queryClient.setQueryDefaults(qk.users.me(), {
      staleTime: 60 * 60_000, // 1 hour
      gcTime: 24 * 60 * 60_000, // 24 hours
      refetchOnWindowFocus: false,
    });

    // Auto-initialize observability (noop in production)
    initQueryObservability(queryClient);
  }
  return queryClient;
}

// AuthContext
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
 * CLEAN AUTH PROVIDER
 * Simplified auth state management without complex dependencies
 * All browser APIs are guarded within useEffect
 */
function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let isMounted = true;

    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        if (error) {
          console.error('Error getting initial session:', error);
        } else {
          setSession(session);
          setUser(session?.user ?? null);
          
          if (process.env.NODE_ENV === 'development') {
            console.info('[AuthProvider] session resolved', { 
              authenticated: !!session,
              userId: session?.user?.id || null 
            });
          }
        }
      } catch (error) {
        if (!isMounted) return;
        console.error('Failed to initialize auth:', error);
        setSession(null);
        setUser(null);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      
      if (process.env.NODE_ENV === 'development') {
        console.info(`[AuthProvider] ${event}`, { userId: session?.user?.id || null });
      }

      setSession(session);
      setUser(session?.user ?? null);
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
        console.error('Error signing out:', error);
        throw error;
      }
    } catch (error) {
      console.error('Sign out failed:', error);
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
    userPhone: user?.phone || user?.user_metadata?.phone || null,
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
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface ProvidersProps {
  children: ReactNode;
}

/**
 * 🚀 CLEAN DETERMINISTIC PROVIDERS
 * 
 * Static imports only for deterministic first paint on iOS:
 * - No next/dynamic imports that cause CSR bailouts
 * - Singleton QueryClient to prevent recreation
 * - Browser APIs are guarded inside useEffect
 * - Minimal JavaScript bundle for critical rendering path
 * - Sentry/RUM isolated to page level (not root level)
 */
export function Providers({ children }: ProvidersProps) {
  // Log provider mount for observability (PII-safe, dev only)
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.info('[Providers] mounted - clean deterministic providers');
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={getQueryClient()}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
