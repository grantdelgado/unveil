import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { sendGuestInviteCore } from '@/lib/services/inviteCore';
import { logger } from '@/lib/logger';
import { getPublicBaseUrl } from '@/lib/utils/url';

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
    // Pre-flight check: validate base URL configuration
    let baseUrlStatus = 'unknown';
    let configMode = 'production';

    try {
      const resolvedBaseUrl = getPublicBaseUrl();
      if (resolvedBaseUrl === 'https://dev-simulation.localhost') {
        baseUrlStatus = 'simulation';
        configMode = 'development-simulation';
      } else if (process.env.DEV_TUNNEL_URL) {
        baseUrlStatus = 'tunnel';
        configMode = 'development-tunnel';
      } else {
        baseUrlStatus = 'configured';
        configMode =
          process.env.NODE_ENV === 'production' ? 'production' : 'development';
      }

      logger.info('Invite route base URL status', {
        baseUrlStatus,
        configMode,
        resolvedUrl: resolvedBaseUrl.substring(0, 30) + '...',
        simulationMode: process.env.DEV_SIMULATE_INVITES === 'true',
      });
    } catch (urlError) {
      logger.apiError('Base URL configuration error', {
        error:
          urlError instanceof Error ? urlError.message : 'Unknown URL error',
      });

      return NextResponse.json(
        {
          success: false,
          error:
            urlError instanceof Error
              ? urlError.message
              : 'Invalid base URL configuration',
        },
        { status: 500 },
      );
    }

    const supabase = await createServerSupabaseClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      );
    }

    const body: InviteSingleGuestRequest = await request.json();
    const { eventId, guestId } = body;

    // Validation
    if (!eventId || !guestId) {
      return NextResponse.json(
        { error: 'Event ID and guest ID are required' },
        { status: 400 },
      );
    }

    // Verify user is host of the event using RPC
    const { data: hostCheck, error: hostError } = await supabase.rpc(
      'is_event_host',
      { p_event_id: eventId },
    );

    if (hostError) {
      logger.apiError('Host authorization check failed', {
        error: hostError.message,
        eventId,
        userId: user.id,
      });
      return NextResponse.json(
        { error: 'Authorization check failed' },
        { status: 500 },
      );
    }

    if (!hostCheck) {
      return NextResponse.json(
        { error: 'Only event hosts can send invitations' },
        { status: 403 },
      );
    }

    // Use shared core logic for invitation processing
    const result = await sendGuestInviteCore({ eventId, guestId });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send invitation' },
        { status: 400 },
      );
    }

    logger.api('Single guest invitation sent successfully', {
      eventId,
      guestId: result.guestId,
      guestName: result.guestName || 'Unnamed Guest',
      isFirstInvite: result.isFirstInvite,
      smsStatus: result.smsStatus,
      configMode,
      baseUrlStatus,
    });

    return NextResponse.json({
      success: true,
      data: {
        guestId: result.guestId,
        guestName: result.guestName || 'Unnamed Guest',
        smsStatus: result.smsStatus,
        isFirstInvite: result.isFirstInvite,
        invitedAt: new Date().toISOString(),
        configMode: result.configMode || configMode,
        simulationMode: result.simulationMode || process.env.DEV_SIMULATE_INVITES === 'true',
      },
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to send invitation';
    logger.apiError('Error in single guest invitation', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 },
    );
  }
}
