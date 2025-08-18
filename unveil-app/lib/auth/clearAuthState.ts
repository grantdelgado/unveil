import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

/**
 * Utility function to clear corrupted authentication state
 * This helps recover from invalid refresh token errors
 */
export async function clearCorruptedAuthState(): Promise<void> {
  try {
    logger.auth('Clearing corrupted authentication state...');
    
    // Sign out locally only (don't make API call since session is invalid)
    await supabase.auth.signOut({ scope: 'local' });
    
    // Clear any remaining auth-related items from localStorage
    if (typeof window !== 'undefined') {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.startsWith('supabase.auth.token') ||
          key.startsWith('sb-') ||
          key.includes('auth-token') ||
          key.includes('access_token') ||
          key.includes('refresh_token')
        )) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        logger.auth(`Removed corrupted auth key: ${key}`);
      });
    }
    
    logger.auth('Authentication state cleared successfully');
  } catch (error) {
    logger.error('Failed to clear corrupted auth state:', error);
  }
}

/**
 * Check if an error is related to invalid refresh tokens
 */
export function isRefreshTokenError(error: unknown): boolean {
  if (!error) return false;
  
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('Invalid Refresh Token') ||
    message.includes('Refresh Token Not Found') ||
    message.includes('refresh_token_not_found') ||
    message.includes('invalid_grant') ||
    (error && typeof error === 'object' && 'status' in error && (error as { status: number }).status === 400)
  );
}
