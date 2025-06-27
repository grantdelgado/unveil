import { supabase } from '@/lib/supabase';
import type { Database } from '@/app/reference/supabase.types';
import { recordDeliveryStatus, recordMessageRead, recordMessageResponse } from './analytics';

type Message = Database['public']['Tables']['messages']['Row'];
type MessageDelivery = Database['public']['Tables']['message_deliveries']['Row'];
type ScheduledMessage = Database['public']['Tables']['scheduled_messages']['Row'];

export interface MessageFilter {
  eventId: string;
  guestId?: string;
  messageType?: Database['public']['Enums']['message_type_enum'];
  startDate?: Date;
  endDate?: Date;
  includeDeliveryInfo?: boolean;
}

export interface MessageWithDelivery extends Message {
  delivery?: MessageDelivery;
  scheduled_message?: Pick<ScheduledMessage, 'id' | 'send_at' | 'status'>;
}

/**
 * Get messages for an event with optional filtering
 */
export async function getEventMessages(filter: MessageFilter): Promise<MessageWithDelivery[]> {
  try {
    // Simplified query for now - get basic messages
    let query = supabase
      .from('messages')
      .select('*')
      .eq('event_id', filter.eventId)
      .order('created_at', { ascending: false });

    if (filter.guestId) {
      query = query.eq('sender_user_id', filter.guestId);
    }

    if (filter.messageType) {
      query = query.eq('message_type', filter.messageType);
    }

    if (filter.startDate) {
      query = query.gte('created_at', filter.startDate.toISOString());
    }

    if (filter.endDate) {
      query = query.lte('created_at', filter.endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) throw error;

    // Return messages with simplified structure
    return (data || []).map(message => ({
      ...message,
      delivery: undefined, // TODO: Add delivery info separately if needed
      scheduled_message: undefined, // TODO: Add scheduled message info separately if needed
    }));
  } catch (error) {
    console.error('Error getting event messages:', error);
    throw new Error('Failed to fetch event messages');
  }
}

/**
 * Get messages for a specific guest
 */
export async function getGuestMessages(
  eventId: string,
  guestId: string,
  includeSystemMessages = true
): Promise<MessageWithDelivery[]> {
  try {
    let query = supabase
      .from('messages')
      .select(`
        *,
        message_deliveries!inner (
          id,
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
      .order('created_at', { ascending: false });

    if (!includeSystemMessages) {
      // Filter out system-like messages by excluding direct messages between guests
      // Since we don't have a 'system' type, we'll keep all announcement and channel messages
      // and only filter direct messages if needed
      query = query.neq('message_type', 'direct');
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).map(message => ({
      ...message,
      delivery: Array.isArray(message.message_deliveries) 
        ? message.message_deliveries[0] 
        : message.message_deliveries,
    }));
  } catch (error) {
    console.error('Error getting guest messages:', error);
    throw new Error('Failed to fetch guest messages');
  }
}

/**
 * Send an immediate message to specified recipients
 */
export async function sendImmediateMessage(
  eventId: string,
  content: string,
  messageType: Database['public']['Enums']['message_type_enum'],
  recipientFilter: {
    type: 'all' | 'rsvp_status' | 'tags' | 'individual';
    rsvpStatuses?: Array<'attending' | 'not_attending' | 'pending'>;
    tags?: string[];
    tagMatch?: 'any' | 'all';
    guestIds?: string[];
  },
  hostId: string
): Promise<{ messageId: string; deliveryIds: string[] }> {
  try {
    // First, resolve the recipient list
    const recipients = await resolveRecipients(eventId, recipientFilter);
    
    if (recipients.length === 0) {
      throw new Error('No recipients match the specified criteria');
    }

    // Create the message
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        event_id: eventId,
        content,
        message_type: messageType,
        sender_user_id: hostId,
      })
      .select()
      .single();

    if (messageError) throw messageError;

    // Create delivery records for each recipient
    const deliveryInserts = recipients.map(guestId => ({
      message_id: message.id,
      guest_id: guestId,
      status: 'pending' as const,
    }));

    const { data: deliveries, error: deliveryError } = await supabase
      .from('message_deliveries')
      .insert(deliveryInserts)
      .select('id');

    if (deliveryError) throw deliveryError;

    // Here you would trigger actual delivery (SMS, push notification, etc.)
    // For now, we'll mark them as delivered immediately
    const deliveryIds = deliveries?.map(d => d.id) || [];
    
    // Update delivery status to delivered (in a real app, this would happen after actual delivery)
    await Promise.all(
      deliveryIds.map(deliveryId => 
        recordDeliveryStatus(deliveryId, 'sms', 'delivered')
      )
    );

    return {
      messageId: message.id,
      deliveryIds,
    };
  } catch (error) {
    console.error('Error sending immediate message:', error);
    throw new Error('Failed to send message');
  }
}

/**
 * Resolve recipients based on filter criteria
 */
export async function resolveRecipients(
  eventId: string,
  filter: {
    type: 'all' | 'rsvp_status' | 'tags' | 'individual';
    rsvpStatuses?: Array<'attending' | 'not_attending' | 'pending'>;
    tags?: string[];
    tagMatch?: 'any' | 'all';
    guestIds?: string[];
  }
): Promise<string[]> {
  try {
    let query = supabase
      .from('event_guests')
      .select('id')
      .eq('event_id', eventId);

    switch (filter.type) {
      case 'all':
        // No additional filtering needed
        break;

      case 'rsvp_status':
        if (filter.rsvpStatuses && filter.rsvpStatuses.length > 0) {
          query = query.in('rsvp_status', filter.rsvpStatuses);
        }
        break;

      case 'tags':
        if (filter.tags && filter.tags.length > 0) {
          if (filter.tagMatch === 'all') {
            // Guest must have all specified tags
            query = query.contains('guest_tags', filter.tags);
          } else {
            // Guest must have at least one of the specified tags
            query = query.overlaps('guest_tags', filter.tags);
          }
        }
        break;

      case 'individual':
        if (filter.guestIds && filter.guestIds.length > 0) {
          query = query.in('id', filter.guestIds);
        } else {
          return []; // No individual guests specified
        }
        break;

      default:
        throw new Error(`Unknown recipient filter type: ${filter.type}`);
    }

    const { data: guests, error } = await query;

    if (error) throw error;

    return guests?.map(guest => guest.id) || [];
  } catch (error) {
    console.error('Error resolving recipients:', error);
    throw new Error('Failed to resolve message recipients');
  }
}

/**
 * Mark a message as read by a guest
 */
export async function markMessageAsRead(
  messageId: string,
  guestId: string
): Promise<void> {
  try {
    // Find the delivery record for this message and guest
    const { data: delivery, error: findError } = await supabase
      .from('message_deliveries')
      .select('id')
      .eq('message_id', messageId)
      .eq('guest_id', guestId)
      .single();

    if (findError) throw findError;
    if (!delivery) throw new Error('Message delivery record not found');

    await recordMessageRead(delivery.id);
  } catch (error) {
    console.error('Error marking message as read:', error);
    throw new Error('Failed to mark message as read');
  }
}

/**
 * Record a guest response to a message
 */
export async function recordGuestResponse(
  messageId: string,
  guestId: string,
  responseContent?: string
): Promise<void> {
  try {
    // Find the delivery record for this message and guest
    const { data: delivery, error: findError } = await supabase
      .from('message_deliveries')
      .select('id')
      .eq('message_id', messageId)
      .eq('guest_id', guestId)
      .single();

    if (findError) throw findError;
    if (!delivery) throw new Error('Message delivery record not found');

    await recordMessageResponse(delivery.id);

    // If there's response content, you might want to store it
    // This would require a separate responses table or adding a response_content field
    if (responseContent) {
      // For now, we'll just log it
      console.log('Guest response content:', responseContent);
    }
  } catch (error) {
    console.error('Error recording guest response:', error);
    throw new Error('Failed to record guest response');
  }
}

/**
 * Get delivery statistics for a specific message
 */
export async function getMessageDeliveryStats(messageId: string): Promise<{
  totalRecipients: number;
  delivered: number;
  failed: number;
  read: number;
  responded: number;
}> {
  try {
    const { data: deliveries, error } = await supabase
      .from('message_deliveries')
      .select('sms_status, email_status, push_status, has_responded')
      .eq('message_id', messageId);

    if (error) throw error;

    const totalRecipients = deliveries?.length || 0;
    const delivered = deliveries?.filter(d => 
      d.sms_status === 'delivered' || d.email_status === 'delivered' || d.push_status === 'delivered'
    ).length || 0;
    const failed = deliveries?.filter(d => 
      d.sms_status === 'failed' && d.email_status === 'failed' && d.push_status === 'failed'
    ).length || 0;
    const read = delivered; // For now, assume all delivered messages are read
    const responded = deliveries?.filter(d => d.has_responded === true).length || 0;

    return {
      totalRecipients,
      delivered,
      failed,
      read,
      responded,
    };
  } catch (error) {
    console.error('Error getting message delivery stats:', error);
    throw new Error('Failed to fetch message delivery statistics');
  }
}

/**
 * Get recent messages for an event (useful for dashboard displays)
 */
export async function getRecentEventMessages(
  eventId: string,
  limit = 10
): Promise<MessageWithDelivery[]> {
  const messages = await getEventMessages({
    eventId,
    includeDeliveryInfo: true,
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
  });
  
  // Apply the limit to the results
  return messages.slice(0, limit);
}

/**
 * Get message thread between host and specific guest
 */
export async function getMessageThread(
  eventId: string,
  guestId: string,
  limit = 50
): Promise<MessageWithDelivery[]> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        message_deliveries!inner (
          id,
          status,
          delivered_at,
          read_at,
          responded_at,
          guest_id
        )
      `)
      .eq('event_id', eventId)
      .eq('message_deliveries.guest_id', guestId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw error;

    return (data || []).map(message => ({
      ...message,
      delivery: Array.isArray(message.message_deliveries) 
        ? message.message_deliveries[0] 
        : message.message_deliveries,
    }));
  } catch (error) {
    console.error('Error getting message thread:', error);
    throw new Error('Failed to fetch message thread');
  }
}

// Re-export analytics functions for convenience
export { 
  recordDeliveryStatus,
  recordMessageRead,
  recordMessageResponse,
  getDeliveryStatsForEvent,
  getEngagementMetrics,
  getRSVPCorrelation,
  getEventAnalytics,
} from './analytics';

// Re-export scheduled messaging functions
export {
  createScheduledMessage,
  getScheduledMessages,
  updateScheduledMessage,
  cancelScheduledMessage,
  deleteScheduledMessage,
  getReadyScheduledMessages,
  markScheduledMessageAsSending,
  markScheduledMessageAsSent,
  markScheduledMessageAsFailed,
} from './scheduled';

// Re-export tagging functions
export {
  getEventTags,
  getEventGuests,
  createTag,
  updateTag,
  deleteTag,
  assignTagsToGuests,
  removeTagsFromGuests,
  bulkTagOperation,
  getGuestsByTags,
} from './tags'; 