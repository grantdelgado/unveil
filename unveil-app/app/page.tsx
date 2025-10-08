import { redirect } from 'next/navigation';
import { getAuthRedirect } from '@/lib/auth/server-routing';
import { DevSplash } from '@/components/dev/DevSplash';

/**
 * SERVER-SIDE AUTH GATE
 * 
 * This page runs on the server and immediately redirects users based on their auth state.
 * No client-side flash or loading states - just clean server-side routing.
 * 
 * Dev splash is only shown when NEXT_PUBLIC_DEV_SPLASH=true for debugging.
 */
export default async function HomePage() {
  // Check if dev splash is enabled (only in development and explicitly set)
  const DEV_SPLASH = process.env.NODE_ENV === 'development' && 
                     process.env.NEXT_PUBLIC_DEV_SPLASH === 'true';
  
  // Debug logging
  if (process.env.NODE_ENV === 'development') {
    console.info('[HomePage] DEV_SPLASH:', DEV_SPLASH);
    console.info('[HomePage] NEXT_PUBLIC_DEV_SPLASH:', process.env.NEXT_PUBLIC_DEV_SPLASH);
  }
  
  // If dev splash is enabled, show it instead of redirecting
  if (DEV_SPLASH) {
    return <DevSplash reason="dev_splash_enabled" />;
  }

  // Get the appropriate redirect path based on auth state
  const { redirect: redirectPath, reason } = await getAuthRedirect();
  
  if (process.env.NODE_ENV === 'development') {
    console.info(`[HomePage] Redirecting to: ${redirectPath} (reason: ${reason})`);
  }
  
  // Server-side redirect - no client-side flash
  // Note: redirect() throws NEXT_REDIRECT which is normal behavior
  redirect(redirectPath);
}