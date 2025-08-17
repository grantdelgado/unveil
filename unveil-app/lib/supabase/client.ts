import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/app/reference/supabase.types';
import { logger } from '@/lib/logger';

// Client-side only Supabase client - DO NOT use on server
// For server-side operations, use createServerSupabaseClient from './server'
export const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      // Auto refresh tokens
      autoRefreshToken: true,
      // Persist session across browser tabs
      persistSession: true,
      // Detect session in URL (for magic links, etc.)
      detectSessionInUrl: true,
      // PKCE flow for security
      flowType: 'pkce',
      // Reduce debug logging to minimize console spam
      debug: false, // Always false to reduce noise
    },
    // Enhanced realtime configuration to prevent timeouts
    realtime: {
      // Increase timeout to 30 seconds (default is 10)
      timeout: 30000,
      // Enable heartbeat every 30 seconds to keep connection alive
      heartbeatIntervalMs: 30000,
      // Reconnect automatically with exponential backoff
      reconnectAfterMs: (tries: number) => Math.min(1000 * Math.pow(2, tries), 30000),
      // Reduce realtime logging noise - only log errors
      logger: (kind: string, msg: string, data?: unknown) => {
        if (kind === 'error' || kind === 'close') {
          logger.error(`[Realtime ${kind}] ${msg}`, data);
        }
        // Suppress other realtime logs to reduce console spam
      },
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
    // Global request timeout with better error handling
    global: {
      headers: {
        'X-Client-Info': 'unveil-wedding-app',
        'X-Client-Version': '2.0.0',
      },
      // 🚀 PERFORMANCE: Optimized timeout handling for better UX
      fetch: (url, options = {}) => {
        // Create custom timeout signal that doesn't interfere with user aborts
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, 10000); // Reduced to 10 seconds for faster failure feedback
        
        // Combine user signal with timeout signal
        if (options.signal) {
          if (options.signal.aborted) {
            clearTimeout(timeoutId);
            controller.abort();
          } else {
            options.signal.addEventListener('abort', () => {
              clearTimeout(timeoutId);
              controller.abort();
            });
          }
        }
        
        return fetch(url, {
          ...options,
          signal: controller.signal,
        }).finally(() => {
          clearTimeout(timeoutId);
        });
      },
    },
  },
);

// Export client with enhanced connection monitoring
export default supabase;
