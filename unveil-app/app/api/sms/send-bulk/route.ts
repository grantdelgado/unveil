import { NextRequest, NextResponse } from 'next/server';
import { sendBulkSMS } from '@/lib/sms';
import type { SMSMessage } from '@/lib/sms';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages } = body as { messages: SMSMessage[] };

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Invalid request: messages array is required' },
        { status: 400 }
      );
    }

    if (messages.length === 0) {
      return NextResponse.json(
        { error: 'No messages to send' },
        { status: 400 }
      );
    }

    logger.api(`Bulk SMS API: Sending ${messages.length} messages`);

    const result = await sendBulkSMS(messages);

    logger.api(`Bulk SMS API completed:`, {
      sent: result.sent,
      failed: result.failed,
      total: messages.length
    });

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    logger.apiError('Bulk SMS API error', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to send SMS messages' 
      },
      { status: 500 }
    );
  }
}
