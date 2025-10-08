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
  // Check if dev splash is enabled
  const DEV_SPLASH = process.env.NEXT_PUBLIC_DEV_SPLASH === 'true';
  
  // If dev splash is enabled, show it instead of redirecting
  if (DEV_SPLASH) {
    return <DevSplash reason="dev_splash_enabled" />;
  }

  // Get the appropriate redirect path based on auth state
  const { redirect: redirectPath, reason } = await getAuthRedirect();
  
  // Server-side redirect - no client-side flash
  redirect(redirectPath);
}