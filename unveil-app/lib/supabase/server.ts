import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/app/reference/supabase.types';

/**
 * Create a Supabase client for server-side operations
 * This client should ONLY be used in server components, API routes, and server actions
 * Compatible with Next.js 15 async cookies API
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // Handle cookie setting errors gracefully
            // This can happen during server-side rendering
            console.warn('Failed to set cookie:', name, error);
          }
        },
        remove(name: string, options: Record<string, unknown>) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            // Handle cookie removal errors gracefully
            console.warn('Failed to remove cookie:', name, error);
          }
        },
      },
    }
  );
}

/**
 * Create a Supabase client for API routes
 * This version handles cookies differently for API routes
 * Parses cookies from request headers instead of using Next.js cookies() API
 */
export function createApiSupabaseClient(request: Request) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          const cookies = request.headers.get('cookie');
          if (!cookies) return undefined;
          
          const cookie = cookies
            .split(';')
            .find(c => c.trim().startsWith(`${name}=`));
          
          return cookie ? cookie.split('=')[1] : undefined;
        },
        set() {
          // API routes handle setting cookies via response headers
          // This is intentionally empty for API route clients
        },
        remove() {
          // API routes handle removing cookies via response headers  
          // This is intentionally empty for API route clients
        },
      },
    }
  );
}
