import { getErrorMessage } from './utils';
import { SMSRetry } from '@/lib/utils/retry';

// Twilio configuration - will be dynamically imported to avoid server-side issues
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const twilioMessagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

// Initialize Twilio client lazily

let twilioClient: ReturnType<typeof import('twilio')> | null = null;

const getTwilioClient = async () => {
  if (!twilioClient && accountSid && authToken) {
    const twilio = (await import('twilio')).default;
    twilioClient = twilio(accountSid, authToken);
  }
  return twilioClient;
};

export interface SMSMessage {
  to: string;
  message: string;
  eventId: string;
  guestId?: string;
  messageType?: 'rsvp_reminder' | 'announcement' | 'welcome' | 'custom';
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
export async function sendScheduledSMS(delivery: ScheduledSMSDelivery): Promise<SMSResult> {
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
          console.log(`✅ SMS sent successfully on retry ${attempt + 1} for guest ${delivery.guestId.slice(-4)}`);
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
        console.log(`❌ Non-retryable error for guest ${delivery.guestId.slice(-4)}: ${result.error}`);
        return {
          ...result,
          shouldRetry: false,
        };
      }
      
      lastError = result.error || 'Unknown error';
      console.log(`⚠️ Retryable error for guest ${delivery.guestId.slice(-4)}, attempt ${attempt + 1}/${maxRetries}: ${lastError}`);
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
      
    } catch (error) {
      lastError = getErrorMessage(error);
      console.error(`❌ Exception during SMS send attempt ${attempt + 1} for guest ${delivery.guestId.slice(-4)}:`, lastError);
      
      // If this was the last attempt, return failure
      if (attempt === maxRetries - 1) {
        return {
          success: false,
          error: lastError,
          shouldRetry: false,
        };
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
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
}: SMSMessage): Promise<SMSResult> {
  try {
    // Get Twilio client
    const client = await getTwilioClient();
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

    // Redact phone number for logging (show first 3 and last 4 characters)
    const redactedPhone = formattedPhone.length > 7 
      ? `${formattedPhone.slice(0, 3)}...${formattedPhone.slice(-4)}`
      : '***redacted***';
      
    console.log(
      `📱 Sending SMS to ${redactedPhone}:`,
      message.substring(0, 50) + '...',
    );

    // Create message params - use messaging service if available, otherwise phone number
    const messageParams: {
      body: string;
      to: string;
      messagingServiceSid?: string;
      from?: string;
    } = {
      body: message,
      to: formattedPhone,
    };

    if (twilioMessagingServiceSid) {
      messageParams.messagingServiceSid = twilioMessagingServiceSid;
      console.log(`📱 Using Messaging Service: ${twilioMessagingServiceSid}`);
    } else if (twilioPhoneNumber) {
      messageParams.from = twilioPhoneNumber;
      console.log(`📱 Using Phone Number: ${twilioPhoneNumber}`);
    } else {
      throw new Error('No Twilio sender configured');
    }

    // Send SMS via Twilio
    const twilioMessage = await client.messages.create(messageParams);

    console.log(`✅ SMS sent successfully. SID: ${twilioMessage.sid}`);

    // Log to database for tracking
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
    console.error('❌ Failed to send SMS:', errorMessage);

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

  console.log(`📱 Sending bulk SMS to ${messages.length} recipients`);

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

  console.log(`✅ Bulk SMS complete: ${sent} sent, ${failed} failed`);

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
    // Import Supabase dynamically to avoid circular dependencies
    const { supabase } = await import('./supabase');

    // Fetch event details
    const { data: event, error: eventError } = await supabase
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
    let query = supabase
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

    console.log(
      '📱 SMS Reminder would be sent to',
      guests.length,
      'guests',
    );
    console.log(
      '⚠️ SMS functionality requires phone access - not available in simplified schema',
    );

    const result = await sendBulkSMS(messages);
    return { sent: result.sent, failed: result.failed };
  } catch (error) {
    console.error('❌ Failed to send RSVP reminders:', error);
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
    // Import Supabase dynamically to avoid circular dependencies
    const { supabase } = await import('./supabase');

    // Fetch event details
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select(
        'title, host:users!events_host_user_id_fkey(full_name)',
      )
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      throw new Error('Event not found');
    }

    // Fetch guests - Note: phone not available in public_user_profiles for privacy
    let query = supabase
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

    console.log(
      '📱 SMS Announcement would be sent to',
      guests.length,
      'guests',
    );
    console.log(
      '⚠️ SMS functionality requires phone access - not available in simplified schema',
    );

    const result = await sendBulkSMS(messages);
    return { sent: result.sent, failed: result.failed };
  } catch (error) {
    console.error('❌ Failed to send announcement:', error);
    return { sent: 0, failed: 1 };
  }
}

/**
 * Format phone number for Twilio (E.164 format)
 */
function formatPhoneNumber(phone: string): string | null {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');

  // Handle US numbers
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // If it already has country code
  if (digits.length > 10 && !digits.startsWith('1')) {
    return `+${digits}`;
  }

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
  deliveries: ScheduledSMSDelivery[]
): Promise<{
  successful: number;
  failed: number;
  results: Array<{ guestId: string; result: SMSResult }>;
}> {
  console.log(`📱 Sending scheduled SMS to ${deliveries.length} recipients`);
  
  // Use Promise.allSettled for efficient bulk processing
  const promises = deliveries.map(async (delivery) => ({
    guestId: delivery.guestId,
    result: await sendScheduledSMS(delivery),
  }));
  
  const results = await Promise.allSettled(promises);
  
  const processedResults = results.map(result => 
    result.status === 'fulfilled' 
      ? result.value 
      : { 
          guestId: 'unknown', 
          result: { 
            success: false, 
            error: 'Promise rejection', 
            shouldRetry: false 
          } 
        }
  );
  
  const successful = processedResults.filter(r => r.result.success).length;
  const failed = processedResults.filter(r => !r.result.success).length;
  
  console.log(`✅ Bulk scheduled SMS complete: ${successful} sent, ${failed} failed`);
  
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
export function validateAndNormalizePhone(phone: string): { isValid: boolean; normalized?: string; error?: string } {
  if (!phone || typeof phone !== 'string') {
    return { isValid: false, error: 'Phone number is required' };
  }
  
  const normalized = formatPhoneNumber(phone.trim());
  
  if (!normalized) {
    return { 
      isValid: false, 
      error: 'Invalid phone number format. Please use a valid US/international number.' 
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
    console.log('📝 SMS Log:', {
      event: logData.eventId,
      phone: logData.phoneNumber.slice(-4), // Only log last 4 digits for privacy
      status: logData.status,
      type: logData.messageType,
      sid: logData.twilioSid,
    });
  } catch (error) {
    console.warn('⚠️ Failed to log SMS to database:', error);
  }
}
