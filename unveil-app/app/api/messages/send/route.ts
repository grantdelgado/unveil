import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { sendBulkSMS } from '@/lib/sms';
import { logger } from '@/lib/logger';
import type { SendMessageRequest } from '@/lib/types/messaging';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body: SendMessageRequest = await request.json();
    const { eventId, content, messageType, recipientFilter, sendVia } = body;

    // Validation
    if (!content?.trim()) {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      );
    }

    if (content.length > 1000) {
      return NextResponse.json(
        { error: 'Message content exceeds 1000 character limit' },
        { status: 400 }
      );
    }

    if (!sendVia.sms && !sendVia.push && !sendVia.email) {
      return NextResponse.json(
        { error: 'At least one delivery method must be selected' },
        { status: 400 }
      );
    }

    // Verify user is host of the event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('host_user_id')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    if (event.host_user_id !== user.id) {
      return NextResponse.json(
        { error: 'Only event hosts can send messages' },
        { status: 403 }
      );
    }

    // Resolve recipients based on filter
    let guestIds: string[] = [];
    
    if (recipientFilter.type === 'all') {
      const { data: guests, error: guestsError } = await supabase
        .from('event_guests')
        .select('id')
        .eq('event_id', eventId)
        .not('phone', 'is', null);
      
      if (guestsError) throw guestsError;
      guestIds = guests?.map(g => g.id) || [];
    } else if (recipientFilter.type === 'individual' && recipientFilter.guestIds) {
      guestIds = recipientFilter.guestIds;
    } else {
      // Use RPC function for complex filtering
      const { data: recipients, error: recipientsError } = await supabase.rpc('resolve_message_recipients', {
        msg_event_id: eventId,
        target_guest_ids: recipientFilter.guestIds || undefined,
        target_tags: recipientFilter.tags || undefined,
        require_all_tags: recipientFilter.requireAllTags || false,
        target_rsvp_statuses: recipientFilter.rsvpStatuses || undefined
      });

      if (recipientsError) throw recipientsError;
      guestIds = recipients?.map((r: any) => r.guest_id) || [];
    }

    if (guestIds.length === 0) {
      return NextResponse.json(
        { error: 'No valid recipients found for the specified filter criteria' },
        { status: 400 }
      );
    }

    // Create message record
    const { data: messageData, error: messageError } = await supabase
      .from('messages')
      .insert({
        event_id: eventId,
        content: content.trim(),
        message_type: messageType,
        sender_user_id: user.id,
      })
      .select()
      .single();

    if (messageError) {
      logger.apiError('Error creating message record', messageError);
      throw messageError;
    }

    logger.api(`Created message record: ${messageData.id}`);

    // Initialize delivery tracking variables
    let smsDelivered = 0;
    let smsFailed = 0;
    let deliveryRecords: any[] = [];

    // SMS Delivery
    if (sendVia.sms && guestIds.length > 0) {
      try {
        // Fetch guest phone numbers
        const { data: guestsWithPhones, error: phoneError } = await supabase
          .from('event_guests')
          .select('id, phone, guest_name')
          .in('id', guestIds)
          .not('phone', 'is', null)
          .neq('phone', '');

        if (phoneError) {
          logger.apiError('Error fetching guest phone numbers', phoneError);
        } else if (guestsWithPhones && guestsWithPhones.length > 0) {
          // Prepare SMS messages
          const smsMessages = guestsWithPhones.map(guest => ({
            to: guest.phone as string,
            message: content,
            eventId: eventId,
            guestId: guest.id,
            messageType: messageType === 'direct' ? 'custom' : messageType as 'announcement' | 'welcome' | 'custom' | 'rsvp_reminder'
          }));

          logger.api(`Sending SMS to ${smsMessages.length} guests`);

          // Send SMS messages
          const smsResult = await sendBulkSMS(smsMessages);
          smsDelivered = smsResult.sent;
          smsFailed = smsResult.failed;

          logger.api(`SMS delivery completed:`, {
            attempted: smsMessages.length,
            sent: smsDelivered,
            failed: smsFailed,
            messageId: messageData.id
          });

          // Create delivery records for all guests (regardless of SMS success)
          deliveryRecords = guestsWithPhones.map(guest => ({
            message_id: messageData.id,
            guest_id: guest.id,
            phone_number: guest.phone,
            sms_status: 'sent', // Will be updated by webhook
            push_status: 'not_applicable',
            email_status: 'not_applicable'
          }));
        }
      } catch (smsError: any) {
        logger.apiError('SMS delivery failed', smsError);
        smsFailed = guestIds.length;
      }
    }

    // Create delivery tracking records
    if (deliveryRecords.length > 0) {
      const { error: deliveryError } = await supabase
        .from('message_deliveries')
        .insert(deliveryRecords);

      if (deliveryError) {
        logger.apiError('Error creating delivery records', {
          error: deliveryError,
          messageId: messageData.id,
          recordCount: deliveryRecords.length
        });
        // Don't fail the request if delivery tracking fails
      } else {
        logger.api(`Created ${deliveryRecords.length} delivery tracking records`);
      }
    }

    // Log successful send for analytics
    logger.api(`Message delivery completed:`, {
      messageId: messageData.id,
      recipientCount: guestIds.length,
      deliveryChannels: Object.keys(sendVia).filter(key => sendVia[key as keyof typeof sendVia]),
      smsDelivered,
      smsFailed,
      messageType: messageType,
      eventId: eventId
    });

    return NextResponse.json({
      success: true,
      data: {
        message: messageData,
        recipientCount: guestIds.length,
        guestIds,
        deliveryChannels: Object.keys(sendVia).filter(key => sendVia[key as keyof typeof sendVia]),
        smsDelivered,
        smsFailed
      }
    });

  } catch (error: any) {
    logger.apiError('Error sending message', {
      error: error.message,
      stack: error.stack
    });
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to send message'
    }, { status: 500 });
  }
}
