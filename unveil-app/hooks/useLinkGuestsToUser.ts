/**
 * Hook: useLinkGuestsToUser
 * Purpose: Automatically link unlinked guest records when user logs in
 * Runs on app load after Supabase session is established
 */

import { useEffect, useRef, useState } from 'react';
import { useSupabase } from '@/lib/auth/AuthProvider';
import { logger } from '@/lib/logger';

interface LinkGuestsResult {
  success: boolean;
  linkedCount: number;
  message: string;
}

interface UseLinkGuestsToUserReturn {
  isLinking: boolean;
  linkResult: LinkGuestsResult | null;
  error: string | null;
  triggerLink: () => Promise<void>;
}

/**
 * Hook to automatically link guest records to user accounts
 * 
 * Features:
 * - Runs automatically when user session loads
 * - Prevents duplicate API calls during session
 * - Provides manual trigger option
 * - Idempotent (safe to run multiple times)
 * - Only runs for authenticated users
 * 
 * @param options Configuration options
 * @returns Link status and manual trigger function
 */
export function useLinkGuestsToUser(options: {
  autoRun?: boolean; // Whether to run automatically on session load (default: true)
  onSuccess?: (result: LinkGuestsResult) => void;
  onError?: (error: string) => void;
} = {}): UseLinkGuestsToUserReturn {
  
  const { autoRun = true, onSuccess, onError } = options;
  const { session, user } = useSupabase();
  
  const [isLinking, setIsLinking] = useState(false);
  const [linkResult, setLinkResult] = useState<LinkGuestsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Track if we've already attempted linking in this session
  const hasAttemptedLinking = useRef(false);
  const sessionIdRef = useRef<string | null>(null);

  /**
   * Core function to call the guest linking API
   */
  const performGuestLinking = async (): Promise<void> => {
    if (!session?.user || !user) {
      logger.warn('Attempted guest linking without valid session');
      return;
    }

    if (isLinking) {
      logger.info('Guest linking already in progress, skipping');
      return;
    }

    try {
      setIsLinking(true);
      setError(null);

      logger.info('Starting guest record linking', {
        userId: user.id,
        phone: user.phone
      });

      // Get current session for authentication
      const { supabase } = await import('@/lib/supabase/client');
      const { data: { session } } = await supabase.auth.getSession();
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // Add authorization header if session exists
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/guests/link-unlinked', {
        method: 'POST',
        headers,
        credentials: 'include', // Include cookies for session
        body: JSON.stringify({
          userId: user.id,
          phone: user.phone
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `API request failed with status ${response.status}`);
      }

      const result: LinkGuestsResult = {
        success: data.success,
        linkedCount: data.linkedCount,
        message: data.message
      };

      setLinkResult(result);
      
      logger.info('Guest linking completed successfully', {
        userId: user.id,
        linkedCount: result.linkedCount
      });

      // Call success callback if provided
      onSuccess?.(result);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      
      logger.error('Guest linking failed', {
        userId: user?.id,
        error: errorMessage
      });

      // Call error callback if provided
      onError?.(errorMessage);

    } finally {
      setIsLinking(false);
    }
  };

  /**
   * Manual trigger function for explicit guest linking
   */
  const triggerLink = async (): Promise<void> => {
    await performGuestLinking();
  };

  /**
   * Auto-run effect: runs when session loads and autoRun is enabled
   */
  useEffect(() => {
    // Only run if autoRun is enabled and we have a valid session
    if (!autoRun || !session?.user || !user) {
      return;
    }

    // Check if this is a new session or if we haven't attempted linking yet
    const currentSessionId = session.access_token;
    const isNewSession = sessionIdRef.current !== currentSessionId;
    
    if (isNewSession) {
      sessionIdRef.current = currentSessionId;
      hasAttemptedLinking.current = false;
    }

    // Only attempt linking once per session
    if (hasAttemptedLinking.current) {
      return;
    }

    // Only attempt linking if user has a phone number
    if (!user.phone) {
      logger.info('Skipping guest linking - user has no phone number', {
        userId: user.id
      });
      return;
    }

    hasAttemptedLinking.current = true;

    // Small delay to ensure session is fully established
    const timeoutId = setTimeout(() => {
      performGuestLinking();
    }, 1000);

    return () => clearTimeout(timeoutId);

  }, [session, user, autoRun]);

  return {
    isLinking,
    linkResult,
    error,
    triggerLink
  };
}

/**
 * Simple hook variant that just runs linking automatically
 * Use this if you only need the automatic linking behavior
 */
export function useAutoLinkGuests(): void {
  useLinkGuestsToUser({ autoRun: true });
}