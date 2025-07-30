import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { logAuth, logAuthError } from '@/lib/logger';
import { supabase } from '@/lib/supabase/client';

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

      // Check if user exists in users table (direct query for better performance)
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('id, onboarding_completed')
        .eq('id', userId)
        .single();

      let userExists = false;
      let onboardingCompleted = false;
      let userCreated = false;

      if (fetchError && fetchError.code !== 'PGRST116') {
        // PGRST116 = No rows found (expected for new users)
        logAuthError('Failed to fetch user during post-auth redirect', fetchError);
        throw new Error(`Failed to fetch user: ${fetchError.message}`);
      }

      if (existingUser) {
        userExists = true;
        onboardingCompleted = existingUser.onboarding_completed;
      } else {
        // Create new user
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: userId,
            phone: phone,
            onboarding_completed: false,
          });

        if (insertError) {
          throw new Error(`Failed to create user: ${insertError.message}`);
        }

        userExists = true;
        onboardingCompleted = false;
        userCreated = true;
      }

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