/**
 * Client-side API helpers for SMS invitations
 * Safe to use in React components and client-side code
 */

export interface SMSInvitationGuest {
  phone: string;
  guestName?: string;
}

export interface SMSInvitationOptions {
  maxConcurrency?: number;
  skipRateLimit?: boolean;
}

export interface SMSInvitationResult {
  success: boolean;
  sent: number;
  failed: number;
  rateLimited: number;
  message: string;
  results?: Array<{
    phone: string;
    success: boolean;
    error?: string;
    rateLimited?: boolean;
  }>;
  error?: string;
}

/**
 * Send SMS invitations to a batch of guests via API route
 * This is safe to use on the client-side as it calls the server API
 */
export async function sendGuestInvitationsAPI(
  eventId: string,
  guests: SMSInvitationGuest[],
  options: SMSInvitationOptions = {}
): Promise<SMSInvitationResult> {
  try {
    // Get the user's session token
    const { supabase } = await import('../supabase/client');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      throw new Error('Authentication required to send invitations');
    }

    const response = await fetch('/api/sms/send-invitations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        eventId,
        guests,
        options
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to send invitations');
    }

    return {
      success: true,
      sent: result.sent,
      failed: result.failed,
      rateLimited: result.rateLimited,
      message: result.message,
      results: result.results
    };

  } catch (error) {
    console.error('Error sending SMS invitations:', error);
    return {
      success: false,
      sent: 0,
      failed: 0,
      rateLimited: 0,
      message: 'Failed to send invitations',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Send a single SMS invitation via API route
 */
export async function sendSingleGuestInvitationAPI(
  eventId: string,
  guest: SMSInvitationGuest,
  options: SMSInvitationOptions = {}
): Promise<SMSInvitationResult> {
  return sendGuestInvitationsAPI(eventId, [guest], options);
}