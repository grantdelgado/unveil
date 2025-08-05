import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/app/reference/supabase.types';

// Validate required environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL');
}

if (!supabaseServiceKey) {
  throw new Error('Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY');
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
export const supabaseAdmin = createClient<Database>(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      // Disable auth for service role client
      autoRefreshToken: false,
      persistSession: false,
    },
    // Disable realtime for admin client (not needed for API operations)
    realtime: {
      enabled: false
    },
    global: {
      headers: {
        'X-Client-Info': 'unveil-admin-v1',
      },
    },
  }
);

// Test function to verify admin client is working
export async function testAdminConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from('events')
      .select('id')
      .limit(1);
    
    return !error;
  } catch (error) {
    console.error('Admin client connection test failed:', error);
    return false;
  }
}