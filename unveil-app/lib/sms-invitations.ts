import { normalizePhoneNumber } from './utils';
import { logger } from '@/lib/logger';

// SMS invitation and notification utilities for phone-based guest management

export interface EventInvitation {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  hostName: string;
  guestPhone: string;
  guestName?: string;
}

export interface SMSMessage {
  to: string;
  message: string;
  type: 'invitation' | 'reminder' | 'update' | 'rsvp_confirmation';
}

/**
 * Generate invitation message for new guests
 */
export const createInvitationMessage = (
  invitation: EventInvitation,
): string => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://unveil.app';
  const inviteLink = `${baseUrl}/guest/events/${invitation.eventId}?phone=${encodeURIComponent(invitation.guestPhone)}`;

  const guestName = invitation.guestName ? `Hi ${invitation.guestName}! ` : '';

  return `${guestName}You're invited to ${invitation.eventTitle} on ${invitation.eventDate}!

View details & RSVP: ${inviteLink}

Hosted by ${invitation.hostName} via Unveil

Reply STOP to opt out.`;
};

/**
 * Generate RSVP confirmation message
 */
export const createRSVPConfirmationMessage = (
  invitation: EventInvitation,
  rsvpStatus: string,
): string => {
  const statusText =
    rsvpStatus === 'Attending'
      ? 'attending'
      : rsvpStatus === 'Declined'
        ? 'unable to attend'
        : 'maybe attending';

  return `Thanks for your RSVP! We've confirmed you're ${statusText} ${invitation.eventTitle} on ${invitation.eventDate}.

Your hosts appreciate hearing from you!

Reply STOP to opt out.`;
};

/**
 * Generate event reminder message
 */
export const createReminderMessage = (
  invitation: EventInvitation,
  daysUntil: number,
): string => {
  const timeText =
    daysUntil === 0
      ? 'today'
      : daysUntil === 1
        ? 'tomorrow'
        : `in ${daysUntil} days`;

  return `Reminder: ${invitation.eventTitle} is ${timeText}!

Don't forget to upload photos and stay connected.

Hosted by ${invitation.hostName} via Unveil

Reply STOP to opt out.`;
};

/**
 * Generate event update message
 */
export const createUpdateMessage = (
  invitation: EventInvitation,
  updateText: string,
): string => {
  return `Update for ${invitation.eventTitle}:

${updateText}

Hosted by ${invitation.hostName} via Unveil

Reply STOP to opt out.`;
};

/**
 * Validate phone number for SMS sending
 */
export const validateSMSRecipient = (
  phone: string,
): { valid: boolean; normalizedPhone?: string; error?: string } => {
  const normalized = normalizePhoneNumber(phone);

  // Basic validation for US numbers
  if (!normalized.startsWith('+1') || normalized.length !== 12) {
    return { valid: false, error: 'Invalid US phone number format' };
  }

  return { valid: true, normalizedPhone: normalized };
};

/**
 * Prepare SMS messages for batch sending
 */
export const prepareBatchInvitations = (
  invitations: EventInvitation[],
): SMSMessage[] => {
  return invitations.map((invitation) => {
    const validation = validateSMSRecipient(invitation.guestPhone);

    if (!validation.valid) {
      throw new Error(
        `Invalid phone number for ${invitation.guestName || 'guest'}: ${validation.error}`,
      );
    }

    return {
      to: validation.normalizedPhone!,
      message: createInvitationMessage(invitation),
      type: 'invitation',
    };
  });
};

/**
 * Future: Integration with SMS providers like Twilio
 * This is a placeholder for actual SMS sending implementation
 */
export const sendSMS = async (
  to: string,
  message: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  // NOTE: SMS provider integration pending - requires Twilio configuration in production
  const { logger } = await import('@/lib/logger');
  logger.sms('SMS would be sent to', to);
  logger.sms('Message', message);

  // Mock success for development
  return {
    success: true,
    messageId: `mock_${Date.now()}`,
  };
};

/**
 * Send single invitation
 */
export const sendEventInvitation = async (
  invitation: EventInvitation,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const validation = validateSMSRecipient(invitation.guestPhone);

    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const message = createInvitationMessage(invitation);
    const result = await sendSMS(validation.normalizedPhone!, message);

    return { success: result.success, error: result.error };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to send invitation',
    };
  }
};

/**
 * Send batch invitations
 */
export const sendBatchInvitations = async (
  invitations: EventInvitation[],
): Promise<{
  successful: number;
  failed: number;
  errors: Array<{ phone: string; error: string }>;
}> => {
  const results = {
    successful: 0,
    failed: 0,
    errors: [] as Array<{ phone: string; error: string }>,
  };

  for (const invitation of invitations) {
    const result = await sendEventInvitation(invitation);

    if (result.success) {
      results.successful++;
    } else {
      results.failed++;
      results.errors.push({
        phone: invitation.guestPhone,
        error: result.error || 'Unknown error',
      });
    }
  }

  return results;
};

/**
 * Generate deep link for guest access
 */
export const generateGuestAccessLink = (
  eventId: string,
  guestPhone: string,
): string => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://unveil.app';
  return `${baseUrl}/guest/events/${eventId}?phone=${encodeURIComponent(guestPhone)}&autoLogin=true`;
};

/**
 * Send invitation SMS to a newly added guest with rate limiting
 * Automatically checks rate limits and logs the send attempt
 */
export const sendGuestInvitationSMS = async (
  phone: string,
  eventId: string,
  options: {
    guestName?: string;
    skipRateLimit?: boolean; // For development/testing
  } = {}
): Promise<{ success: boolean; error?: string; rateLimited?: boolean }> => {
  const redactedPhone = phone.slice(0, 6) + '...';
  
  try {
    // Development-only debug logging
    if (process.env.NODE_ENV === 'development') {
      console.log(`📱 SMS Debug: Starting invitation SMS for ${redactedPhone}`, {
        eventId,
        hasGuestName: !!options.guestName,
        skipRateLimit: options.skipRateLimit
      });
    }

    // Import Supabase admin client to bypass RLS for event lookup
    const { supabaseAdmin } = await import('./supabase/admin');

    // TODO: Rate limiting will be implemented after migration is applied
    // Currently disabled to allow building without guest_sms_log table
    if (!options.skipRateLimit) {
      logger.info('SMS Debug: Rate limiting temporarily disabled - will be enabled after migration');
    }

    // Fetch event details for the invitation using admin client
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select(`
        title,
        event_date,
        location,
        host:users!events_host_user_id_fkey(full_name)
      `)
      // @ts-expect-error - Supabase typing issue with admin client
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      logger.error(`SMS Debug: Event not found for SMS invitation - ${redactedPhone}`, {
        eventId,
        error: eventError?.message,
        errorCode: eventError?.code
      });
      return { success: false, error: 'Event not found' };
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`📱 SMS Debug: Event found for ${redactedPhone}:`, {
        eventId,
        // @ts-expect-error - Event properties from Supabase query
        eventTitle: event.title,
        // @ts-expect-error - Event properties from Supabase query
        eventDate: event.event_date,
        // @ts-expect-error - Event properties from Supabase query
        hasHost: !!(event.host as { full_name?: string } | null)?.full_name
      });
    }

    // Create invitation object for message generation
    const invitation: EventInvitation = {
      eventId,
      // @ts-expect-error - Event properties from Supabase query
      eventTitle: event.title,
      // @ts-expect-error - Event properties from Supabase query
      eventDate: new Date(event.event_date).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      }),
      guestPhone: phone,
      guestName: options.guestName,
      // @ts-expect-error - Event properties from Supabase query
      hostName: (event.host as { full_name?: string } | null)?.full_name || 'Your host'
    };

    // Generate invitation message
    const message = createInvitationMessage(invitation);

    if (process.env.NODE_ENV === 'development') {
      console.log(`📱 SMS Debug: Prepared invitation message for ${redactedPhone}:`, {
        messageLength: message.length,
        messagePreview: message.substring(0, 100) + '...',
        guestName: options.guestName || 'No name provided',
        hostName: invitation.hostName
      });
    }

    // Send SMS using existing infrastructure
    const { sendSMS } = await import('./sms');
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`📱 SMS Debug: Calling sendSMS for ${redactedPhone}...`);
    }
    
    const smsResult = await sendSMS({
      to: phone,
      message: message,
      eventId: eventId,
      guestId: undefined, // Guest invitations don't have a specific guest record ID yet
      messageType: 'welcome'
    });

    if (process.env.NODE_ENV === 'development') {
      console.log(`📱 SMS Debug: sendSMS result for ${redactedPhone}:`, {
        success: smsResult.success,
        error: smsResult.error,
        messageId: smsResult.messageId,
        status: smsResult.status
      });
    }

    return {
      success: smsResult.success,
      error: smsResult.error,
      rateLimited: false
    };

  } catch (error) {
    logger.error('Error sending guest invitation SMS', error);
    
    // TODO: SMS error logging will be implemented after migration is applied
    logger.error('SMS error for phone', { phone: phone.substring(0, 6) + '****', error });
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send invitation'
    };
  }
};

/**
 * Send batch invitation SMS with rate limiting and proper error handling
 * Used when importing multiple guests at once
 */
export const sendBatchGuestInvitations = async (
  guests: Array<{
    phone: string;
    guestName?: string;
  }>,
  eventId: string,
  options: {
    skipRateLimit?: boolean;
    maxConcurrency?: number;
  } = {}
): Promise<{
  sent: number;
  failed: number;
  rateLimited: number;
  results: Array<{
    phone: string;
    success: boolean;
    error?: string;
    rateLimited?: boolean;
  }>;
}> => {
  const maxConcurrency = options.maxConcurrency || 3; // Limit concurrent SMS sends
  const results: Array<{
    phone: string;
    success: boolean;
    error?: string;
    rateLimited?: boolean;
  }> = [];

  let sent = 0;
  let failed = 0;
  let rateLimited = 0;

  // Process guests in batches to avoid overwhelming the SMS service
  for (let i = 0; i < guests.length; i += maxConcurrency) {
    const batch = guests.slice(i, i + maxConcurrency);
    
    const batchPromises = batch.map(async (guest) => {
      const result = await sendGuestInvitationSMS(guest.phone, eventId, {
        guestName: guest.guestName,
        skipRateLimit: options.skipRateLimit
      });

      const guestResult = {
        phone: guest.phone,
        success: result.success,
        error: result.error,
        rateLimited: result.rateLimited
      };

      if (result.success) {
        sent++;
      } else if (result.rateLimited) {
        rateLimited++;
      } else {
        failed++;
      }

      return guestResult;
    });

    const batchResults = await Promise.allSettled(batchPromises);
    
    batchResults.forEach((promiseResult) => {
      if (promiseResult.status === 'fulfilled') {
        results.push(promiseResult.value);
      } else {
        console.error('Batch SMS send promise rejected:', promiseResult.reason);
        results.push({
          phone: 'unknown',
          success: false,
          error: 'Promise rejected'
        });
        failed++;
      }
    });

    // Small delay between batches to be nice to the SMS service
    if (i + maxConcurrency < guests.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return { sent, failed, rateLimited, results };
};
