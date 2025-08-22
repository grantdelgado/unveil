import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase/admin';

/**
 * Twilio Webhook Handler for SMS Delivery Status Updates
 *
 * Processes delivery status callbacks from Twilio and updates message_deliveries table
 *
 * Expected webhook parameters from Twilio:
 * - MessageSid: Unique identifier for the message
 * - MessageStatus: Current status (queued, sent, delivered, undelivered, failed)
 * - To: Recipient phone number
 * - From: Sender phone number
 * - ErrorCode: Error code if delivery failed
 * - ErrorMessage: Error description if delivery failed
 */
export async function POST(request: NextRequest) {
  try {
    logger.api('Twilio webhook received');

    // Parse form data from Twilio webhook
    const formData = await request.formData();

    const messageSid = formData.get('MessageSid')?.toString();
    const messageStatus = formData.get('MessageStatus')?.toString();
    const toNumber = formData.get('To')?.toString();
    // const fromNumber = formData.get('From')?.toString(); // Unused for now
    const errorCode = formData.get('ErrorCode')?.toString();
    const errorMessage = formData.get('ErrorMessage')?.toString();

    // Validate required parameters
    if (!messageSid || !messageStatus) {
      logger.apiError(
        'Invalid Twilio webhook: missing MessageSid or MessageStatus',
      );
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 },
      );
    }

    logger.api('Processing Twilio delivery status', {
      messageSid: messageSid.slice(0, 10) + '...',
      status: messageStatus,
      to: toNumber ? toNumber.slice(0, 6) + '...' : 'unknown',
      errorCode,
      hasError: !!errorCode,
    });

    // Map Twilio status to our internal status
    const internalStatus = mapTwilioStatus(messageStatus);

    // Update message delivery record
    const { data: updatedRecords, error: updateError } = await supabase
      .from('message_deliveries')
      .update({
        sms_status: internalStatus,
        sms_provider_id: messageSid,
        updated_at: new Date().toISOString(),
      })
      .eq('sms_provider_id', messageSid)
      .select();

    if (updateError) {
      // If no record found with sms_provider_id, try to find by phone number
      if (updateError.message.includes('0 rows') && toNumber) {
        const { data: phoneRecords, error: phoneError } = await supabase
          .from('message_deliveries')
          .update({
            sms_status: internalStatus,
            sms_provider_id: messageSid,
            updated_at: new Date().toISOString(),
          })
          .eq('phone_number', toNumber)
          .is('sms_provider_id', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .select();

        if (phoneError) {
          logger.apiError(
            'Error updating delivery record by phone',
            phoneError,
          );
          return NextResponse.json(
            { error: 'Failed to update delivery record' },
            { status: 500 },
          );
        }

        if (phoneRecords && phoneRecords.length > 0) {
          logger.api('Updated delivery record by phone number', {
            recordId: phoneRecords[0].id,
            status: internalStatus,
          });
        } else {
          logger.apiError('No delivery record found for message', {
            messageSid: messageSid.slice(0, 10) + '...',
            phone: toNumber ? toNumber.slice(0, 6) + '...' : 'unknown',
          });
        }
      } else {
        logger.apiError('Error updating delivery record', updateError);
        return NextResponse.json(
          { error: 'Failed to update delivery record' },
          { status: 500 },
        );
      }
    } else {
      logger.api('Successfully updated delivery record', {
        recordsUpdated: updatedRecords?.length || 0,
        status: internalStatus,
      });
    }

    // Update aggregated message stats if status indicates final delivery result
    if (['delivered', 'undelivered', 'failed'].includes(messageStatus)) {
      await updateMessageAggregateStats(messageSid);
    }

    // Log error details if delivery failed
    if (errorCode && errorMessage) {
      logger.smsError('SMS delivery failed', {
        messageSid: messageSid.slice(0, 10) + '...',
        errorCode,
        errorMessage,
        phone: toNumber ? toNumber.slice(0, 6) + '...' : 'unknown',
      });
    }

    // Acknowledge webhook receipt
    return NextResponse.json({
      success: true,
      messageSid,
      status: internalStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.apiError('Error processing Twilio webhook', error);

    return NextResponse.json(
      {
        error: 'Failed to process webhook',
        timestamp: new Date().toISOString(),
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

/**
 * Map Twilio message status to our internal status values
 */
function mapTwilioStatus(twilioStatus: string): string {
  switch (twilioStatus.toLowerCase()) {
    case 'queued':
    case 'accepted':
      return 'pending';
    case 'sent':
      return 'sent';
    case 'delivered':
      return 'delivered';
    case 'undelivered':
      return 'undelivered';
    case 'failed':
      return 'failed';
    default:
      return 'pending';
  }
}

/**
 * Update aggregate message statistics when delivery status changes
 */
async function updateMessageAggregateStats(messageSid: string) {
  try {
    // Find the message record associated with this delivery
    const { data: deliveryRecord, error: findError } = await supabase
      .from('message_deliveries')
      .select('message_id, scheduled_message_id')
      .eq('sms_provider_id', messageSid)
      .single();

    if (findError || !deliveryRecord) {
      logger.apiError('Could not find delivery record for aggregate update', {
        messageSid: messageSid.slice(0, 10) + '...',
        error: findError?.message,
      });
      return;
    }

    // Update immediate message stats
    if (deliveryRecord.message_id) {
      await updateImmediateMessageStats(deliveryRecord.message_id);
    }

    // Update scheduled message stats
    if (deliveryRecord.scheduled_message_id) {
      await updateScheduledMessageStats(deliveryRecord.scheduled_message_id);
    }
  } catch (error) {
    logger.apiError('Error updating aggregate message stats', error);
  }
}

/**
 * Update stats for immediate messages
 */
async function updateImmediateMessageStats(messageId: string) {
  try {
    // Count delivery statuses for this message
    const { data: statusCounts, error: countError } = await supabase
      .from('message_deliveries')
      .select('sms_status')
      .eq('message_id', messageId);

    if (countError || !statusCounts) {
      return;
    }

    const delivered = statusCounts.filter(
      (r) => r.sms_status === 'delivered',
    ).length;
    const failed = statusCounts.filter(
      (r) => r.sms_status && ['failed', 'undelivered'].includes(r.sms_status),
    ).length;

    // TODO: Update message delivery statistics
    // Note: delivered_count and failed_count fields don't exist in messages table
    // Consider adding these fields to the database schema or tracking in message_deliveries table
    console.log(
      `Message ${messageId} delivery status: ${delivered} delivered, ${failed} failed`,
    );

    logger.api('Updated immediate message stats', {
      messageId,
      delivered,
      failed,
    });
  } catch (error) {
    logger.apiError('Error updating immediate message stats', error);
  }
}

/**
 * Update stats for scheduled messages
 */
async function updateScheduledMessageStats(scheduledMessageId: string) {
  try {
    // Count delivery statuses for this scheduled message
    const { data: statusCounts, error: countError } = await supabase
      .from('message_deliveries')
      .select('sms_status')
      .eq('scheduled_message_id', scheduledMessageId);

    if (countError || !statusCounts) {
      return;
    }

    const delivered = statusCounts.filter(
      (r) => r.sms_status === 'delivered',
    ).length;
    const failed = statusCounts.filter(
      (r) => r.sms_status && ['failed', 'undelivered'].includes(r.sms_status),
    ).length;

    // Update scheduled message record
    await supabase
      .from('scheduled_messages')
      .update({
        success_count: delivered,
        failure_count: failed,
      })
      .eq('id', scheduledMessageId);

    logger.api('Updated scheduled message stats', {
      scheduledMessageId,
      delivered,
      failed,
    });
  } catch (error) {
    logger.apiError('Error updating scheduled message stats', error);
  }
}

// Also support GET for testing/validation
export async function GET() {
  return NextResponse.json({
    service: 'Twilio Webhook Handler',
    status: 'active',
    endpoint: '/api/webhooks/twilio',
    methods: ['POST'],
    timestamp: new Date().toISOString(),
    note: 'Configure this URL in your Twilio Console as the webhook endpoint',
  });
}
