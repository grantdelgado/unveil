import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase/admin';
import { sendBulkSMS } from '@/lib/sms';
import type { RecipientFilter } from '@/lib/types/messaging';
import type { Database } from '@/app/reference/supabase.types';

export async function POST(request: NextRequest) {
  try {
    logger.api('Processing scheduled messages API called');

    // Verify the request is authorized (internal calls only)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Require valid cron secret for all environments
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const processingStartTime = new Date();
    let processedCount = 0;
    let successfulCount = 0;
    let failedCount = 0;
    const processingDetails: Array<{
      messageId: string;
      status: string;
      recipientCount: number;
      error?: string;
    }> = [];

    // Fetch messages ready to send (with idempotency protection)
    const { data: readyMessages, error: fetchError } = await supabase
      .from('scheduled_messages')
      .select('*')
      .eq('status', 'scheduled')
      .lte('send_at', new Date().toISOString())
      .order('send_at', { ascending: true })
      .limit(100); // Process max 100 messages per run to avoid timeouts

    if (fetchError) {
      throw new Error(`Failed to fetch scheduled messages: ${fetchError.message}`);
    }

    if (!readyMessages || readyMessages.length === 0) {
      logger.api('No scheduled messages ready for processing');
      return NextResponse.json({
        success: true,
        timestamp: new Date().toISOString(),
        totalProcessed: 0,
        successful: 0,
        failed: 0,
        details: [],
        message: 'No messages ready for processing'
      });
    }

    logger.api(`Found ${readyMessages.length} scheduled messages ready for processing`);

    // Process each message
    for (const message of readyMessages) {
      processedCount++;
      
      try {
        // Mark message as processing to prevent double-processing
        const { error: lockError } = await supabase
          .from('scheduled_messages')
          .update({ status: 'sending' })
          .eq('id', message.id)
          .eq('status', 'scheduled'); // Only update if still scheduled

        if (lockError) {
          throw new Error(`Failed to lock message: ${lockError.message}`);
        }

        // Reconstruct RecipientFilter from scheduled message data
        const recipientFilter: RecipientFilter = reconstructRecipientFilter(message);

        // Resolve recipients using the same logic as immediate messages
        const resolvedRecipients = await resolveScheduledMessageRecipients(
          message.event_id,
          recipientFilter
        );

        if (resolvedRecipients.length === 0) {
          // Mark as failed - no recipients
          await supabase
            .from('scheduled_messages')
            .update({ 
              status: 'failed',
              sent_at: new Date().toISOString(),
              failure_count: 1,
              success_count: 0
            })
            .eq('id', message.id);

          processingDetails.push({
            messageId: message.id,
            status: 'failed',
            recipientCount: 0,
            error: 'No valid recipients found'
          });
          failedCount++;
          continue;
        }

        let smsDelivered = 0;
        let smsFailed = 0;
        let messageRecord: { id: string } | null = null;

        // Create message record first (for delivery tracking)
        const { data: createdMessage, error: messageError } = await supabase
          .from('messages')
          .insert({
            event_id: message.event_id,
            content: message.content,
            message_type: message.message_type as Database['public']['Enums']['message_type_enum'],
            sender_user_id: message.sender_user_id,
            created_at: new Date().toISOString()
          })
          .select('id')
          .single();

        if (messageError) {
          logger.apiError('Error creating message record for scheduled message', messageError);
          throw messageError;
        }

        messageRecord = createdMessage;
        logger.api(`Created message record ${messageRecord.id} for scheduled message ${message.id}`);

        // Send SMS if enabled
        if (message.send_via_sms && resolvedRecipients.length > 0) {
          const smsMessages = resolvedRecipients.map(guest => ({
            to: guest.phone,
            message: message.content,
            eventId: message.event_id,
            guestId: guest.id,
            messageType: (['announcement', 'welcome', 'custom', 'rsvp_reminder'].includes(message.message_type || '')) 
              ? message.message_type as 'announcement' | 'welcome' | 'custom' | 'rsvp_reminder'
              : 'announcement'
          }));

          const smsResult = await sendBulkSMS(smsMessages);
          smsDelivered = smsResult.sent;
          smsFailed = smsResult.failed;

          // Create delivery tracking records with proper message_id
          if (resolvedRecipients.length > 0 && messageRecord) {
            const deliveryRecords = resolvedRecipients.map(guest => ({
              scheduled_message_id: message.id,
              message_id: messageRecord.id, // CRITICAL FIX: Link to message record
              guest_id: guest.id,
              phone_number: guest.phone,
              sms_status: 'sent', // Will be updated by webhook
              push_status: 'not_applicable',
              email_status: 'not_applicable'
            }));

            const { error: deliveryError } = await supabase
              .from('message_deliveries')
              .insert(deliveryRecords);

            if (deliveryError) {
              logger.apiError('Error creating delivery records', deliveryError);
            } else {
              logger.api(`Created ${deliveryRecords.length} delivery records for message ${messageRecord.id}`);
            }
          }
        }

        // Handle push notifications (placeholder)
        let pushDelivered = 0;
        if (message.send_via_push && resolvedRecipients.length > 0) {
          // TODO: Implement push notification delivery
          pushDelivered = resolvedRecipients.length;
          logger.api(`Push notifications would be sent to ${resolvedRecipients.length} guests`);
        }

        const totalDelivered = smsDelivered + pushDelivered;
        const totalFailed = smsFailed;

        // Update message status based on delivery results
        const finalStatus = totalFailed === 0 ? 'sent' : 
                           totalDelivered > 0 ? 'partially_failed' : 'failed';

        await supabase
          .from('scheduled_messages')
          .update({
            status: finalStatus,
            sent_at: new Date().toISOString(),
            success_count: totalDelivered,
            failure_count: totalFailed
          })
          .eq('id', message.id);

        processingDetails.push({
          messageId: message.id,
          status: finalStatus,
          recipientCount: resolvedRecipients.length,
          error: totalFailed > 0 ? `${totalFailed} delivery failures` : undefined
        });

        if (finalStatus === 'sent') {
          successfulCount++;
        } else {
          failedCount++;
        }

        logger.api(`Processed scheduled message ${message.id}: ${finalStatus}, delivered: ${totalDelivered}, failed: ${totalFailed}`);

      } catch (messageError) {
        // Mark message as failed
        await supabase
          .from('scheduled_messages')
          .update({ 
            status: 'failed',
            sent_at: new Date().toISOString(),
            failure_count: 1,
            success_count: 0
          })
          .eq('id', message.id);

        const errorMessage = messageError instanceof Error ? messageError.message : 'Unknown error';
        processingDetails.push({
          messageId: message.id,
          status: 'failed',
          recipientCount: 0,
          error: errorMessage
        });

        failedCount++;
        logger.apiError(`Failed to process scheduled message ${message.id}`, messageError);
      }
    }

    const processingEndTime = new Date();
    const processingDuration = processingEndTime.getTime() - processingStartTime.getTime();

    logger.api(`Scheduled message processing completed: ${processedCount} processed, ${successfulCount} successful, ${failedCount} failed`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      totalProcessed: processedCount,
      successful: successfulCount,
      failed: failedCount,
      details: processingDetails,
      processingTimeMs: processingDuration,
      message: `Processed ${processedCount} scheduled messages`
    });

  } catch (error) {
    logger.apiError('Error processing scheduled messages', error);
    
    return NextResponse.json(
      {
        error: 'Failed to process scheduled messages',
        timestamp: new Date().toISOString(),
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Reconstruct RecipientFilter from scheduled message database format
 */
function reconstructRecipientFilter(scheduledMessage: Record<string, unknown>): RecipientFilter {
  if (scheduledMessage.target_all_guests) {
    return { type: 'all' };
  }

  if (scheduledMessage.target_guest_ids && Array.isArray(scheduledMessage.target_guest_ids) && scheduledMessage.target_guest_ids.length > 0) {
    return {
      type: 'explicit_selection',
      selectedGuestIds: scheduledMessage.target_guest_ids as string[]
    };
  }

  if (scheduledMessage.target_guest_tags && Array.isArray(scheduledMessage.target_guest_tags) && scheduledMessage.target_guest_tags.length > 0) {
    const tags = (scheduledMessage.target_guest_tags as string[]).filter((tag: string) => !tag.startsWith('rsvp:'));
    const rsvpStatuses = (scheduledMessage.target_guest_tags as string[])
      .filter((tag: string) => tag.startsWith('rsvp:'))
      .map((tag: string) => tag.replace('rsvp:', ''));

    if (tags.length > 0 && rsvpStatuses.length > 0) {
      return {
        type: 'combined',
        tags,
        rsvpStatuses,
        requireAllTags: false
      };
    } else if (tags.length > 0) {
      return {
        type: 'tags',
        tags,
        requireAllTags: false
      };
    } else if (rsvpStatuses.length > 0) {
      return {
        type: 'rsvp_status',
        rsvpStatuses
      };
    }
  }

  // Fallback to all guests
  return { type: 'all' };
}

/**
 * Resolve recipients for scheduled messages (similar to immediate messages)
 */
async function resolveScheduledMessageRecipients(
  eventId: string,
  filter: RecipientFilter
): Promise<Array<{ id: string; phone: string; guest_name: string }>> {
  try {
    // Handle simple 'all' filter
    if (filter.type === 'all') {
      const { data: guests, error } = await supabase
        .from('event_guests')
        .select('id, phone, guest_name')
        .eq('event_id', eventId)
        .is('removed_at', null) // Use canonical scope - exclude removed guests
        .eq('sms_opt_out', false) // Exclude opted-out guests
        .not('phone', 'is', null)
        .neq('phone', '');

      if (error) throw error;
      return (guests || [])
        .filter(guest => guest.phone) // Filter out guests without phone numbers
        .map(guest => ({
          ...guest,
          phone: guest.phone as string, // Type assertion since we filtered out nulls
          guest_name: guest.guest_name || 'Guest'
        }));
    }

    // Handle explicit guest selection (NEW)
    if (filter.type === 'explicit_selection' && filter.selectedGuestIds) {
      const { data: guests, error } = await supabase
        .from('event_guests')
        .select('id, phone, guest_name')
        .eq('event_id', eventId)
        .in('id', filter.selectedGuestIds)
        .is('removed_at', null) // Use canonical scope - exclude removed guests
        .eq('sms_opt_out', false) // Exclude opted-out guests
        .not('phone', 'is', null)
        .neq('phone', '');

      if (error) throw error;
      return (guests || [])
        .filter(guest => guest.phone) // Filter out guests without phone numbers
        .map(guest => ({
          ...guest,
          phone: guest.phone as string, // Type assertion since we filtered out nulls
          guest_name: guest.guest_name || 'Guest'
        }));
    }

    // Handle individual guest selection (legacy)
    if (filter.type === 'individual' && filter.guestIds) {
      const { data: guests, error } = await supabase
        .from('event_guests')
        .select('id, phone, guest_name')
        .eq('event_id', eventId)
        .in('id', filter.guestIds)
        .is('removed_at', null) // Use canonical scope - exclude removed guests
        .eq('sms_opt_out', false) // Exclude opted-out guests
        .not('phone', 'is', null)
        .neq('phone', '');

      if (error) throw error;
      return (guests || [])
        .filter(guest => guest.phone) // Filter out guests without phone numbers
        .map(guest => ({
          ...guest,
          phone: guest.phone as string, // Type assertion since we filtered out nulls
          guest_name: guest.guest_name || 'Guest'
        }));
    }

    // Use Supabase function for complex filtering
    const { data: recipients, error } = await supabase.rpc('resolve_message_recipients', {
      msg_event_id: eventId,
      target_guest_ids: filter.guestIds || undefined,
      target_tags: filter.tags || undefined,
      require_all_tags: filter.requireAllTags || false,
      target_rsvp_statuses: filter.rsvpStatuses || undefined,
      include_declined: filter.includeDeclined || false
    });

    if (error) throw error;

    // Convert to format expected by SMS sender
          const guestIds = recipients?.map((r: Record<string, unknown>) => r.guest_id as string) || [];
    
    if (guestIds.length === 0) {
      return [];
    }

    // Fetch phone numbers for resolved guests (exclude opted-out as defensive measure)
    const { data: guestsWithPhones, error: phoneError } = await supabase
      .from('event_guests')
      .select('id, phone, guest_name')
      .eq('event_id', eventId)
      .in('id', guestIds)
      .is('removed_at', null) // Use canonical scope - exclude removed guests
      .eq('sms_opt_out', false) // Exclude opted-out guests
      .not('phone', 'is', null)
      .neq('phone', '');

    if (phoneError) throw phoneError;
    return (guestsWithPhones || [])
      .filter(guest => guest.phone) // Filter out guests without phone numbers
      .map(guest => ({
        ...guest,
        phone: guest.phone as string, // Type assertion since we filtered out nulls
        guest_name: guest.guest_name || 'Guest'
      }));

  } catch (error) {
    logger.apiError('Error resolving scheduled message recipients', error);
    return [];
  }
}

// Also support GET for status checks
export async function GET() {
  try {
    logger.api('Scheduled messages status check');

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      stats: {
        pending: 0,
        processed: 0,
        failed: 0,
        message: 'Use useMessages hook for real-time message data'
      },
    });
  } catch (error) {
    logger.apiError('Error getting processing stats', error);
    
    return NextResponse.json(
      {
        error: 'Failed to get processing stats',
        timestamp: new Date().toISOString(),
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
} 