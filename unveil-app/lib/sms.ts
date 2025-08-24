import { getErrorMessage } from './utils';
import { SMSRetry } from '@/lib/utils/retry';
import { logger } from '@/lib/logger';
import { composeSmsText, markA2pNoticeSent } from '@/lib/sms-formatter';

// Twilio configuration - will be dynamically imported to avoid server-side issues
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const twilioMessagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

// Validate Twilio configuration on module load
function validateTwilioConfig() {
  const missingVars = [];

  if (!accountSid) missingVars.push('TWILIO_ACCOUNT_SID');
  if (!authToken) missingVars.push('TWILIO_AUTH_TOKEN');
  if (!twilioPhoneNumber && !twilioMessagingServiceSid) {
    missingVars.push('TWILIO_PHONE_NUMBER or TWILIO_MESSAGING_SERVICE_SID');
  }

  if (missingVars.length > 0) {
    logger.warn('Twilio Configuration Warning', {
      missing: missingVars,
      note: 'SMS invitations will not work until these are configured',
    });
  } else {
    logger.info('Twilio Configuration: All required variables present');
  }
}

// Run validation (only in server environment)
if (typeof window === 'undefined') {
  validateTwilioConfig();
}

// Initialize Twilio client lazily
let twilioClient: ReturnType<typeof import('twilio')> | null = null;

const getTwilioClient = async () => {
  if (!twilioClient && accountSid && authToken) {
    logger.info('Initializing Twilio client...');
    const twilio = (await import('twilio')).default;
    twilioClient = twilio(accountSid, authToken);
    logger.info('Twilio client initialized successfully');
  }
  return twilioClient;
};

export interface SMSMessage {
  to: string;
  message: string;
  eventId: string;
  guestId?: string;
  messageType?: 'rsvp_reminder' | 'announcement' | 'welcome' | 'custom';
  /** Pre-fetched event SMS tag (for scheduled messages) */
  eventSmsTag?: string | null;
  /** Pre-fetched event title (for scheduled messages) */
  eventTitle?: string | null;
}

export interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
  status?: string;
  shouldRetry?: boolean;
}

export interface ScheduledSMSDelivery {
  guestId: string;
  guestName?: string;
  phoneNumber: string;
  messageContent: string;
  messageId: string;
  eventId: string;
}

/**
 * Enhanced SMS sending for scheduled messages with retry logic
 */
export async function sendScheduledSMS(
  delivery: ScheduledSMSDelivery,
): Promise<SMSResult> {
  const maxRetries = 3;
  const retryDelays = [1000, 2000, 5000]; // 1s, 2s, 5s

  let lastError: string = '';

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await sendSMS({
        to: delivery.phoneNumber,
        message: delivery.messageContent,
        eventId: delivery.eventId,
        guestId: delivery.guestId,
        messageType: 'custom',
      });

      // If successful, return immediately
      if (result.success) {
        if (attempt > 0) {
          logger.sms(
            `SMS sent successfully on retry ${attempt + 1} for guest ${delivery.guestId.slice(-4)}`,
          );
        }
        return result;
      }

      // If this was the last attempt, return the failure
      if (attempt === maxRetries - 1) {
        return {
          ...result,
          shouldRetry: false,
        };
      }

      // Check if error is retryable (5xx errors, rate limits, temporary failures)
      const shouldRetry = SMSRetry.isRetryable(result.error);
      if (!shouldRetry) {
        logger.smsError(
          `Non-retryable error for guest ${delivery.guestId.slice(-4)}`,
          result.error,
        );
        return {
          ...result,
          shouldRetry: false,
        };
      }

      lastError = result.error || 'Unknown error';
      logger.sms(
        `Retryable error for guest ${delivery.guestId.slice(-4)}, attempt ${attempt + 1}/${maxRetries}: ${lastError}`,
      );

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt]));
    } catch (error) {
      lastError = getErrorMessage(error);
      logger.smsError(
        `Exception during SMS send attempt ${attempt + 1} for guest ${delivery.guestId.slice(-4)}`,
        lastError,
      );

      // If this was the last attempt, return failure
      if (attempt === maxRetries - 1) {
        return {
          success: false,
          error: lastError,
          shouldRetry: false,
        };
      }

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt]));
    }
  }

  return {
    success: false,
    error: lastError,
    shouldRetry: false,
  };
}

/**
 * Send an SMS message using Twilio
 */
export async function sendSMS({
  to,
  message,
  eventId,
  guestId,
  messageType = 'custom',
  eventSmsTag,
  eventTitle,
}: SMSMessage): Promise<SMSResult> {
  try {
    logger.info('Starting SMS send process', {
      phone: to.slice(0, 6) + '...',
      eventId,
      messageType,
      hasGuestId: !!guestId,
      simulationMode: process.env.DEV_SIMULATE_INVITES === 'true',
    });

    // Development simulation mode
    if (
      process.env.NODE_ENV === 'development' &&
      process.env.DEV_SIMULATE_INVITES === 'true'
    ) {
      // Format SMS even in simulation mode for testing
      const formattedSms = await composeSmsText(eventId, guestId, message);
      
      logger.info('🔧 SMS SIMULATION MODE - No actual SMS sent', {
        phone: to.slice(0, 6) + '...',
        messagePreview: formattedSms.text.substring(0, 100) + '...',
        originalLength: message.length,
        finalLength: formattedSms.length,
        segments: formattedSms.segments,
        includedStopNotice: formattedSms.includedStopNotice,
        eventId,
        guestId,
        messageType,
      });

      // Mark A2P notice as sent if it was included (even in simulation)
      if (formattedSms.includedStopNotice && guestId) {
        await markA2pNoticeSent(eventId, guestId);
      }

      // Log to database for tracking (use original message for consistency)
      await logSMSToDatabase({
        eventId,
        guestId,
        phoneNumber: to,
        content: message,
        messageType,
        twilioSid: `sim_${Date.now()}`,
        status: 'sent',
      });

      return {
        success: true,
        messageId: `sim_${Date.now()}`,
        status: 'sent',
      };
    }

    // Get Twilio client
    const client = await getTwilioClient();

    logger.info('Twilio client status', {
      hasClient: !!client,
      hasPhoneNumber: !!twilioPhoneNumber,
      hasMessagingService: !!twilioMessagingServiceSid,
      accountSid: accountSid ? accountSid.slice(0, 8) + '...' : 'missing',
    });

    if (!client || (!twilioPhoneNumber && !twilioMessagingServiceSid)) {
      throw new Error(
        'Twilio not configured. Please check your environment variables.',
      );
    }

    // Validate phone number format
    const formattedPhone = formatPhoneNumber(to);
    if (!formattedPhone) {
      throw new Error('Invalid phone number format');
    }

    logger.info('Phone formatting completed', {
      original: to.slice(0, 6) + '...',
      formatted: formattedPhone.slice(0, 6) + '...',
    });



    // Format SMS with event tag branding and A2P footer
    const formattedSms = await composeSmsText(eventId, guestId, message, {
      eventSmsTag,
      eventTitle,
    });
    
    // Development-only assertions for branding compliance
    if (process.env.NODE_ENV !== 'production') {
      const { flags } = await import('@/config/flags');
      
      // Assert header inclusion when kill switch is off
      if (!flags.ops.smsBrandingDisabled && !formattedSms.included.header) {
        logger.error('ASSERTION FAILED: Header missing while kill switch is off', {
          eventId,
          guestId,
          reason: formattedSms.reason,
          killSwitchDisabled: flags.ops.smsBrandingDisabled,
        });
      }
      
      // Assert STOP notice for first SMS (when expected)
      if (guestId && formattedSms.reason !== 'fallback' && formattedSms.reason !== 'kill_switch') {
        // This is a simplified check - actual first-SMS logic is in composeSmsText
        // We're just asserting that if it's not a fallback/kill-switch, STOP should be considered
        if (!formattedSms.included.stop && !formattedSms.reason?.includes('first_sms=false')) {
          logger.warn('First SMS assertion: STOP notice not included', {
            eventId,
            guestId,
            reason: formattedSms.reason,
            includedStop: formattedSms.included.stop,
          });
        }
      }
    }
    
    // Log SMS formatting metrics (no PII)
    logger.info('SMS formatting completed', {
      eventId,
      originalLength: message.length,
      finalLength: formattedSms.length,
      segments: formattedSms.segments,
      includedStopNotice: formattedSms.includedStopNotice,
      droppedLink: formattedSms.droppedLink,
      truncatedBody: formattedSms.truncatedBody,
      included: formattedSms.included,
      reason: formattedSms.reason,
    });

    // Redact phone number for logging (show first 3 and last 4 characters)
    const redactedPhone =
      formattedPhone.length > 7
        ? `${formattedPhone.slice(0, 3)}...${formattedPhone.slice(-4)}`
        : '***redacted***';

    logger.sms(`Sending SMS to ${redactedPhone}`, {
      messagePreview: formattedSms.text.substring(0, 50) + '...',
      finalLength: formattedSms.length,
      segments: formattedSms.segments,
    });

    // Create message params - use messaging service if available, otherwise phone number
    const messageParams: {
      body: string;
      to: string;
      messagingServiceSid?: string;
      from?: string;
    } = {
      body: formattedSms.text,
      to: formattedPhone,
    };

    if (twilioMessagingServiceSid) {
      messageParams.messagingServiceSid = twilioMessagingServiceSid;
      logger.sms(
        `Using Messaging Service: ${twilioMessagingServiceSid.slice(0, 8)}...`,
      );
    } else if (twilioPhoneNumber) {
      messageParams.from = twilioPhoneNumber;
      logger.sms(`Using Phone Number: ${twilioPhoneNumber.slice(0, 8)}...`);
    } else {
      throw new Error('No Twilio sender configured');
    }

    logger.info('Calling Twilio API...');

    // Send SMS via Twilio
    const twilioMessage = await client.messages.create(messageParams);

    logger.info('Twilio API success', {
      sid: twilioMessage.sid,
      status: twilioMessage.status,
      phone: redactedPhone,
    });

    logger.sms(`SMS sent successfully. SID: ${twilioMessage.sid}`);

    // Mark A2P notice as sent if it was included in this SMS
    if (formattedSms.includedStopNotice && guestId) {
      await markA2pNoticeSent(eventId, guestId);
    }

    // Log to database for tracking (use original message for consistency)
    await logSMSToDatabase({
      eventId,
      guestId,
      phoneNumber: formattedPhone,
      content: message,
      messageType,
      twilioSid: twilioMessage.sid,
      status: 'sent',
    });

    return {
      success: true,
      messageId: twilioMessage.sid,
      status: twilioMessage.status,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);

    logger.smsError('Failed to send SMS', {
      error: errorMessage,
      phone: to.slice(0, 6) + '...',
      eventId,
    });

    // Log failed message to database
    if (eventId) {
      await logSMSToDatabase({
        eventId,
        guestId,
        phoneNumber: to,
        content: message,
        messageType,
        status: 'failed',
        errorMessage,
      });
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Send bulk SMS messages (for announcements)
 */
export async function sendBulkSMS(
  messages: SMSMessage[],
): Promise<{ sent: number; failed: number; results: SMSResult[] }> {
  const results: SMSResult[] = [];
  let sent = 0;
  let failed = 0;

  logger.sms(`Sending bulk SMS to ${messages.length} recipients`);

  // Send messages with a small delay to avoid rate limiting
  for (const message of messages) {
    const result = await sendSMS(message);
    results.push(result);

    if (result.success) {
      sent++;
    } else {
      failed++;
    }

    // Small delay to be respectful to Twilio's rate limits
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  logger.sms(`Bulk SMS complete: ${sent} sent, ${failed} failed`);

  return { sent, failed, results };
}

/**
 * Send RSVP reminder to specific guests
 */
export async function sendRSVPReminder(
  eventId: string,
  guestIds?: string[],
): Promise<{ sent: number; failed: number }> {
  try {
    // Import Supabase admin client to bypass RLS for event lookup
    const { supabaseAdmin } = await import('./supabase/admin');

    // Fetch event details using admin client
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select(
        'title, event_date, host:users!events_host_user_id_fkey(full_name)',
      )
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      throw new Error('Event not found');
    }

    // Fetch guests who need reminders
    let query = supabaseAdmin
      .from('event_guests')
      .select(
        `
        id, 
        role, 
        rsvp_status,
        users:user_id(id, full_name)
      `,
      )
      .eq('event_id', eventId);

    if (guestIds && guestIds.length > 0) {
      query = query.in('id', guestIds);
    } else {
      // Only send to pending RSVPs
      query = query.or('rsvp_status.is.null,rsvp_status.eq.pending');
    }

    const { data: guests, error: guestsError } = await query;

    if (guestsError) {
      throw new Error('Failed to fetch guests');
    }

    if (!guests || guests.length === 0) {
      return { sent: 0, failed: 0 };
    }

    // Create reminder message
    // const hostName = (event.host as { full_name?: string })?.full_name || 'Your host'
    // const eventDate = new Date(event.event_date).toLocaleDateString('en-US', {
    //   weekday: 'long',
    //   month: 'long',
    //   day: 'numeric'
    // })

    // Note: SMS functionality requires phone numbers which aren't available in public_user_profiles
    // This is a placeholder implementation for the simplified schema
    const messages: SMSMessage[] = [];

    logger.sms(`SMS Reminder would be sent to ${guests.length} guests`);
    logger.sms(
      'SMS functionality requires phone access - not available in simplified schema',
    );

    const result = await sendBulkSMS(messages);
    return { sent: result.sent, failed: result.failed };
  } catch (error) {
    logger.smsError('Failed to send RSVP reminders', error);
    return { sent: 0, failed: 1 };
  }
}

/**
 * Send announcement to all guests
 */
export async function sendEventAnnouncement(
  eventId: string,
  announcement: string,
  targetGuestIds?: string[],
): Promise<{ sent: number; failed: number }> {
  try {
    // Import Supabase admin client to bypass RLS for event lookup
    const { supabaseAdmin } = await import('./supabase/admin');

    // Fetch event details using admin client
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('title, host:users!events_host_user_id_fkey(full_name)')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      throw new Error('Event not found');
    }

    // Fetch guests - Note: phone not available in public_user_profiles for privacy
    let query = supabaseAdmin
      .from('event_guests')
      .select(
        `
        id,
        users:user_id(id, full_name)
      `,
      )
      .eq('event_id', eventId);

    if (targetGuestIds && targetGuestIds.length > 0) {
      query = query.in('id', targetGuestIds);
    }

    const { data: guests, error: guestsError } = await query;

    if (guestsError) {
      throw new Error('Failed to fetch guests');
    }

    if (!guests || guests.length === 0) {
      return { sent: 0, failed: 0 };
    }

    // const hostName = (event.host as { full_name?: string })?.full_name || 'Your host'

    // Note: SMS functionality requires phone numbers which aren't available in public_user_profiles
    // This is a placeholder implementation for the simplified schema
    const messages: SMSMessage[] = [];

    logger.sms(`SMS Announcement would be sent to ${guests.length} guests`);
    logger.sms(
      'SMS functionality requires phone access - not available in simplified schema',
    );

    const result = await sendBulkSMS(messages);
    return { sent: result.sent, failed: result.failed };
  } catch (error) {
    logger.smsError('Failed to send announcement', error);
    return { sent: 0, failed: 1 };
  }
}

/**
 * Format phone number for Twilio (E.164 format)
 */
function formatPhoneNumber(phone: string): string | null {
  if (!phone || typeof phone !== 'string') {
    logger.warn('Invalid phone input for formatting', { phone });
    return null;
  }

  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');

  logger.debug('Processing phone number', {
    original: phone.slice(0, 6) + '...',
    digits: digits.slice(0, 6) + '...',
    length: digits.length,
  });

  // Handle US numbers
  if (digits.length === 10) {
    const formatted = `+1${digits}`;
    logger.debug('Formatted 10-digit US number', {
      formatted: formatted.slice(0, 6) + '...',
    });
    return formatted;
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    const formatted = `+${digits}`;
    logger.debug('Formatted 11-digit US number', {
      formatted: formatted.slice(0, 6) + '...',
    });
    return formatted;
  }

  // If it already has country code
  if (digits.length > 10 && !digits.startsWith('1')) {
    const formatted = `+${digits}`;
    logger.debug('Formatted international number', {
      formatted: formatted.slice(0, 6) + '...',
    });
    return formatted;
  }

  logger.warn('Unable to format phone number', {
    digits,
    length: digits.length,
  });
  return null;
}

/**
 * Create personalized RSVP reminder message
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function createRSVPReminderMessage(
  guestName: string | null,
  eventTitle: string,
  eventDate: string,
  hostName: string,
): string {
  const name = guestName || 'there';

  return `Hi ${name}! ${hostName} here. We're excited for ${eventTitle} on ${eventDate} and would love to know if you can join us! Please RSVP when you have a moment. Can't wait to celebrate! 💕

Reply STOP to opt out.`;
}

/**
 * Create personalized announcement message
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function createAnnouncementMessage(
  guestName: string | null,
  announcement: string,
  eventTitle: string,
  hostName: string,
): string {
  const name = guestName || 'there';

  return `Hi ${name}! ${hostName} here with an update about ${eventTitle}:

${announcement}

Reply STOP to opt out.`;
}

/**
 * Send bulk SMS for scheduled message deliveries with Promise.allSettled
 */
export async function sendBulkScheduledSMS(
  deliveries: ScheduledSMSDelivery[],
): Promise<{
  successful: number;
  failed: number;
  results: Array<{ guestId: string; result: SMSResult }>;
}> {
  logger.sms(`Sending scheduled SMS to ${deliveries.length} recipients`);

  // Use Promise.allSettled for efficient bulk processing
  const promises = deliveries.map(async (delivery) => ({
    guestId: delivery.guestId,
    result: await sendScheduledSMS(delivery),
  }));

  const results = await Promise.allSettled(promises);

  const processedResults = results.map((result) =>
    result.status === 'fulfilled'
      ? result.value
      : {
          guestId: 'unknown',
          result: {
            success: false,
            error: 'Promise rejection',
            shouldRetry: false,
          },
        },
  );

  const successful = processedResults.filter((r) => r.result.success).length;
  const failed = processedResults.filter((r) => !r.result.success).length;

  logger.sms(
    `Bulk scheduled SMS complete: ${successful} sent, ${failed} failed`,
  );

  return {
    successful,
    failed,
    results: processedResults,
  };
}

// Removed: isRetryableError function - now using unified RetryManager from lib/utils/retry.ts

/**
 * Validate and normalize phone number for SMS delivery
 */
export function validateAndNormalizePhone(phone: string): {
  isValid: boolean;
  normalized?: string;
  error?: string;
} {
  if (!phone || typeof phone !== 'string') {
    return { isValid: false, error: 'Phone number is required' };
  }

  const normalized = formatPhoneNumber(phone.trim());

  if (!normalized) {
    return {
      isValid: false,
      error:
        'Invalid phone number format. Please use a valid US/international number.',
    };
  }

  return { isValid: true, normalized };
}

/**
 * Log SMS to database for tracking (simplified implementation)
 */
async function logSMSToDatabase(logData: {
  eventId: string;
  guestId?: string;
  phoneNumber: string;
  content: string;
  messageType?: string;
  twilioSid?: string;
  status: 'sent' | 'failed';
  errorMessage?: string;
}) {
  try {
    // In the simplified schema, we don't have SMS logging tables
    // This is a stub for future implementation
    logger.sms('SMS Log', {
      event: logData.eventId,
      phone: logData.phoneNumber.slice(-4), // Only log last 4 digits for privacy
      status: logData.status,
      type: logData.messageType,
      sid: logData.twilioSid,
    });
  } catch (error) {
    logger.warn('Failed to log SMS to database', error);
  }
}
