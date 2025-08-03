import { NextRequest, NextResponse } from 'next/server';
import { sendBatchGuestInvitations } from '@/lib/sms-invitations';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const { eventId, guests, options = {} } = await request.json();

    // Validate required fields
    if (!eventId || !guests || !Array.isArray(guests)) {
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
      return NextResponse.json(
        { error: 'All guests must have a valid phone number' },
        { status: 400 },
      );
    }

    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 },
      );
    }

    // Verify the user is authenticated and is the host of this event
    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Invalid authentication' },
        { status: 401 },
      );
    }

    // Verify user is the host of this event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('host_user_id, title')
      .eq('id', eventId)
      .eq('host_user_id', user.id)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found or unauthorized' },
        { status: 404 },
      );
    }

    logger.info('Starting batch SMS invitations', {
      eventId,
      hostUserId: user.id,
      guestCount: guests.length
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

    logger.info('Batch SMS invitations completed', {
      eventId,
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
    logger.error('Error sending batch SMS invitations', error);
    return NextResponse.json(
      { 
        error: 'Failed to send SMS invitations',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 },
    );
  }
}