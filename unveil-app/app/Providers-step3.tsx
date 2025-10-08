'use client';

import { ReactNode, createContext, useContext, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';

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
  }
  return queryClient;
}

// Minimal AuthContext
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
 * MINIMAL AUTH PROVIDER - Step 3
 * Basic auth state management without complex hooks or dependencies
 */
function MinimalAuthProvider({ children }: MinimalAuthProviderProps) {
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
        console.info(`[MinimalAuth] ${event}`, { userId: session?.user?.id || null });
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

interface ProvidersStep3Props {
  children: ReactNode;
}

/**
 * STEP 3: QueryClient + Minimal Auth + ErrorBoundary
 * Add error boundary for graceful error handling
 */
export function ProvidersStep3({ children }: ProvidersStep3Props) {
  // Log provider mount for observability (PII-safe, dev only)
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.info('[ProvidersStep3] mounted - QueryClient + MinimalAuth + ErrorBoundary');
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={getQueryClient()}>
        <MinimalAuthProvider>
          {children}
        </MinimalAuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
