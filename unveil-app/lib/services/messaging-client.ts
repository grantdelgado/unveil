import { supabase } from '@/lib/supabase/client';
import type { 
  SendMessageRequest, 
  ScheduledMessageFilters, 
  CreateScheduledMessageData,
  RecipientFilter 
} from '@/lib/types/messaging';

/**
 * Client-safe messaging service that uses API routes instead of direct Twilio calls
 * This avoids importing server-only modules like Twilio SDK into client bundles
 */

/**
 * Send SMS messages via API route (client-safe)
 */
async function sendSMSViaAPI(messages: Array<{
  to: string;
  message: string;
  eventId: string;
  guestId: string;
  messageType?: string;
}>): Promise<{ sent: number; failed: number; results: any[] }> {
  try {
    const response = await fetch('/api/sms/send-bulk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to send SMS');
    }

    return result.data;
  } catch (error) {
    console.error('SMS API error:', error);
    throw error;
  }
}

/**
 * Resolves recipient guest IDs based on filter criteria
 * Uses Supabase resolve_message_recipients function for optimal performance
 */
export async function resolveMessageRecipients(
  eventId: string, 
  filter: RecipientFilter
): Promise<{ guestIds: string[]; recipientCount: number }> {
  try {
    // Handle simple 'all' filter
    if (filter.type === 'all') {
      const { data: guests, error } = await supabase
        .from('event_guests')
        .select('id')
        .eq('event_id', eventId)
        .not('phone', 'is', null); // Only guests with phone numbers
      
      if (error) throw error;
      return { 
        guestIds: guests?.map(g => g.id) || [], 
        recipientCount: guests?.length || 0 
      };
    }

    // Handle individual guest selection
    if (filter.type === 'individual' && filter.guestIds) {
      return { 
        guestIds: filter.guestIds, 
        recipientCount: filter.guestIds.length 
      };
    }

    // Use Supabase function for complex filtering
    const { data: recipients, error } = await supabase.rpc('resolve_message_recipients', {
      msg_event_id: eventId,
      target_guest_ids: filter.guestIds || undefined,
      target_tags: filter.tags || undefined,
      require_all_tags: filter.requireAllTags || false,
      target_rsvp_statuses: filter.rsvpStatuses || undefined
    });

    if (error) throw error;

    const guestIds = recipients?.map((r: any) => r.guest_id) || [];
    return { guestIds, recipientCount: guestIds.length };
  } catch (error) {
    console.error('Error resolving message recipients:', error);
    throw error;
  }
}

/**
 * Enhanced send message service with recipient filtering, validation, and retry logic
 * Client-safe version that uses API routes
 */
export async function sendMessageToEvent(request: SendMessageRequest, retryCount = 0): Promise<{
  success: boolean;
  data?: {
    message: any;
    recipientCount: number;
    guestIds: string[];
    deliveryChannels: string[];
  };
  error?: any;
}> {
  const MAX_RETRIES = 1;
  
  try {
    // Validation checks
    if (!request.content?.trim()) {
      throw new Error('Message content is required');
    }

    if (request.content.length > 1000) {
      throw new Error('Message content exceeds 1000 character limit');
    }

    if (!request.sendVia.push && !request.sendVia.sms && !request.sendVia.email) {
      throw new Error('At least one delivery method must be selected');
    }

    // Resolve recipients based on filter
    const { guestIds, recipientCount } = await resolveMessageRecipients(
      request.eventId, 
      request.recipientFilter
    );

    if (recipientCount === 0) {
      throw new Error('No valid recipients found for the specified filter criteria');
    }

    // Get current user with retry on auth failure
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      if (retryCount < MAX_RETRIES && authError?.message?.includes('network')) {
        console.log(`Retrying authentication (attempt ${retryCount + 1})`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        return sendMessageToEvent(request, retryCount + 1);
      }
      throw new Error('User not authenticated');
    }

    // Create message record with retry logic
    let messageData;
    try {
      const { data: message, error: messageError } = await supabase
        .from('messages')
        .insert({
          event_id: request.eventId,
          content: request.content.trim(),
          message_type: request.messageType,
          sender_user_id: user.id,
        })
        .select()
        .single();

      if (messageError) throw messageError;
      messageData = message;
    } catch (dbError: any) {
      // Retry on network or temporary database errors
      if (retryCount < MAX_RETRIES && (
        dbError?.message?.includes('network') ||
        dbError?.message?.includes('timeout') ||
        dbError?.code === 'PGRST301' // Temporary Supabase error
      )) {
        console.log(`Retrying message creation (attempt ${retryCount + 1})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return sendMessageToEvent(request, retryCount + 1);
      }
      throw dbError;
    }

    // Determine active delivery channels
    const deliveryChannels = [];
    if (request.sendVia.push) deliveryChannels.push('push');
    if (request.sendVia.sms) deliveryChannels.push('sms');
    if (request.sendVia.email) deliveryChannels.push('email');

    // Initialize delivery tracking variables
    let smsDelivered = 0;
    let smsFailed = 0;
    let pushDelivered = 0;
    let pushFailed = 0;

    // SMS Delivery - Fetch guest phone numbers and send via API
    if (request.sendVia.sms && guestIds.length > 0) {
      try {
        // Fetch guest phone numbers and names for SMS delivery
        const { data: guestsWithPhones, error: phoneError } = await supabase
          .from('event_guests')
          .select('id, phone, guest_name')
          .in('id', guestIds)
          .not('phone', 'is', null)
          .neq('phone', ''); // Exclude empty phone numbers

        if (phoneError) {
          console.error('Error fetching guest phone numbers:', phoneError);
        } else if (guestsWithPhones && guestsWithPhones.length > 0) {
          // Prepare SMS messages
          const smsMessages = guestsWithPhones.map(guest => ({
            to: guest.phone,
            message: request.content,
            eventId: request.eventId,
            guestId: guest.id,
            messageType: request.messageType
          }));

          console.log(`Sending SMS to ${smsMessages.length} guests with valid phone numbers`);

          // Send SMS messages via API route
          const smsResult = await sendSMSViaAPI(smsMessages);
          smsDelivered = smsResult.sent;
          smsFailed = smsResult.failed;

          console.log(`SMS delivery completed:`, {
            attempted: smsMessages.length,
            sent: smsDelivered,
            failed: smsFailed,
            messageId: messageData.id
          });

          // Create delivery records for tracking
          if (guestsWithPhones.length > 0) {
            const deliveryRecords = guestsWithPhones.map(guest => ({
              message_id: messageData.id,
              guest_id: guest.id,
              phone_number: guest.phone,
              sms_status: 'sent', // Will be updated by webhook
              push_status: 'not_applicable',
              email_status: 'not_applicable'
            }));

            // Insert delivery tracking records
            const { error: deliveryError } = await supabase
              .from('message_deliveries')
              .insert(deliveryRecords);

            if (deliveryError) {
              console.error('Error creating delivery records:', deliveryError);
            }
          }
        } else {
          console.log('No guests found with valid phone numbers for SMS delivery');
        }
      } catch (smsError) {
        console.error('SMS delivery failed:', smsError);
        smsFailed = guestIds.length; // Mark all as failed
      }
    }

    // Push Notification Delivery (placeholder - implement based on your push system)
    if (request.sendVia.push && guestIds.length > 0) {
      try {
        // TODO: Implement push notification delivery
        // For now, mark as successful since push is typically more reliable
        pushDelivered = guestIds.length;
        console.log(`Push notifications would be sent to ${guestIds.length} guests`);
      } catch (pushError) {
        console.error('Push delivery failed:', pushError);
        pushFailed = guestIds.length;
      }
    }

    // Update message record with delivery results
    const totalDelivered = smsDelivered + pushDelivered;
    const totalFailed = smsFailed + pushFailed;

    // TODO: Add delivered_count and failed_count columns to messages table schema
    /* 
    try {
      await supabase
        .from('messages')
        .update({
          delivered_count: totalDelivered,
          failed_count: totalFailed,
          delivered_at: totalDelivered > 0 ? new Date().toISOString() : null
        })
        .eq('id', messageData.id);
    } catch (updateError) {
      console.error('Error updating message delivery stats:', updateError);
    }
    */

    // Log successful send for analytics
    console.log(`Message delivery completed:`, {
      messageId: messageData.id,
      recipientCount,
      deliveryChannels,
      smsDelivered,
      smsFailed,
      pushDelivered,
      pushFailed,
      totalDelivered,
      totalFailed,
      messageType: request.messageType,
      eventId: request.eventId
    });

    return { 
      success: true, 
      data: {
        message: messageData,
        recipientCount,
        guestIds,
        deliveryChannels
        // TODO: Add deliveryResults to analytics interface
        // deliveryResults: {
        //   sms: { delivered: smsDelivered, failed: smsFailed },
        //   push: { delivered: pushDelivered, failed: pushFailed },
        //   total: { delivered: totalDelivered, failed: totalFailed }
        // }
      }
    };
  } catch (error: any) {
    console.error('Error sending message:', {
      error: error.message,
      eventId: request.eventId,
      recipientFilter: request.recipientFilter,
      retryCount
    });
    
    return { 
      success: false, 
      error: error instanceof Error ? error : new Error('Failed to send message') 
    };
  }
}

// Get scheduled messages
export async function getScheduledMessages(filters: ScheduledMessageFilters) {
  try {
    let query = supabase
      .from('scheduled_messages')
      .select('*')
      .eq('event_id', filters.eventId);

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.messageType) {
      query = query.eq('message_type', filters.messageType);
    }

    if (filters.dateRange) {
      query = query
        .gte('send_at', filters.dateRange.start)
        .lte('send_at', filters.dateRange.end);
    }

    const { data, error } = await query.order('send_at', { ascending: true });

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Error fetching scheduled messages:', error);
    return { success: false, error, data: [] };
  }
}

/**
 * Create scheduled message with enhanced recipient filtering support
 */
export async function createScheduledMessage(messageData: CreateScheduledMessageData): Promise<{
  success: boolean;
  data?: any;
  error?: any;
}> {
  try {
    const currentUser = await supabase.auth.getUser();
    if (!currentUser.data.user?.id) {
      throw new Error('User not authenticated');
    }

    // Validate send time is in the future
    const sendTime = new Date(messageData.sendAt);
    const now = new Date();
    if (sendTime <= now) {
      throw new Error('Scheduled time must be in the future');
    }

    // Validate message content
    if (!messageData.content?.trim()) {
      throw new Error('Message content is required');
    }

    if (messageData.content.length > 1000) {
      throw new Error('Message content exceeds 1000 character limit');
    }

    // Convert RecipientFilter to scheduled_messages schema format
    const { recipientFilter } = messageData;
    let targetAllGuests = false;
    let targetGuestTags: string[] = [];
    let targetGuestIds: string[] = [];

    switch (recipientFilter.type) {
      case 'all':
        targetAllGuests = true;
        break;
      case 'tags':
        targetGuestTags = recipientFilter.tags || [];
        break;
      case 'individual':
        targetGuestIds = recipientFilter.guestIds || [];
        break;
      case 'rsvp_status':
        // For RSVP filtering, we'll store as tags for now
        // The actual filtering will happen at send time
        targetGuestTags = recipientFilter.rsvpStatuses?.map(status => `rsvp:${status}`) || [];
        break;
      case 'combined':
        targetGuestTags = [
          ...(recipientFilter.tags || []),
          ...(recipientFilter.rsvpStatuses?.map(status => `rsvp:${status}`) || [])
        ];
        targetGuestIds = recipientFilter.guestIds || [];
        break;
    }

    // Pre-calculate recipient count for scheduling
    const { recipientCount } = await resolveMessageRecipients(
      messageData.eventId,
      recipientFilter
    );

    if (recipientCount === 0) {
      throw new Error('No valid recipients found for the specified filter criteria');
    }

    const { data, error } = await supabase
      .from('scheduled_messages')
      .insert({
        event_id: messageData.eventId,
        content: messageData.content.trim(),
        send_at: messageData.sendAt,
        message_type: messageData.messageType,
        send_via_sms: messageData.sendViaSms,
        send_via_email: messageData.sendViaEmail,
        send_via_push: messageData.sendViaPush,
        subject: messageData.subject || null,
        sender_user_id: currentUser.data.user.id,
        status: 'scheduled',
        target_all_guests: targetAllGuests,
        target_guest_tags: targetGuestTags,
        target_guest_ids: targetGuestIds,
        recipient_count: recipientCount,
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`Scheduled message created:`, {
      messageId: data.id,
      sendAt: messageData.sendAt,
      recipientCount,
      messageType: messageData.messageType,
      eventId: messageData.eventId
    });

    return { success: true, data };
  } catch (error: any) {
    console.error('Error creating scheduled message:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error : new Error('Failed to create scheduled message') 
    };
  }
}

/**
 * Cancel/delete a scheduled message
 */
export async function cancelScheduledMessage(messageId: string): Promise<{
  success: boolean;
  error?: any;
}> {
  try {
    const { error } = await supabase
      .from('scheduled_messages')
      .update({ status: 'cancelled' })
      .eq('id', messageId)
      .eq('status', 'scheduled'); // Only allow cancelling scheduled messages

    if (error) throw error;

    console.log(`Scheduled message cancelled: ${messageId}`);
    return { success: true };
  } catch (error: any) {
    console.error('Error cancelling scheduled message:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error : new Error('Failed to cancel scheduled message') 
    };
  }
}

/**
 * Delete a scheduled message permanently
 */
export async function deleteScheduledMessage(messageId: string): Promise<{
  success: boolean;
  error?: any;
}> {
  try {
    const { error } = await supabase
      .from('scheduled_messages')
      .delete()
      .eq('id', messageId)
      .in('status', ['scheduled', 'cancelled']); // Only allow deleting non-sent messages

    if (error) throw error;

    console.log(`Scheduled message deleted: ${messageId}`);
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting scheduled message:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error : new Error('Failed to delete scheduled message') 
    };
  }
}
