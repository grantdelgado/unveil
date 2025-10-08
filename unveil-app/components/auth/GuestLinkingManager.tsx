'use client';

import { useEffect, useRef } from 'react';
import { useAutoJoinGuests } from '@/hooks/auth/useAutoJoinGuests';
import { useAuth } from '@/lib/auth/MinimalAuthProvider';

/**
 * Guest Linking Manager Component
 * 
 * Handles automatic guest joining after authentication.
 * This is separated from AuthProvider to avoid circular dependencies
 * with QueryClient - it can be mounted after providers are ready.
 */
export function GuestLinkingManager() {
  const { processAutoJoin } = useAutoJoinGuests();
  const { isAuthenticated, user, userPhone } = useAuth();
  const hasProcessedRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && user) {
      // Only process if we haven't processed this user yet
      const currentUserId = user.id;
      const shouldProcess =
        !hasProcessedRef.current || lastUserIdRef.current !== currentUserId;

      if (shouldProcess) {
        hasProcessedRef.current = true;
        lastUserIdRef.current = currentUserId;

        // Log auto-join attempt for debugging (can be removed after verification)
        if (process.env.NODE_ENV === 'development') {
          console.log('GuestLinkingManager: Starting auto-join', {
            userId: currentUserId,
            userPhone: userPhone,
            hasPhone: !!userPhone,
          });
        }

        // Run auto-join with error handling to prevent page break
        processAutoJoin(currentUserId, userPhone || undefined).catch(
          (error) => {
            console.warn(
              'Auto-join failed but continuing with app load:',
              error,
            );
          },
        );
      }
    }
  }, [
    isAuthenticated,
    user?.id,
    userPhone,
    user,
    processAutoJoin,
  ]);

  return null; // This component has no UI
}
