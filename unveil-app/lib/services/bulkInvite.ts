/**
 * Bulk invitation service
 * Client-side service for sending bulk invitations
 */

export interface BulkInviteRequest {
  eventId: string;
  guestIds?: string[]; // Optional - if omitted, invites all eligible guests
}

export interface BulkInviteError {
  guestId: string;
  reason: string;
}

export interface BulkInviteResult {
  success: boolean;
  data?: {
    sent: number;
    skipped: number;
    errors: BulkInviteError[];
  };
  error?: string;
}

/**
 * Send bulk invitations to eligible guests
 * Uses the unified bulk invite API endpoint
 */
export async function sendBulkInvitations(
  request: BulkInviteRequest,
): Promise<BulkInviteResult> {
  try {
    console.log('Sending bulk invitations:', {
      eventId: request.eventId,
      guestCount: request.guestIds?.length || 'all eligible',
    });

    const response = await fetch('/api/guests/invite-bulk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const result = await response.json();

    if (!response.ok) {
      const errorMsg =
        result.error || `HTTP ${response.status}: Failed to send bulk invitations`;
      throw new Error(errorMsg);
    }

    if (!result.success) {
      const errorMsg = result.error || 'Failed to send bulk invitations';
      throw new Error(errorMsg);
    }

    console.log('Bulk invitations sent successfully:', {
      eventId: request.eventId,
      sent: result.data.sent,
      skipped: result.data.skipped,
      errors: result.data.errors.length,
    });

    return result;
  } catch (error: unknown) {
    console.error('Error sending bulk invitations:', {
      error: error instanceof Error ? error.message : String(error),
      eventId: request.eventId,
    });

    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to send bulk invitations',
    };
  }
}

/**
 * Get the count of eligible guests for bulk invitations
 * Uses the same RPC as the bulk invite endpoint
 */
export async function getEligibleGuestCount(eventId: string): Promise<number> {
  try {
    const { supabase } = await import('@/lib/supabase/client');
    
    const { data, error } = await supabase.rpc(
      'get_invitable_guest_ids',
      { p_event_id: eventId },
    );

    if (error) {
      console.error('Failed to fetch eligible guest count:', error);
      return 0;
    }

    // Type the response properly
    const typedData = data as Array<{ guest_id: string }> | null;
    return typedData?.length || 0;
  } catch (error) {
    console.error('Error fetching eligible guest count:', error);
    return 0;
  }
}
