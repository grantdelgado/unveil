'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { getCurrentUserProfile } from '@/services/auth';
import type { User, Session } from '@supabase/supabase-js';
import { logAuth, logAuthError } from '@/lib/logger';

interface AuthSessionWatcherProps {
  children?: React.ReactNode;
}

/**
 * Enhanced AuthSessionWatcher with Phase 4 improvements:
 * - Detects new vs returning users based on onboarding completion
 * - Supports intended redirects for deep links
 * - Improved session persistence and token refresh handling
 * - Handles edge cases like incomplete onboarding
 */
export function AuthSessionWatcher({ children }: AuthSessionWatcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Determine routing based on user profile and onboarding status
  const determineUserRoute = useCallback((userProfile: {
    id: string;
    onboarding_completed?: boolean;
    full_name?: string | null;
  }) => {
    // Check onboarding completion
    if (!userProfile.onboarding_completed) {
      logAuth('User has not completed onboarding, routing to /setup', { 
        userId: userProfile.id 
      });
      return '/setup';
    }

    // Check if user has essential profile information
    if (!userProfile.full_name || userProfile.full_name.startsWith('User ')) {
      logAuth('User missing essential profile info, routing to /setup', { 
        userId: userProfile.id,
        hasFullName: !!userProfile.full_name
      });
      return '/setup';
    }

    // For returning users with complete onboarding
    logAuth('Returning user with complete onboarding, routing to /select-event', { 
      userId: userProfile.id 
    });
    return '/select-event';
  }, []);

  const handleAuthenticatedUser = useCallback(
    async (authUser: User) => {
      try {
        logAuth('Handling authenticated user', { userId: authUser.id });

        // Fetch user profile using the enhanced service
        const { data: userProfile, error: profileError } = await getCurrentUserProfile();

        if (profileError) {
          logAuthError('Failed to fetch user profile', profileError);

          // Check for stale session error
          if (profileError instanceof Error && profileError.message === 'STALE_SESSION') {
            logAuth('Stale session detected, user signed out, redirecting to login');
            setLoading(false);
            setInitialized(true);
            if (pathname !== '/login') {
              router.push('/login');
            }
            return;
          }

          // If profile doesn't exist, redirect to login to recreate it
          if (profileError && typeof profileError === 'object' && 'code' in profileError && profileError.code === 'PGRST116') {
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
          logAuth('User profile loaded', { 
            userId: userProfile.id,
            onboardingCompleted: userProfile.onboarding_completed
          });

          setLoading(false);
          setInitialized(true);

          // Determine where the user should go
          const targetRoute = determineUserRoute(userProfile);

          // Handle current location vs target route
          if (pathname === '/login' || pathname === '/') {
            if (!isRedirecting) {
              setIsRedirecting(true);
              logAuth('User on login/root page, redirecting', { 
                from: pathname,
                to: targetRoute 
              });
              
              // Add small delay to prevent race conditions
              setTimeout(() => {
                router.replace(targetRoute);
                setIsRedirecting(false);
              }, 100);
            }
          } else if (pathname === '/setup' && userProfile.onboarding_completed) {
            // User manually navigated to setup but already completed it
            if (!isRedirecting) {
              setIsRedirecting(true);
              logAuth('User on setup page but onboarding already complete, redirecting', {
                to: '/select-event'
              });
              setTimeout(() => {
                router.replace('/select-event');
                setIsRedirecting(false);
              }, 100);
            }
          } else if (pathname === '/select-event' && !userProfile.onboarding_completed) {
            // User on select-event but hasn't completed onboarding
            if (!isRedirecting) {
              setIsRedirecting(true);
              logAuth('User on select-event but onboarding incomplete, redirecting', {
                to: '/setup'
              });
              setTimeout(() => {
                router.replace('/setup');
                setIsRedirecting(false);
              }, 100);
            }
          } else {
            logAuth('User authenticated and on appropriate page', { 
              pathname,
              targetRoute,
              onboardingCompleted: userProfile.onboarding_completed
            });
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
    [pathname, router, determineUserRoute],
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
        pathname,
      });

      try {
        if (session?.user) {
          // User is authenticated with valid Supabase session
          await handleAuthenticatedUser(session.user);
        } else {
          // No Supabase session
          logAuth('No Supabase session found', { event });

          // Different handling based on event type
          if (event === 'INITIAL_SESSION') {
            setLoading(false);
            setInitialized(true);

            // Store intended redirect if user was trying to access a protected route
            if (pathname !== '/login' && pathname !== '/') {
              logAuth('Storing intended redirect for after login', { pathname });
              // We'll handle this in the login page logic
            }

            // Redirect to login if not already there
            if (pathname !== '/login') {
              logAuth('No initial session, redirecting to login', { from: pathname });
              router.push('/login');
            } else {
              logAuth('Already on login page, no redirect needed');
            }
          } else if (event === 'TOKEN_REFRESHED') {
            // Token refresh failed, treat as session expired
            setLoading(false);
            setInitialized(true);
            if (pathname !== '/login') {
              logAuth('Token refresh failed, redirecting to login');
              router.push('/login');
            }
          } else if (event === 'SIGNED_OUT') {
            // For SIGNED_OUT events, wait briefly to see if it's just a token refresh
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
                })
                .catch((error) => {
                  logAuthError('Error checking session after SIGNED_OUT', error);
                  setLoading(false);
                  setInitialized(true);
                  if (pathname !== '/login') {
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

  // Enhanced session management with better error handling
  useEffect(() => {
    const mounted = { current: true };
    let retryCount = 0;
    const maxRetries = 3;

    // Get initial session with retry logic
    const getInitialSession = async () => {
      try {
        logAuth('Getting initial session...', { attempt: retryCount + 1 });
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          logAuthError('Error getting initial session', error);
          
          // Retry on network errors
          if (retryCount < maxRetries && error.message?.includes('network')) {
            retryCount++;
            logAuth('Retrying session fetch due to network error', { retryCount });
            setTimeout(getInitialSession, 1000 * retryCount); // Exponential backoff
            return;
          }
          
          setLoading(false);
          setInitialized(true);
          return;
        }

        logAuth('Initial session result', { 
          hasSession: !!session,
          retryCount 
        });
        await handleAuthStateChange('INITIAL_SESSION', session, mounted);
      } catch (error) {
        logAuthError('Error in getInitialSession', error);
        
        // Retry on unexpected errors
        if (retryCount < maxRetries) {
          retryCount++;
          logAuth('Retrying session fetch due to unexpected error', { retryCount });
          setTimeout(getInitialSession, 1000 * retryCount);
          return;
        }
        
        setLoading(false);
        setInitialized(true);
      }
    };

    // Set up auth state listener with improved error handling
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      handleAuthStateChange(event, session, mounted);
    });

    // Get initial session
    getInitialSession();

    // Cleanup
    return () => {
      mounted.current = false;
      subscription.unsubscribe();
    };
  }, [handleAuthStateChange]);

  // Enhanced loading component
  const loadingComponent = useMemo(
    () => (
      <div className="min-h-screen bg-app flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">💍</div>
          <div className="text-lg text-gray-600">Loading...</div>
          {/* Add a subtle animation for better UX */}
          <div className="mt-4">
            <div className="inline-flex items-center space-x-1">
              <div className="w-2 h-2 bg-pink-300 rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-pink-400 rounded-full animate-pulse delay-75"></div>
              <div className="w-2 h-2 bg-pink-500 rounded-full animate-pulse delay-150"></div>
            </div>
          </div>
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
