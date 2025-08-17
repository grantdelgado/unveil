import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase/server';
import { sendBatchGuestInvitations } from '@/lib/sms-invitations';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    logger.info('SMS API: Request received');
    
    const { eventId, guests, options = {} } = await request.json();

    logger.info('SMS API: Request parsed', {
      eventId,
      guestCount: guests?.length || 0,
      hasOptions: !!options
    });

    // Validate required fields
    if (!eventId || !guests || !Array.isArray(guests)) {
      logger.error('SMS API: Missing required fields', { 
        eventId: !!eventId, 
        guests: !!guests, 
        isArray: Array.isArray(guests) 
      });
      return NextResponse.json(
        { error: 'Event ID and guests array are required' },
        { status: 400 },
      );
    }

    // Validate guests array structure
    const invalidGuests = guests.filter(guest => 
      !guest.phone || typeof guest.phone !== 'string'
    );

    if (invalidGuests.length > 0) {
      logger.error('SMS API: Invalid guests found', { count: invalidGuests.length });
      return NextResponse.json(
        { error: 'All guests must have a valid phone number' },
        { status: 400 },
      );
    }

    // Get authenticated user with robust auth handling
    const supabaseAuth = createApiSupabaseClient(request);
    
    // Try session from cookies first
    const { data: { session }, error: sessionError } = await supabaseAuth.auth.getSession();
    let currentUser = session?.user;

    if (sessionError || !currentUser) {
      // Fallback to Authorization header
      const authHeader = request.headers.get('authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json(
          { error: 'Authorization required - no session or token found' },
          { status: 401 },
        );
      }

      const token = authHeader.substring(7);
      const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

      if (userError || !user) {
        return NextResponse.json(
          { error: 'Invalid authentication token' },
          { status: 401 },
        );
      }
      
      currentUser = user;
    }

    // Add debug logging for user context
    logger.info('SMS API: Checking event access', { 
      eventId, 
      currentUserId: currentUser.id,
      currentUserPhone: currentUser.phone 
    });

    // First check if event exists (use admin client to bypass RLS for existence check)
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('host_user_id, title')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      logger.error('SMS API: Event lookup failed', { 
        eventId, 
        currentUserId: currentUser.id,
        error: eventError?.message,
        errorCode: eventError?.code,
        errorDetails: eventError?.details,
        hint: eventError?.hint
      });
      
      // Event truly does not exist
      logger.error('SMS API: Event does not exist in database', {
        eventId,
        currentUserId: currentUser.id,
        error: eventError?.message
      });
      
      return NextResponse.json(
        { error: 'Event not found or access denied' },
        { status: 404 },
      );
    }

    logger.info('SMS API: Event access successful', {
      eventId,
      eventTitle: event.title,
      eventHostId: event.host_user_id,
      currentUserId: currentUser.id,
      isUserTheHost: event.host_user_id === currentUser.id
    });

    // Check if current user is authorized as host
    const isPrimaryHost = event.host_user_id === currentUser.id;
    let isDelegatedHost = false;
    
    if (!isPrimaryHost) {
      // Check if user is a delegated host using the RPC function
      const { data: hostCheck, error: hostError } = await supabaseAuth
        .rpc('is_event_host', { p_event_id: eventId });

      if (hostError) {
        logger.error('Delegated host authorization check failed', { 
          eventId, 
          userId: currentUser.id, 
          error: hostError 
        });
        return NextResponse.json(
          { error: 'Authorization check failed' },
          { status: 500 },
        );
      }
      
      isDelegatedHost = !!hostCheck;
    }

    const isAuthorizedHost = isPrimaryHost || isDelegatedHost;
    
    if (!isAuthorizedHost) {
      logger.warn('User not authorized as host', { 
        eventId, 
        userId: currentUser.id,
        eventTitle: event.title,
        eventHostUserId: event.host_user_id,
        isPrimaryHost,
        isDelegatedHost
      });
      return NextResponse.json(
        { error: 'User is not authorized as host for this event' },
        { status: 403 },
      );
    }

    logger.info('SMS API: User authorized as host', {
      eventId,
      userId: currentUser.id,
      isPrimaryHost,
      isDelegatedHost,
      authorizationType: isPrimaryHost ? 'primary' : 'delegated'
    });

    logger.info('SMS API: Calling sendBatchGuestInvitations', {
      eventId,
      guestCount: guests.length,
      maxConcurrency: options.maxConcurrency || 3
    });

    // Send the batch invitations
    const result = await sendBatchGuestInvitations(
      guests,
      eventId,
      {
        maxConcurrency: options.maxConcurrency || 3,
        skipRateLimit: options.skipRateLimit || false
      }
    );

    logger.info('SMS API: Batch SMS completed', {
      sent: result.sent,
      failed: result.failed,
      rateLimited: result.rateLimited
    });

    return NextResponse.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
      rateLimited: result.rateLimited,
      message: `Successfully sent ${result.sent} invitations${
        result.failed > 0 ? ` (${result.failed} failed)` : ''
      }${
        result.rateLimited > 0 ? ` (${result.rateLimited} rate limited)` : ''
      }`,
      results: result.results
    });

  } catch (error) {
    logger.error('SMS API: Unexpected error', error);
    return NextResponse.json(
      { 
        error: 'Failed to send SMS invitations',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 },
    );
  }
}