import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createInvitationMessage } from '@/lib/sms-invitations';
import { sendSMS } from '@/lib/sms';
import { formatEventDate } from '@/lib/utils/date';
import { logger } from '@/lib/logger';

interface InviteSingleGuestRequest {
  eventId: string;
  guestId: string;
}

/**
 * API endpoint for one-tap guest invitation
 * Sends SMS immediately and updates invitation tracking
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body: InviteSingleGuestRequest = await request.json();
    const { eventId, guestId } = body;

    // Validation
    if (!eventId || !guestId) {
      return NextResponse.json(
        { error: 'Event ID and guest ID are required' },
        { status: 400 }
      );
    }

    // Verify user is host of the event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('host_user_id, title, event_date, host:users!events_host_user_id_fkey(full_name)')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    if (event.host_user_id !== user.id) {
      return NextResponse.json(
        { error: 'Only event hosts can send invitations' },
        { status: 403 }
      );
    }

    // Fetch guest details and validate eligibility
    const { data: guest, error: guestError } = await supabase
      .from('event_guests')
      .select('id, guest_name, phone, role, declined_at, sms_opt_out, invited_at, users(full_name)')
      .eq('id', guestId)
      .eq('event_id', eventId)
      .is('removed_at', null) // Only active guests
      .single();

    if (guestError || !guest) {
      return NextResponse.json(
        { error: 'Guest not found or has been removed' },
        { status: 404 }
      );
    }

    // Validate guest eligibility
    if (guest.role === 'host') {
      return NextResponse.json(
        { error: 'Cannot invite event hosts' },
        { status: 400 }
      );
    }

    if (guest.declined_at) {
      return NextResponse.json(
        { error: 'Cannot invite guests who have declined' },
        { status: 400 }
      );
    }

    if (guest.sms_opt_out) {
      return NextResponse.json(
        { error: 'Cannot invite guests who have opted out of SMS' },
        { status: 400 }
      );
    }

    if (!guest.phone) {
      return NextResponse.json(
        { error: 'Cannot invite guests without phone numbers' },
        { status: 400 }
      );
    }

    // Check if already invited (allow re-invites but track attempts)
    const isFirstInvite = !guest.invited_at;

    // Create invitation message
    const guestName = guest.users?.full_name || guest.guest_name;
    const hostName = (event.host as { full_name?: string } | null)?.full_name || 'Your host';
    const formattedDate = formatEventDate(event.event_date);

    const invitation = {
      eventId,
      eventTitle: event.title,
      eventDate: formattedDate,
      guestPhone: guest.phone,
      guestName: guestName || undefined,
      hostName
    };

    const messageContent = createInvitationMessage(invitation);

    // Send SMS using existing infrastructure
    const smsResult = await sendSMS({
      to: guest.phone,
      message: messageContent,
      eventId,
      guestId,
      messageType: 'welcome'
    });

    if (!smsResult.success) {
      logger.apiError('Failed to send SMS invitation', {
        error: smsResult.error,
        eventId,
        guestId,
        phone: guest.phone.slice(0, 6) + '...' // Redacted for privacy
      });
      
      return NextResponse.json(
        { error: smsResult.error || 'Failed to send SMS invitation' },
        { status: 500 }
      );
    }

    // Update invitation tracking
    const { error: trackingError } = await supabase
      .rpc('update_guest_invitation_tracking', {
        p_event_id: eventId,
        p_guest_ids: [guestId]
      });

    if (trackingError) {
      logger.apiError('Failed to update invitation tracking', {
        error: trackingError.message,
        eventId,
        guestId
      });
      // Don't fail the request if tracking fails - SMS was sent successfully
    }

    logger.api('Single guest invitation sent successfully', {
      eventId,
      guestId,
      guestName: guestName || 'Unnamed Guest',
      isFirstInvite,
      smsStatus: smsResult.status,
      trackingUpdated: !trackingError
    });

    return NextResponse.json({
      success: true,
      data: {
        guestId,
        guestName: guestName || 'Unnamed Guest',
        smsStatus: smsResult.status,
        messageId: smsResult.messageId,
        isFirstInvite,
        invitedAt: new Date().toISOString()
      }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to send invitation';
    logger.apiError('Error in single guest invitation', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}
