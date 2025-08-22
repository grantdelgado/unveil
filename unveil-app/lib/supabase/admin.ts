import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/app/reference/supabase.types';

// Lazy initialization to avoid environment variable validation during build
let _supabaseAdmin: ReturnType<typeof createClient<Database>> | null = null;

function createAdminClient() {
  // Validate required environment variables only when client is actually used
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      'Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL',
    );
  }

  if (!supabaseServiceKey) {
    throw new Error(
      'Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY',
    );
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      // Disable auth for service role client
      autoRefreshToken: false,
      persistSession: false,
    },
    // Note: Realtime is not needed for admin operations
    global: {
      headers: {
        'X-Client-Info': 'unveil-admin-v1',
      },
    },
  });
}

/**
 * Service Role Supabase Client (Admin)
 *
 * This client has full admin privileges and bypasses RLS.
 * Use ONLY for:
 * - Server-side operations that require admin access
 * - Operations that need to bypass RLS (like event existence checks)
 * - Background tasks and API routes
 *
 * NEVER expose this client to the browser/client-side code.
 */
export const supabaseAdmin = new Proxy(
  {} as ReturnType<typeof createClient<Database>>,
  {
    get(target, prop) {
      if (!_supabaseAdmin) {
        _supabaseAdmin = createAdminClient();
      }
      return _supabaseAdmin[prop as keyof typeof _supabaseAdmin];
    },
  },
);

// Export as 'supabase' for backward compatibility with existing imports
export const supabase = supabaseAdmin;

// Test function to verify admin client is working
export async function testAdminConnection(): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin.from('events').select('id').limit(1);

    return !error;
  } catch (error) {
    console.error('Admin client connection test failed:', error);
    return false;
  }
}
