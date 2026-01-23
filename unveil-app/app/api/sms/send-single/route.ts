import { NextRequest, NextResponse } from 'next/server';
import { sendSMS } from '@/lib/sms';
import type { SMSMessage } from '@/lib/sms';
import { logger } from '@/lib/logger';
import { createApiSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const route = '/api/sms/send-single';
    const env = process.env.NODE_ENV || 'unknown';

    if (process.env.NODE_ENV === 'production') {
      logger.api('[TELEMETRY] sms.legacy_endpoint_blocked', { route, env });
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const supabase = createApiSupabaseClient(request);
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      logger.api('[TELEMETRY] sms.legacy_endpoint_reject', {
        route,
        reason: 'missing_session',
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const message = body as SMSMessage;

    if (
      !message ||
      typeof message.to !== 'string' ||
      typeof message.message !== 'string' ||
      typeof message.eventId !== 'string'
    ) {
      logger.api('[TELEMETRY] sms.legacy_endpoint_reject', {
        route,
        reason: 'invalid_payload',
      });
      return NextResponse.json(
        { error: 'Invalid request: to, message, and eventId are required' },
        { status: 400 },
      );
    }

    const { data: isHost, error: hostError } = await supabase.rpc(
      'is_event_host',
      { p_event_id: message.eventId },
    );

    if (hostError) {
      logger.api('[TELEMETRY] sms.legacy_endpoint_reject', {
        route,
        reason: 'host_check_failed',
      });
      return NextResponse.json(
        { error: 'Authorization check failed' },
        { status: 500 },
      );
    }

    if (!isHost) {
      logger.api('[TELEMETRY] sms.legacy_endpoint_reject', {
        route,
        reason: 'not_host',
      });
      return NextResponse.json(
        { error: 'User is not authorized as host for this event' },
        { status: 403 },
      );
    }

    const result = await sendSMS(message);

    logger.api(`Single SMS API completed:`, {
      success: result.success,
      messageId: result.messageId,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to send SMS message';
    logger.apiError('Single SMS API error', error);
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 },
    );
  }
}
