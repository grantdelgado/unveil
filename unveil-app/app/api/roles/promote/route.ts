/**
 * API route for promoting guests to host role
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import type { Database } from '@/app/reference/supabase.types';

// Type guard to ensure we use user_id, not guest row id
interface PromoteRequest {
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
      logger.warn('server.roles.promote_auth_failed', { 
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
    const body: PromoteRequest = await request.json();
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

    // Log the promotion attempt (PII-safe)
    logger.info('api.roles.promote', {
      eventId,
      targetUserId: userId,
      auth: !!user,
      actorUserId: user.id,
    });

    // Preflight check: Ensure target user belongs to this event
    const { data: existingGuest, error: preflightError } = await supabase
      .from('event_guests')
      .select('user_id, role')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle();

    if (preflightError) {
      logger.error('server.roles.promote_preflight_error', {
        event_id: eventId,
        target_user_id: userId,
        actor_user_id: user.id,
        error: preflightError.message,
        code: preflightError.code,
      });
      return NextResponse.json(
        { error: 'Failed to verify guest status' },
        { status: 500 }
      );
    }

    if (!existingGuest) {
      logger.warn('server.roles.promote_no_guest_record', {
        event_id: eventId,
        target_user_id: userId,
        actor_user_id: user.id,
      });
      return NextResponse.json(
        { error: 'User is not a member of this event' },
        { status: 400 }
      );
    }

    if (existingGuest.role === 'host') {
      logger.info('server.roles.promote_already_host', {
        event_id: eventId,
        target_user_id: userId,
        actor_user_id: user.id,
      });
      return NextResponse.json(
        { error: 'User is already a host for this event' },
        { status: 400 }
      );
    }

    // Server-side host permission check before RPC
    const { data: isHost, error: hostErr } = await supabase.rpc('is_event_host', { 
      p_event_id: eventId 
    });
    
    if (hostErr) {
      logger.error('server.roles.promote_host_check_error', {
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
      logger.warn('server.roles.promote_forbidden', {
        eventId,
        actorUserId: user.id,
        isHost: false,
      });
      return NextResponse.json(
        { error: 'forbidden' },
        { status: 403 }
      );
    }

    // Add precise diagnostics (temporary)
    console.info('api.roles.promote.debug', { 
      eventId, 
      targetUserId: userId, 
      step: 'pre-rpc', 
      auth: !!user 
    });

    // Call RPC with explicit args and comprehensive error mapping
    const { error: rpcErr } = await supabase.rpc('promote_guest_to_host', { 
      p_event_id: eventId, 
      p_user_id: userId 
    });
    
    if (rpcErr) {
      const code = rpcErr.code;
      const message = rpcErr.message || '';
      
      // Add error diagnostics (temporary)
      console.error('api.roles.promote.error', { 
        code: rpcErr.code, 
        message: rpcErr.message, 
        hint: rpcErr.hint 
      });

      logger.error('server.roles.promote_rpc_failed', {
        eventId,
        targetUserId: userId,
        actorUserId: user.id,
        code,
        message,
        details: rpcErr.details,
        hint: rpcErr.hint,
      });

      // Handle phone-related errors specifically
      if (message.includes('Invalid phone number format') || message.includes('phone')) {
        logger.error('server.roles.promote_phone_error', {
          eventId,
          targetUserId: userId,
          code,
          message,
          origin: 'unexpected_in_promote',
        });
        return NextResponse.json({ 
          error: 'invalid_phone_unrelated',
          origin: 'not_expected_in_promote',
          code,
          message: 'Phone validation should not occur during role promotion'
        }, { status: 400 });
      }

      // Map SQLSTATEs to HTTP status codes
      let status = 400;
      let errorType = 'rpc_failed';
      
      if (code === '42501') {
        status = 403;
        errorType = 'unauthorized';
      } else if (code === '22000' && message.includes('user_not_guest_of_event')) {
        status = 400;
        errorType = 'user_not_guest';
      } else if (code === 'P0001') {
        // This should never happen in promote - log as unexpected
        logger.error('api.roles.promote_sqlstate', {
          code: 'P0001',
          location: 'promote_rpc',
          message,
          eventId,
          targetUserId: userId,
        });
        status = 400;
        errorType = 'unexpected_p0001_promote';
      }

      return NextResponse.json({ 
        error: errorType,
        code,
        message: rpcErr.message,
        detail: code === 'P0001' ? 'Unexpected P0001 in promote - this should not happen' : undefined
      }, { status });
    }

    // Success
    logger.info('server.roles.promote_success', {
      eventId,
      targetUserId: userId,
      actorUserId: user.id,
    });

    return NextResponse.json({ ok: true });

  } catch (error) {
    logger.error('Unexpected error in promote route', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
