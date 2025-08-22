import { supabase } from '@/lib/supabase/client';

/**
 * Debug utility for authentication issues
 * Call this in the browser console to get detailed auth state information
 */
export async function debugAuthState(): Promise<void> {
  console.group('🔍 Auth Debug Information');

  try {
    // Check current session
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    console.log('📊 Current Session:', {
      hasSession: !!session,
      userId: session?.user?.id || 'none',
      email: session?.user?.email || 'none',
      expiresAt: session?.expires_at
        ? new Date(session.expires_at * 1000).toISOString()
        : 'none',
      hasAccessToken: !!session?.access_token,
      hasRefreshToken: !!session?.refresh_token,
      error: error?.message || 'none',
    });

    // Check localStorage for auth tokens
    if (typeof window !== 'undefined') {
      console.log('💾 LocalStorage Auth Keys:');
      const authKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.startsWith('supabase.auth.token') ||
            key.startsWith('sb-') ||
            key.includes('auth-token'))
        ) {
          authKeys.push({
            key,
            hasValue: !!localStorage.getItem(key),
            valueLength: localStorage.getItem(key)?.length || 0,
          });
        }
      }
      console.table(authKeys);
    }

    // Test auth user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    console.log('👤 Current User:', {
      hasUser: !!user,
      userId: user?.id || 'none',
      email: user?.email || 'none',
      phone: user?.phone || 'none',
      lastSignIn: user?.last_sign_in_at || 'none',
      error: userError?.message || 'none',
    });
  } catch (error: unknown) {
    console.error('❌ Error debugging auth state:', error);
  }

  console.groupEnd();
}

/**
 * Clear all authentication data (useful for debugging)
 */
export async function clearAllAuthData(): Promise<void> {
  console.log('🧹 Clearing all authentication data...');

  try {
    // Sign out from Supabase
    await supabase.auth.signOut();

    // Clear localStorage
    if (typeof window !== 'undefined') {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.startsWith('supabase.auth.token') ||
            key.startsWith('sb-') ||
            key.includes('auth-token') ||
            key.includes('access_token') ||
            key.includes('refresh_token'))
        ) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach((key) => localStorage.removeItem(key));
      console.log(
        `🗑️ Removed ${keysToRemove.length} auth keys from localStorage`,
      );
    }

    console.log('✅ All authentication data cleared');
    console.log('🔄 Please refresh the page to complete the reset');
  } catch (error) {
    console.error('❌ Error clearing auth data:', error);
  }
}

// Make functions available globally in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as unknown as Record<string, unknown>).debugAuthState =
    debugAuthState;
  (window as unknown as Record<string, unknown>).clearAllAuthData =
    clearAllAuthData;
  console.log(
    '🛠️ Auth debug functions available: debugAuthState(), clearAllAuthData()',
  );
}
