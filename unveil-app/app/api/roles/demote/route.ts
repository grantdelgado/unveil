/**
 * API route for demoting hosts to guest role
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import type { Database } from '@/app/reference/supabase.types';

// Type guard to ensure we use user_id, not guest row id
interface DemoteRequest {
  eventId: string;
  userId: string; // Must be user_id from event_guests.user_id, not event_guests.id
}

export async function POST(request: NextRequest) {
  try {
    // Create standardized server Supabase client with proper cookie handling
    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(
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
              console.warn('Failed to set cookie:', name, error);
            }
          },
          remove(name: string, options: Record<string, unknown>) {
            try {
              cookieStore.set({ name, value: '', ...options });
            } catch (error) {
              console.warn('Failed to remove cookie:', name, error);
            }
          },
        },
      },
    );

    // Get authenticated user with comprehensive error handling
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      logger.warn('server.roles.demote_auth_failed', { 
        authError: authError?.message,
        hasUser: !!user,
        authCode: authError?.code,
      });
      return NextResponse.json(
        { error: 'unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body: DemoteRequest = await request.json();
    const { eventId, userId } = body;

    // Comprehensive input validation
    if (!eventId || typeof eventId !== 'string') {
      return NextResponse.json(
        { error: 'Valid eventId is required' },
        { status: 400 }
      );
    }

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'Valid userId is required' },
        { status: 400 }
      );
    }

    // Validate UUID format (basic check)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(eventId) || !uuidRegex.test(userId)) {
      return NextResponse.json(
        { error: 'Invalid UUID format' },
        { status: 400 }
      );
    }

    // Log the demotion attempt (PII-safe)
    logger.info('api.roles.demote', {
      eventId,
      targetUserId: userId,
      auth: !!user,
      actorUserId: user.id,
    });

    // Server-side host permission check before RPC
    const { data: isHost, error: hostErr } = await supabase.rpc('is_event_host', { 
      p_event_id: eventId 
    });
    
    if (hostErr) {
      logger.error('server.roles.demote_host_check_error', {
        eventId,
        actorUserId: user.id,
        error: hostErr.message,
        code: hostErr.code,
      });
      return NextResponse.json(
        { error: 'host_check_failed' },
        { status: 500 }
      );
    }
    
    if (!isHost) {
      logger.warn('server.roles.demote_forbidden', {
        eventId,
        actorUserId: user.id,
        isHost: false,
      });
      return NextResponse.json(
        { error: 'forbidden' },
        { status: 403 }
      );
    }

    // Call RPC with explicit args and comprehensive error mapping
    const { error: rpcErr } = await supabase.rpc('demote_host_to_guest', { 
      p_event_id: eventId, 
      p_user_id: userId 
    });
    
    if (rpcErr) {
      const code = rpcErr.code;
      logger.error('server.roles.demote_rpc_failed', {
        eventId,
        targetUserId: userId,
        actorUserId: user.id,
        code,
        message: rpcErr.message,
        details: rpcErr.details,
        hint: rpcErr.hint,
      });

      // Map SQLSTATEs to HTTP status codes with specific handling for last-host protection
      let status = 400;
      if (code === '42501') {
        status = 403;
      } else if (code === 'P0001') {
        if (rpcErr.message.includes('cannot_remove_last_host')) {
          status = 409; // Conflict - cannot remove last host
        } else {
          status = 409; // Other P0001 conflicts
        }
      }

      return NextResponse.json({ 
        error: 'rpc_failed', 
        code,
        message: rpcErr.message 
      }, { status });
    }

    // Success
    logger.info('server.roles.demote_success', {
      eventId,
      targetUserId: userId,
      actorUserId: user.id,
    });

    return NextResponse.json({ ok: true });

  } catch (error) {
    logger.error('Unexpected error in demote route', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
