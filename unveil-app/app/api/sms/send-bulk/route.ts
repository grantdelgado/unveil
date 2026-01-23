import { NextRequest, NextResponse } from 'next/server';
import { sendBulkSMS } from '@/lib/sms';
import type { SMSMessage } from '@/lib/sms';
import { logger } from '@/lib/logger';
import { createApiSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const route = '/api/sms/send-bulk';
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
    const { messages } = body as { messages: SMSMessage[] };

    if (!messages || !Array.isArray(messages)) {
      logger.api('[TELEMETRY] sms.legacy_endpoint_reject', {
        route,
        reason: 'missing_messages',
      });
      return NextResponse.json(
        { error: 'Invalid request: messages array is required' },
        { status: 400 },
      );
    }

    if (messages.length === 0) {
      logger.api('[TELEMETRY] sms.legacy_endpoint_reject', {
        route,
        reason: 'empty_messages',
      });
      return NextResponse.json(
        { error: 'No messages to send' },
        { status: 400 },
      );
    }

    if (messages.length > 50) {
      logger.api('[TELEMETRY] sms.legacy_endpoint_reject', {
        route,
        reason: 'message_limit_exceeded',
      });
      return NextResponse.json(
        { error: 'Bulk message limit exceeded (max 50)' },
        { status: 400 },
      );
    }

    const invalidMessage = messages.find(
      (message) =>
        !message ||
        typeof message.to !== 'string' ||
        typeof message.message !== 'string' ||
        typeof message.eventId !== 'string',
    );

    if (invalidMessage) {
      logger.api('[TELEMETRY] sms.legacy_endpoint_reject', {
        route,
        reason: 'invalid_payload',
      });
      return NextResponse.json(
        { error: 'Invalid request: each message must include to, message, eventId' },
        { status: 400 },
      );
    }

    const eventId = messages[0]?.eventId;
    const hasMixedEvents = messages.some(
      (message) => message.eventId !== eventId,
    );

    if (!eventId || hasMixedEvents) {
      logger.api('[TELEMETRY] sms.legacy_endpoint_reject', {
        route,
        reason: 'mixed_event_ids',
      });
      return NextResponse.json(
        { error: 'All messages must target the same eventId' },
        { status: 400 },
      );
    }

    const { data: isHost, error: hostError } = await supabase.rpc(
      'is_event_host',
      { p_event_id: eventId },
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

    logger.api(`Bulk SMS API: Sending ${messages.length} messages`);

    const result = await sendBulkSMS(messages);

    logger.api(`Bulk SMS API completed:`, {
      sent: result.sent,
      failed: result.failed,
      total: messages.length,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to send SMS messages';
    logger.apiError('Bulk SMS API error', error);
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 },
    );
  }
}
