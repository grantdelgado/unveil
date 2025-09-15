import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/app/reference/supabase.types';

// Minimal Supabase client for basic auth operations
// No realtime features to reduce bundle size
export const supabaseMinimal = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      debug: false,
    },
    // Minimal realtime config - no heartbeat or custom transport
    realtime: {
      timeout: 10000,
      logger: () => {}, // No logging to reduce bundle
    },
    global: {
      headers: {
        'X-Client-Info': 'unveil-minimal',
      },
    },
  },
);

export default supabaseMinimal;
