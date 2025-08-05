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
    // Get the user's session token with better error handling
    const { supabase } = await import('../supabase/client');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('Session error:', sessionError);
      throw new Error(`Authentication error: ${sessionError.message}`);
    }

    if (!session?.access_token) {
      throw new Error('No valid session found. Please log in again.');
    }

    // First check if event exists
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('host_user_id, title')
      .eq('id', eventId)
      .single();

    if (eventError) {
      console.error('Event lookup error:', eventError);
      throw new Error(`Event not found: ${eventError.message}`);
    }

    if (!event) {
      throw new Error('Event not found');
    }

    // Check if current user is authorized as host (either primary host or delegated host)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User authentication required');
    }

    const { data: hostCheck, error: hostError } = await supabase
      .rpc('is_event_host', { p_event_id: eventId });

    if (hostError) {
      console.error('Host authorization check failed:', hostError);
      throw new Error(`Authorization check failed: ${hostError.message}`);
    }

    if (!hostCheck) {
      throw new Error('You must be authorized as a host for this event to send invitations');
    }

    console.log('Sending SMS invitations:', {
      eventId,
      eventTitle: event.title,
      guestCount: guests.length,
      userId: user.id
    });

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
      console.error('SMS API error:', {
        status: response.status,
        statusText: response.statusText,
        error: result.error,
        details: result.details
      });
      throw new Error(result.error || `SMS API error (${response.status}): ${response.statusText}`);
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