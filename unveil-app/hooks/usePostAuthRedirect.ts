import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { logAuth, logAuthError } from '@/lib/logger';

interface PostAuthRedirectOptions {
  phone: string;
  userId: string;
}

interface UsePostAuthRedirectReturn {
  handlePostAuthRedirect: (options: PostAuthRedirectOptions) => Promise<void>;
}

/**
 * Hook to handle post-authentication routing logic
 * 
 * After successful OTP verification, this hook:
 * 1. Checks if user exists in users table
 * 2. Checks if onboarding_completed = true
 * 3. Routes accordingly:
 *    - User exists + onboarding_completed = true → /select-event
 *    - User exists + onboarding_completed = false → /setup  
 *    - User doesn't exist → Create user + route to /setup
 */
export function usePostAuthRedirect(): UsePostAuthRedirectReturn {
  const router = useRouter();

  const handlePostAuthRedirect = useCallback(async (options: PostAuthRedirectOptions) => {
    const { phone, userId } = options;
    
    try {
      logAuth('Starting post-auth redirect flow', { phone, userId });

      // Check if user exists in users table using Supabase MCP
      const response = await fetch('/api/auth/check-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, phone }),
      });

      if (!response.ok) {
        throw new Error(`Failed to check user: ${response.statusText}`);
      }

      const { userExists, onboardingCompleted, userCreated } = await response.json();

      logAuth('User check complete', { 
        userExists, 
        onboardingCompleted, 
        userCreated 
      });

      // Route based on user status
      if (userExists && onboardingCompleted) {
        logAuth('Routing to select-event (existing user, setup complete)');
        router.replace('/select-event');
      } else {
        logAuth('Routing to setup (new user or setup incomplete)');
        router.replace('/setup');
      }

    } catch (error) {
      logAuthError('Post-auth redirect failed', error);
      // Fallback to setup page for safety
      router.replace('/setup');
    }
  }, [router]);

  return { handlePostAuthRedirect };
} 