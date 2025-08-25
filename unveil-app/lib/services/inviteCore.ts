/**
 * Shared core logic for guest invitations
 * Used by both single and bulk invite endpoints to ensure identical behavior
 */

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createInvitationMessage } from '@/lib/sms-invitations';
import { sendSMS } from '@/lib/sms';
import { formatEventDate } from '@/lib/utils/date';
import { logger } from '@/lib/logger';

export interface InviteGuestRequest {
  eventId: string;
  guestId: string;
}

export interface InviteGuestResult {
  success: boolean;
  guestId: string;
  guestName?: string;
  isFirstInvite?: boolean;
  smsStatus?: string;
  configMode?: string;
  simulationMode?: boolean;
  error?: string;
}

/**
 * Core invitation logic shared between single and bulk invite endpoints
 * Handles validation, message creation, SMS sending, and tracking updates
 */
export async function sendGuestInviteCore({
  eventId,
  guestId,
}: InviteGuestRequest): Promise<InviteGuestResult> {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Fetch event and guest data with host information
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select(`
        id,
        title,
        event_date,
        host:users!events_host_user_id_fkey(full_name)
      `)
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      logger.apiError('Event not found for invitation', {
        eventId,
        guestId,
        error: eventError?.message,
      });
      return {
        success: false,
        guestId,
        error: 'Event not found',
      };
    }

    // Fetch guest data
    const { data: guest, error: guestError } = await supabase
      .from('event_guests')
      .select(`
        id,
        phone,
        guest_name,
        role,
        invited_at,
        declined_at,
        removed_at,
        sms_opt_out,
        users(full_name)
      `)
      .eq('id', guestId)
      .eq('event_id', eventId)
      .single();

    if (guestError || !guest) {
      logger.apiError('Guest not found for invitation', {
        eventId,
        guestId,
        error: guestError?.message,
      });
      return {
        success: false,
        guestId,
        error: 'Guest not found',
      };
    }

    // Validate guest eligibility (same as single invite validation)
    if (guest.role === 'host') {
      return {
        success: false,
        guestId,
        error: 'Cannot invite hosts',
      };
    }

    if (guest.removed_at) {
      return {
        success: false,
        guestId,
        error: 'Guest has been removed',
      };
    }

    if (guest.declined_at) {
      return {
        success: false,
        guestId,
        error: 'Guest has declined',
      };
    }

    if (guest.sms_opt_out) {
      return {
        success: false,
        guestId,
        error: 'Guest has opted out of SMS',
      };
    }

    if (!guest.phone) {
      return {
        success: false,
        guestId,
        error: 'Guest has no phone number',
      };
    }

    // Validate phone format
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(guest.phone)) {
      return {
        success: false,
        guestId,
        error: 'Invalid phone number format',
      };
    }

    // Check if already invited (allow re-invites but track attempts)
    const isFirstInvite = !guest.invited_at;

    // Create invitation message
    const guestName = guest.users?.full_name || guest.guest_name;
    const hostName =
      (event.host as { full_name?: string } | null)?.full_name || 'Your host';
    const formattedDate = formatEventDate(event.event_date);

    const invitation = {
      eventId,
      eventTitle: event.title,
      eventDate: formattedDate,
      guestPhone: guest.phone,
      guestName: guestName || undefined,
      hostName,
    };

    const messageContent = createInvitationMessage(invitation, { 
      isFirstContact: isFirstInvite 
    });

    // Send SMS using existing infrastructure
    const smsResult = await sendSMS({
      to: guest.phone,
      message: messageContent,
      eventId,
      guestId,
      messageType: 'welcome',
    });

    if (!smsResult.success) {
      logger.apiError('Failed to send SMS invitation', {
        error: smsResult.error,
        eventId,
        guestId,
        phone: guest.phone.slice(0, 6) + '...', // Redacted for privacy
      });

      return {
        success: false,
        guestId,
        guestName: guestName || undefined,
        error: smsResult.error || 'Failed to send SMS invitation',
      };
    }

    // Update invitation tracking using strict function (only for actual invitations)
    const { error: trackingError } = await supabase.rpc(
      'update_guest_invitation_tracking_strict',
      {
        p_event_id: eventId,
        p_guest_ids: [guestId],
      },
    );

    if (trackingError) {
      logger.apiError('Failed to update invitation tracking', {
        error: trackingError.message,
        eventId,
        guestId,
      });
      // Don't fail the request if tracking fails - SMS was sent successfully
    }

    logger.api('Guest invitation sent successfully', {
      eventId,
      guestId,
      guestName: guestName || 'Unknown',
      isFirstInvite,
      smsStatus: smsResult.status,
      configMode: process.env.NODE_ENV,
      simulationMode: process.env.DEV_SIMULATE_INVITES === 'true',
    });

    return {
      success: true,
      guestId,
      guestName: guestName || undefined,
      isFirstInvite,
      smsStatus: smsResult.status,
      configMode: process.env.NODE_ENV,
      simulationMode: process.env.DEV_SIMULATE_INVITES === 'true',
    };

  } catch (error: unknown) {
    logger.apiError('Unexpected error in sendGuestInviteCore', {
      error: error instanceof Error ? error.message : String(error),
      eventId,
      guestId,
    });

    return {
      success: false,
      guestId,
      error: error instanceof Error ? error.message : 'Unexpected error occurred',
    };
  }
}
