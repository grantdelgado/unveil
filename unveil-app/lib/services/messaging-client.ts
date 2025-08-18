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

// Note: SMS sending is now handled server-side via /api/messages/send
// This function is no longer used but kept for reference

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
      target_rsvp_statuses: filter.rsvpStatuses || undefined, // Will be deprecated post-cutover
      include_declined: filter.includeDeclined || false
    });

    if (error) throw error;

    const guestIds = recipients?.map((r: Record<string, unknown>) => r.guest_id as string) || [];
    return { guestIds, recipientCount: guestIds.length };
  } catch (error) {
    console.error('Error resolving message recipients:', error);
    throw error;
  }
}

/**
 * Enhanced send message service - now uses dedicated API route for server-side processing
 * This ensures proper RLS policy handling and delivery record creation
 * Supports both legacy filters and new explicit recipient selection
 */
export async function sendMessageToEvent(request: SendMessageRequest, retryCount = 0): Promise<{
  success: boolean;
  data?: {
    message: Record<string, unknown>;
    recipientCount: number;
    guestIds: string[];
    deliveryChannels: string[];
  };
  error?: Record<string, unknown>;
}> {
  const MAX_RETRIES = 1;
  
  try {
    // Basic client-side validation
    if (!request.content?.trim()) {
      throw new Error('Message content is required');
    }

    if (request.content.length > 1000) {
      throw new Error('Message content exceeds 1000 character limit');
    }

    if (!request.sendVia.push && !request.sendVia.sms && !request.sendVia.email) {
      throw new Error('At least one delivery method must be selected');
    }

    console.log(`Sending message via API route:`, {
      eventId: request.eventId,
      messageType: request.messageType,
      recipientFilter: request.recipientFilter,
      recipientEventGuestIds: request.recipientEventGuestIds,
      explicitSelection: !!request.recipientEventGuestIds,
      sendVia: request.sendVia
    });

    // Send request to server-side API route
    const response = await fetch('/api/messages/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const result = await response.json();

    if (!response.ok) {
      // Handle specific error cases with retry logic
      if (retryCount < MAX_RETRIES && (
        response.status >= 500 || // Server errors
        result.error?.includes('network') ||
        result.error?.includes('timeout')
      )) {
        console.log(`Retrying message send (attempt ${retryCount + 1})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return sendMessageToEvent(request, retryCount + 1);
      }
      
      const errorMsg = (result.error && typeof result.error === 'object' && 'message' in result.error) 
        ? (result.error as { message: string }).message 
        : `HTTP ${response.status}: Failed to send message`;
      throw new Error(errorMsg);
    }

    if (!result.success) {
      const errorMsg = (result.error && typeof result.error === 'object' && 'message' in result.error) 
        ? (result.error as { message: string }).message 
        : 'Failed to send message';
      throw new Error(errorMsg);
    }

    console.log(`Message sent successfully via API:`, {
      messageId: result.data.message.id,
      recipientCount: result.data.recipientCount,
      smsDelivered: result.data.smsDelivered,
      smsFailed: result.data.smsFailed
    });

    return result;

  } catch (error: unknown) {
    console.error('Error sending message:', {
      error: error instanceof Error ? error.message : String(error),
      eventId: request.eventId,
      recipientFilter: request.recipientFilter,
      retryCount
    });
    
    return { 
      success: false, 
      error: { message: error instanceof Error ? error.message : 'Failed to send message' } 
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
  data?: Record<string, unknown>;
  error?: Record<string, unknown>;
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
      case 'explicit_selection':
        // NEW: Use explicit guest selection
        targetGuestIds = recipientFilter.selectedGuestIds || [];
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
  } catch (error: unknown) {
    console.error('Error creating scheduled message:', error);
    return { 
      success: false, 
      error: { message: error instanceof Error ? error.message : 'Failed to create scheduled message' } 
    };
  }
}

/**
 * Cancel/delete a scheduled message
 */
export async function cancelScheduledMessage(messageId: string): Promise<{
  success: boolean;
  error?: Record<string, unknown>;
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
  } catch (error: unknown) {
    console.error('Error cancelling scheduled message:', error);
    return { 
      success: false, 
      error: { message: error instanceof Error ? error.message : 'Failed to cancel scheduled message' } 
    };
  }
}

/**
 * Delete a scheduled message permanently
 */
export async function deleteScheduledMessage(messageId: string): Promise<{
  success: boolean;
  error?: Record<string, unknown>;
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
  } catch (error: unknown) {
    console.error('Error deleting scheduled message:', error);
    return { 
      success: false, 
      error: { message: error instanceof Error ? error.message : 'Failed to delete scheduled message' } 
    };
  }
}
