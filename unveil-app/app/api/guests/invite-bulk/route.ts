import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { sendGuestInviteCore, type InviteGuestResult } from '@/lib/services/inviteCore';
import { logger } from '@/lib/logger';

interface BulkInviteRequest {
  eventId: string;
  guestIds?: string[]; // Optional - if omitted, fetch all eligible guests
}

// Inline the result type to avoid unused interface warning

/**
 * Bulk invite endpoint that reuses single-invite core logic
 * Ensures identical behavior and template usage
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: BulkInviteRequest = await request.json();
    const { eventId, guestIds } = body;

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'Event ID is required' },
        { status: 400 },
      );
    }

    logger.api('Bulk invite request started', {
      eventId,
      providedGuestIds: guestIds?.length || 0,
    });

    const supabase = await createServerSupabaseClient();

    // Verify user is event host
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      );
    }

    // Check host authorization
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
        { success: false, error: 'Authorization check failed' },
        { status: 500 },
      );
    }

    if (!hostCheck) {
      return NextResponse.json(
        { success: false, error: 'Only event hosts can send bulk invitations' },
        { status: 403 },
      );
    }

    // Get guest IDs to invite
    let targetGuestIds: string[];

    if (guestIds && guestIds.length > 0) {
      // Use provided guest IDs (de-duplicate)
      targetGuestIds = [...new Set(guestIds)];
    } else {
      // Fetch all eligible guest IDs using the new RPC
      const { data: eligibleGuests, error: eligibleError } = await supabase.rpc(
        'get_invitable_guest_ids',
        { p_event_id: eventId },
      );

      if (eligibleError) {
        logger.apiError('Failed to fetch eligible guest IDs', {
          error: eligibleError.message,
          eventId,
        });
        return NextResponse.json(
          { success: false, error: 'Failed to fetch eligible guests' },
          { status: 500 },
        );
      }

      // Type the response properly
      const typedEligibleGuests = eligibleGuests as Array<{ guest_id: string }> | null;
      targetGuestIds = typedEligibleGuests?.map((g) => g.guest_id) || [];
    }

    if (targetGuestIds.length === 0) {
      logger.api('No eligible guests found for bulk invite', { eventId });
      return NextResponse.json({
        success: true,
        data: {
          sent: 0,
          skipped: 0,
          errors: [],
          results: [],
        },
      });
    }

    logger.api('Processing bulk invitations', {
      eventId,
      totalGuests: targetGuestIds.length,
    });

    // Process invitations with concurrency control (pool of 8)
    const concurrencyLimit = 8;
    const results: InviteGuestResult[] = [];
    
    for (let i = 0; i < targetGuestIds.length; i += concurrencyLimit) {
      const batch = targetGuestIds.slice(i, i + concurrencyLimit);
      
      const batchPromises = batch.map(guestId =>
        sendGuestInviteCore({ eventId, guestId })
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Small delay between batches to avoid overwhelming the system
      if (i + concurrencyLimit < targetGuestIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Aggregate results
    const sent = results.filter(r => r.success).length;
    const errors = results
      .filter(r => !r.success)
      .map(r => ({
        guestId: r.guestId,
        reason: r.error || 'Unknown error',
      }));
    const skipped = errors.length;

    logger.api('Bulk invite completed', {
      eventId,
      totalRequested: targetGuestIds.length,
      sent,
      skipped,
      errorCount: errors.length,
    });

    // Log telemetry (counts only, no PII)
    logger.info('bulk_invite_completed', {
      event: 'bulk_invite_completed',
      event_id: eventId,
      total_requested: targetGuestIds.length,
      sent,
      skipped,
      errors: errors.length,
    });

    return NextResponse.json({
      success: true,
      data: {
        sent,
        skipped,
        errors: errors.slice(0, 20), // Limit error details to first 20
        results,
      },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.apiError('Bulk invite API error', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 },
    );
  }
}
