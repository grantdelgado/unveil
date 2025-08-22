/**
 * Service for sending single guest invitations
 */

export interface SingleInviteRequest {
  eventId: string;
  guestId: string;
}

export interface SingleInviteResult {
  success: boolean;
  data?: {
    guestId: string;
    guestName: string;
    smsStatus: string;
    messageId?: string;
    isFirstInvite: boolean;
    invitedAt: string;
    configMode?: string;
    simulationMode?: boolean;
  };
  error?: string;
}

/**
 * Send invitation to a single guest
 * Uses the dedicated single invite API endpoint
 */
export async function sendSingleGuestInvite(
  request: SingleInviteRequest,
): Promise<SingleInviteResult> {
  try {
    console.log('Sending single guest invitation:', {
      eventId: request.eventId,
      guestId: request.guestId,
    });

    const response = await fetch('/api/guests/invite-single', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const result = await response.json();

    if (!response.ok) {
      const errorMsg =
        result.error || `HTTP ${response.status}: Failed to send invitation`;
      throw new Error(errorMsg);
    }

    if (!result.success) {
      const errorMsg = result.error || 'Failed to send invitation';
      throw new Error(errorMsg);
    }

    console.log('Single guest invitation sent successfully:', {
      guestId: result.data.guestId,
      guestName: result.data.guestName,
      isFirstInvite: result.data.isFirstInvite,
      smsStatus: result.data.smsStatus,
      configMode: result.data.configMode,
      simulationMode: result.data.simulationMode,
    });

    return result;
  } catch (error: unknown) {
    console.error('Error sending single guest invitation:', {
      error: error instanceof Error ? error.message : String(error),
      eventId: request.eventId,
      guestId: request.guestId,
    });

    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to send invitation',
    };
  }
}
