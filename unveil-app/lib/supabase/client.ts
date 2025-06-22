import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/app/reference/supabase.types';

// Create typed Supabase client with enhanced session management
export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      // Persist session in localStorage
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      // Auto refresh tokens
      autoRefreshToken: true,
      // Persist session across browser tabs
      persistSession: true,
      // Detect session in URL (for magic links, etc.)
      detectSessionInUrl: true,
      // Longer session timeout (24 hours)
      flowType: 'pkce',
    },
    // Global request timeout
    global: {
      headers: {
        'X-Client-Info': 'unveil-wedding-app',
      },
    },
  },
);
