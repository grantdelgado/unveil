import { supabase } from '@/lib/supabase';
import type { Database } from '@/app/reference/supabase.types';
import type { MessageWithDelivery } from '@/lib/supabase/types';
import { recordDeliveryStatus } from './analytics';

// Types
type Message = Database['public']['Tables']['messages']['Row'];
type MessageDelivery = Database['public']['Tables']['message_deliveries']['Row'];

// Using shared MessageWithDelivery interface from types.ts

export interface SendGuestResponseParams {
  guestId: string;
  messageId: string;
  content: string;
  eventId: string;
}

export interface GuestResponseValidation {
  isValid: boolean;
  error?: string;
}

/**
 * Validate guest response content
 */
export function validateGuestResponse(content: string): GuestResponseValidation {
  const trimmedContent = content.trim();
  
  if (!trimmedContent) {
    return { isValid: false, error: 'Response cannot be empty' };
  }
  
  if (trimmedContent.length > 500) {
    return { isValid: false, error: 'Response too long (maximum 500 characters)' };
  }
  
  if (trimmedContent.length < 2) {
    return { isValid: false, error: 'Response too short (minimum 2 characters)' };
  }
  
  // Check for spam patterns
  const spamPatterns = [
    /(.)\1{10,}/i, // Repeated characters (11+ in a row)
    /[A-Z]{30,}/, // Too many caps
    /\b(?:https?:\/\/[^\s]+){3,}/gi, // Multiple URLs (3+)
    /(.{1,3})\1{5,}/gi, // Repeated patterns
  ];
  
  for (const pattern of spamPatterns) {
    if (pattern.test(trimmedContent)) {
      return { isValid: false, error: 'Message appears to be spam or contains inappropriate content' };
    }
  }
  
  return { isValid: true };
}

/**
 * Send a guest response to a host message
 */
export async function sendGuestResponse({
  guestId,
  messageId,
  content,
  eventId,
}: SendGuestResponseParams): Promise<{ messageId: string; success: boolean }> {
  try {
    // Validate input
    const validation = validateGuestResponse(content);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    // Verify guest has access to the original message and is part of the event
    const { data: originalMessage, error: messageError } = await supabase
      .from('messages')
      .select(`
        id,
        event_id,
        sender_user_id,
        message_deliveries!inner (
          guest_id
        )
      `)
      .eq('id', messageId)
      .eq('event_id', eventId)
      .eq('message_deliveries.guest_id', guestId)
      .single();

    if (messageError || !originalMessage) {
      throw new Error('Message not found or access denied');
    }

    // Verify guest is part of the event
    const { data: guestAccess, error: guestError } = await supabase
      .from('event_guests')
      .select('id')
      .eq('id', guestId)
      .eq('event_id', eventId)
      .single();

    if (guestError || !guestAccess) {
      throw new Error('Guest access to event not found');
    }

    // Create the guest response message
    const { data: responseMessage, error: responseError } = await supabase
      .from('messages')
      .insert({
        event_id: eventId,
        content: content.trim(),
        message_type: 'direct' as const,
        sender_user_id: null, // Guest responses don't have a user_id since guests might not be users
        // Note: We could add a guest_id field in the future for better tracking
      })
      .select()
      .single();

    if (responseError) {
      console.error('Error creating guest response:', responseError);
      throw new Error('Failed to send response');
    }

    // Get the host user ID from the original message or event
    let hostUserId: string | null = originalMessage.sender_user_id;
    
    // If the original message doesn't have a sender (shouldn't happen), get event host
    if (!hostUserId) {
      const { data: eventData } = await supabase
        .from('events')
        .select('host_user_id')
        .eq('id', eventId)
        .single();
      
      hostUserId = eventData?.host_user_id || null;
    }

    // Create delivery record for the host (if we have a host user ID)
    if (hostUserId) {
      // Find or create a guest record for the host (this is a bit complex, but needed for delivery tracking)
      const { data: hostGuest, error: hostGuestError } = await supabase
        .from('event_guests')
        .select('id')
        .eq('event_id', eventId)
        .eq('user_id', hostUserId)
        .single();

      if (!hostGuestError && hostGuest) {
        const { error: deliveryError } = await supabase
          .from('message_deliveries')
          .insert({
            message_id: responseMessage.id,
            guest_id: hostGuest.id,
            status: 'pending',
          });

        if (deliveryError) {
          console.warn('Failed to create delivery record for host:', deliveryError);
          // Don't fail the whole operation for this
        }
      }
    }

    return {
      messageId: responseMessage.id,
      success: true,
    };
  } catch (error) {
    console.error('Error sending guest response:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to send response');
  }
}

/**
 * Mark messages as read for a guest (placeholder until read_at column is added)
 * FUTURE: Update to use read_at column in Phase 6 read receipts
 */
export async function markMessagesAsRead(
  guestId: string,
  messageIds?: string[]
): Promise<{ success: boolean; markedCount: number }> {
  try {
    let query = supabase
      .from('message_deliveries')
      .select('id')
      .eq('guest_id', guestId);

    if (messageIds && messageIds.length > 0) {
      query = query.in('message_id', messageIds);
    }

    const { data: deliveries, error: selectError } = await query;

    if (selectError) {
      console.error('Error selecting deliveries to mark as read:', selectError);
      throw new Error(`Failed to select deliveries: ${selectError.message}`);
    }

    if (!deliveries || deliveries.length === 0) {
      return { success: true, markedCount: 0 };
    }

    // FUTURE: Update to set read_at column in Phase 6 schema
    // For now, we'll just update the timestamp as a placeholder
    const deliveryIds = deliveries.map(d => d.id);
    const timestamp = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('message_deliveries')
      .update({
        updated_at: timestamp,
      })
      .in('id', deliveryIds);

    if (updateError) {
      console.error('Error updating read status:', updateError);
      throw new Error(`Failed to mark messages as read: ${updateError.message}`);
    }

    return {
      success: true,
      markedCount: deliveries.length,
    };
  } catch (error) {
    console.error('Error marking messages as read:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to mark messages as read';
    throw new Error(errorMessage);
  }
}

/**
 * Get messages for a guest with proper filtering
 * This is the main function for guest message retrieval
 */
export async function getGuestMessages(
  params: {
    guestId: string;
    eventId: string;
    limit?: number;
    includeResponses?: boolean;
    markAsRead?: boolean;
  }
): Promise<MessageWithDelivery[]> {
  const { guestId, eventId, limit = 50, includeResponses = true, markAsRead = false } = params;
  
  try {
    // Get messages delivered to this guest using proper filtering
    const { data: deliveredMessages, error } = await supabase
      .from('messages')
      .select(`
        *,
        message_deliveries!inner (
          id,
          guest_id,
          status,
          delivered_at,
          sms_status,
          email_status,
          push_status,
          has_responded,
          created_at,
          updated_at
        )
      `)
      .eq('event_id', eventId)
      .eq('message_deliveries.guest_id', guestId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Error fetching delivered messages:', error);
      throw new Error(`Failed to fetch delivered messages: ${error.message}`);
    }

    // Convert to MessageWithDelivery format
    let allMessages: MessageWithDelivery[] = (deliveredMessages || []).map((message: any) => ({
      ...message,
      delivery: Array.isArray(message.message_deliveries) 
        ? message.message_deliveries[0] 
        : message.message_deliveries,
      message_deliveries: undefined, // Remove nested data
    }));

    // Include guest's own responses if requested
    if (includeResponses) {
      const { data: guestResponses, error: responseError } = await supabase
        .from('messages')
        .select('*')
        .eq('event_id', eventId)
        .eq('message_type', 'direct')
        .is('sender_user_id', null) // Guest responses don't have sender_user_id
        .order('created_at', { ascending: true });

      if (responseError) {
        console.warn('Error fetching guest responses, continuing without them:', responseError);
      } else if (guestResponses) {
        // Convert guest responses to MessageWithDelivery format
        const responseMessages: MessageWithDelivery[] = guestResponses.map(response => ({
          ...response,
          delivery: undefined, // Guest responses don't have delivery records
          scheduled_message: undefined,
        }));
        
        // Merge and sort all messages
        allMessages = [...allMessages, ...responseMessages]
          .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
          .slice(0, limit); // Apply limit after merging
      }
    }

    // Remove duplicates by message ID
    const uniqueMessages = allMessages.filter((message, index, self) =>
      index === self.findIndex(m => m.id === message.id)
    );

    // Optionally mark messages as read
    if (markAsRead && uniqueMessages.length > 0) {
      try {
        const messageIds = uniqueMessages
          .filter(m => m.delivery) // Only mark messages with delivery records
          .map(m => m.id);
        
        if (messageIds.length > 0) {
          await markMessagesAsRead(guestId, messageIds);
        }
      } catch (markError) {
        console.warn('Error marking messages as read:', markError);
        // Don't fail the whole operation for this
      }
    }

    return uniqueMessages;
  } catch (error) {
    console.error('Error getting guest messages:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get guest messages';
    throw new Error(errorMessage);
  }
}

/**
 * Get messages for a guest with proper filtering (legacy name - kept for backward compatibility)
 */
export async function getGuestMessageThread(
  eventId: string,
  guestId: string,
  options: {
    limit?: number;
    includeResponses?: boolean;
    markAsRead?: boolean;
  } = {}
): Promise<Message[]> {
  try {
    const { limit = 50, includeResponses = true, markAsRead = false } = options;

    // Get messages delivered to this guest
    const { data: messages, error } = await supabase
      .from('messages')
      .select(`
        *,
        message_deliveries!inner (
          id,
          guest_id,
          delivered_at,
          read_at
        )
      `)
      .eq('event_id', eventId)
      .eq('message_deliveries.guest_id', guestId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      throw error;
    }

    let filteredMessages = messages || [];

    // Optionally include guest's own responses
    if (includeResponses) {
      // Note: This would need additional logic to identify guest responses
      // For now, we'll just return the delivered messages
    }

    // Optionally mark messages as read
    if (markAsRead && filteredMessages.length > 0) {
      const messageIds = filteredMessages.map(m => m.id);
      await markMessagesAsRead(guestId, messageIds);
    }

    // Transform the data to match expected format
    return filteredMessages.map(message => ({
      ...message,
      // Remove the nested delivery data from the main object
      message_deliveries: undefined,
    }));
  } catch (error) {
    console.error('Error getting guest messages:', error);
    throw new Error('Failed to get guest messages');
  }
}

/**
 * Get the latest host message for threading logic
 */
export async function getLatestHostMessage(
  eventId: string,
  guestId?: string
): Promise<Message | null> {
  try {
    if (guestId) {
      // Get the latest message delivered to this specific guest
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          message_deliveries!inner (
            guest_id
          )
        `)
        .eq('event_id', eventId)
        .eq('message_deliveries.guest_id', guestId)
        .not('sender_user_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (!data || data.length === 0) {
        return null;
      }

      const message = data[0];
      return {
        ...message,
        message_deliveries: undefined,
      } as Message;
    } else {
      // Get the latest host message for the event (no guest filtering)
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('event_id', eventId)
        .not('sender_user_id', 'is', null) // Only messages from actual users (hosts)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (!data || data.length === 0) {
        return null;
      }

      return data[0] as Message;
    }
  } catch (error) {
    console.error('Error getting latest host message:', error);
    throw new Error('Failed to get latest host message');
  }
}

/**
 * Check if guest can respond to messages for an event
 * (Stub implementation - would connect to event settings in the future)
 */
export async function canGuestRespond(
  eventId: string,
  guestId: string
): Promise<{ canRespond: boolean; reason?: string }> {
  try {
    // Verify guest is part of the event
    const { data: guestAccess, error: guestError } = await supabase
      .from('event_guests')
      .select('id, rsvp_status')
      .eq('id', guestId)
      .eq('event_id', eventId)
      .single();

    if (guestError || !guestAccess) {
      return {
        canRespond: false,
        reason: 'Guest access not found'
      };
    }

    // For now, allow all guests to respond
    // In the future, this would check event_settings.allow_guest_replies
    return {
      canRespond: true
    };
  } catch (error) {
    console.error('Error checking guest response permissions:', error);
    return {
      canRespond: false,
      reason: 'Permission check failed'
    };
  }
} 