import { normalizePhoneNumber } from './utils';

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
