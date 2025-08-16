import { NextRequest, NextResponse } from 'next/server';
import { sendSMS } from '@/lib/sms';
import type { SMSMessage } from '@/lib/sms';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message = body as SMSMessage;

    if (!message.to || !message.message || !message.eventId) {
      return NextResponse.json(
        { error: 'Invalid request: to, message, and eventId are required' },
        { status: 400 }
      );
    }

    logger.api(`Single SMS API: Sending to ${message.to.slice(0, 6)}...`);

    const result = await sendSMS(message);

    logger.api(`Single SMS API completed:`, {
      success: result.success,
      messageId: result.messageId,
      phone: message.to.slice(0, 6) + '...'
    });

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    logger.apiError('Single SMS API error', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to send SMS message' 
      },
      { status: 500 }
    );
  }
}
