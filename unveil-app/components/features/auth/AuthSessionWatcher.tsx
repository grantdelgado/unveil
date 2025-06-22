'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import { logAuth, logAuthError } from '@/lib/logger';

interface AuthSessionWatcherProps {
  children?: React.ReactNode;
}

export function AuthSessionWatcher({ children }: AuthSessionWatcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  const handleAuthenticatedUser = useCallback(
    async (authUser: User) => {
      try {
        logAuth('Handling authenticated user', { userId: authUser.id });

        // Fetch user profile from users table using auth.uid()
        const { data: userProfile, error: profileError } = await supabase
          .from('users')
          .select(
            'id, phone, full_name, email, avatar_url, created_at, updated_at',
          )
          .eq('id', authUser.id)
          .single();

        if (profileError) {
          logAuthError('Failed to fetch user profile', profileError);

          // If profile doesn't exist, redirect to login to recreate it
          if (profileError.code === 'PGRST116') {
            logAuth('No user profile found, redirecting to login');
            setLoading(false);
            setInitialized(true);
            if (pathname !== '/login') {
              router.push('/login');
            }
            return;
          }

          throw profileError;
        }

        if (userProfile) {
          logAuth('User profile loaded', { userId: userProfile.id });
          setLoading(false);
          setInitialized(true);

          // If on login page or root page and authenticated, redirect to select-event immediately
          if (pathname === '/login' || pathname === '/') {
            logAuth(
              'Authenticated user on login/root page, redirecting to select-event',
            );
            // Use replace instead of push to prevent back button issues
            router.replace('/select-event');
          } else {
            logAuth('User authenticated and profile loaded', { pathname });
          }
        } else {
          logAuth('No user profile data returned');
          setLoading(false);
          setInitialized(true);
          if (pathname !== '/login') {
            router.push('/login');
          }
        }
      } catch (error) {
        logAuthError('Error handling authenticated user', error);
        setLoading(false);
        setInitialized(true);
        if (pathname !== '/login') {
          router.push('/login');
        }
      }
    },
    [pathname, router],
  );

  const handleAuthStateChange = useCallback(
    async (
      event: string,
      session: Session | null,
      mounted: { current: boolean },
    ) => {
      if (!mounted.current) return;

      logAuth('Auth state change', {
        event,
        userId: session?.user?.id || 'no session',
      });

      try {
        if (session?.user) {
          // User is authenticated with valid Supabase session
          await handleAuthenticatedUser(session.user);
        } else {
          // No Supabase session - but don't immediately redirect on SIGNED_OUT events
          // as they might be temporary during token refresh
          logAuth('No Supabase session found');

          // Only redirect if this is an initial session check or token expired
          if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
            setLoading(false);
            setInitialized(true);

            // Only redirect to login if not already on login page
            if (pathname !== '/login') {
              logAuth('Redirecting to login from path', { pathname });
              router.push('/login');
            } else {
              logAuth('Already on login page, no redirect needed');
            }
          } else if (event === 'SIGNED_OUT') {
            // For SIGNED_OUT events, wait a moment to see if it's just a token refresh
            logAuth('User signed out, waiting for potential token refresh...');
            setTimeout(() => {
              if (!mounted.current) return;

              // Check if we still don't have a session after waiting
              supabase.auth
                .getSession()
                .then(({ data: { session: currentSession } }) => {
                  if (!currentSession && pathname !== '/login') {
                    logAuth('No session after timeout, redirecting to login');
                    setLoading(false);
                    setInitialized(true);
                    router.push('/login');
                  }
                });
            }, 1000); // Wait 1 second for potential token refresh
          }
        }
      } catch (error) {
        logAuthError('Auth state change error', error);
        setLoading(false);
        setInitialized(true);

        // Only redirect if not already on login page
        if (pathname !== '/login') {
          router.push('/login');
        }
      }
    },
    [handleAuthenticatedUser, pathname, router],
  );

  useEffect(() => {
    const mounted = { current: true };

    // Get initial session
    const getInitialSession = async () => {
      try {
        logAuth('Getting initial session...');
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          logAuthError('Error getting initial session', error);
          setLoading(false);
          setInitialized(true);
          return;
        }

        logAuth('Initial session result', { hasSession: !!session });
        await handleAuthStateChange('INITIAL_SESSION', session, mounted);
      } catch (error) {
        logAuthError('Error in getInitialSession', error);
        setLoading(false);
        setInitialized(true);
      }
    };

    // Set up auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      handleAuthStateChange(event, session, mounted);
    });

    // Get initial session
    getInitialSession();

    return () => {
      mounted.current = false;
      subscription.unsubscribe();
    };
  }, [handleAuthStateChange]);

  const loadingComponent = useMemo(
    () => (
      <div className="min-h-screen bg-app flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">💍</div>
          <div className="text-lg text-gray-600">Loading...</div>
        </div>
      </div>
    ),
    [],
  );

  // Show loading state while checking authentication (but not on login or root page)
  if (loading && !initialized && pathname !== '/login' && pathname !== '/') {
    return loadingComponent;
  }

  // Render children (the actual page content)
  return <>{children}</>;
}
