import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/app/reference/supabase.types';
import { logger } from '@/lib/logger';

// Create typed Supabase client with enhanced session management and realtime configuration
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
    // Enhanced realtime configuration to prevent timeouts
    realtime: {
      // Increase timeout to 30 seconds (default is 10)
      timeout: 30000,
      // Enable heartbeat every 30 seconds to keep connection alive
      heartbeatIntervalMs: 30000,
      // Reconnect automatically with exponential backoff
      reconnectAfterMs: (tries: number) => Math.min(1000 * Math.pow(2, tries), 30000),
      // Log realtime events for debugging - must be a function
      logger: process.env.NODE_ENV === 'development' 
        ? (kind: string, msg: string, data?: unknown) => {
            logger.realtime(`[Realtime ${kind}] ${msg}`, data);
          }
        : undefined,
      // Custom headers for realtime connection
      headers: {
        'X-Client-Info': 'unveil-realtime-v2',
        'X-Client-Version': '2.0.0',
      },
      // Remove transport config - let supabase use default WebSocket transport
      // Connection params for better auth context
      params: {
        // Add event filter optimization
        'log_level': process.env.NODE_ENV === 'development' ? 'debug' : 'info',
      },
    },
    // Global request timeout
    global: {
      headers: {
        'X-Client-Info': 'unveil-wedding-app',
        'X-Client-Version': '2.0.0',
      },
      // Add global timeout for regular requests
      fetch: (url, options = {}) => {
        return fetch(url, {
          ...options,
          signal: AbortSignal.timeout(15000), // 15 second timeout for API calls
        });
      },
    },
  },
);

// Export client with enhanced connection monitoring
export default supabase;
