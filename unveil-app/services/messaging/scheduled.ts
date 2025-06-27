import { supabase } from '@/lib/supabase';
import type { Tables, TablesInsert, TablesUpdate, Database } from '@/app/reference/supabase.types';

type ScheduledMessage = Tables<'scheduled_messages'>;
type ScheduledMessageInsert = TablesInsert<'scheduled_messages'>;
type ScheduledMessageUpdate = TablesUpdate<'scheduled_messages'>;
type MessageType = Database['public']['Enums']['message_type_enum'];

export interface AdvancedTargeting {
  rsvpStatuses?: string[];
  tags?: string[];
  requireAllTags?: boolean;
  explicitGuestIds?: string[];
}

export interface CreateScheduledMessageData {
  eventId: string;
  content: string;
  subject?: string;
  messageType?: MessageType;
  sendAt: Date;
  targetAllGuests?: boolean;
  targetGuestIds?: string[];
  targetGuestTags?: string[];
  targetSubEventIds?: string[];
  requireAllTags?: boolean;
  rsvpStatusFilter?: string[];
  sendViaSms?: boolean;
  sendViaPush?: boolean;
  sendViaEmail?: boolean;
  // Support for advanced targeting
  advancedTargeting?: AdvancedTargeting;
}

export interface ScheduledMessageFilters {
  eventId?: string;
  status?: string[];
  messageType?: MessageType[];
  sendAfter?: Date;
  sendBefore?: Date;
}

/**
 * Calculate recipient count based on advanced targeting criteria
 */
async function calculateRecipientCount(
  eventId: string,
  targeting: AdvancedTargeting,
  targetAllGuests?: boolean
): Promise<number> {
  if (targetAllGuests && !targeting.rsvpStatuses?.length && !targeting.tags?.length) {
    // Simple count of all guests
    const { count } = await supabase
      .from('event_guests')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .not('phone', 'is', null);
    return count || 0;
  }

  // Build query with filters
  let query = supabase
    .from('event_guests')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .not('phone', 'is', null);

  // Apply explicit guest ID filter
  if (targeting.explicitGuestIds?.length) {
    query = query.in('id', targeting.explicitGuestIds);
  } else {
    // Apply tag filters
    if (targeting.tags?.length) {
      if (targeting.requireAllTags) {
        query = query.contains('guest_tags', targeting.tags);
      } else {
        query = query.overlaps('guest_tags', targeting.tags);
      }
    }

    // Apply RSVP status filters
    if (targeting.rsvpStatuses?.length) {
      query = query.in('rsvp_status', targeting.rsvpStatuses);
    }
  }

  const { count, error } = await query;

  if (error) {
    console.error('Error calculating recipient count:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Create a new scheduled message
 */
export async function createScheduledMessage(data: CreateScheduledMessageData): Promise<ScheduledMessage> {
  // Using imported supabase client
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Authentication required');
  }

  // Calculate recipient count using advanced targeting
  const recipientCount = await calculateRecipientCount(
    data.eventId,
    data.advancedTargeting || {
      rsvpStatuses: data.rsvpStatusFilter,
      tags: data.targetGuestTags,
      requireAllTags: data.requireAllTags || false,
      explicitGuestIds: data.targetGuestIds
    },
    data.targetAllGuests
  );

  const scheduledMessageData: ScheduledMessageInsert = {
    event_id: data.eventId,
    sender_user_id: user.id,
    content: data.content,
    subject: data.subject,
    message_type: data.messageType || 'announcement',
    send_at: data.sendAt.toISOString(),
    target_all_guests: data.targetAllGuests || false,
    target_guest_ids: data.targetGuestIds || null,
    target_guest_tags: data.targetGuestTags || null,
    target_sub_event_ids: data.targetSubEventIds || null,
    send_via_sms: data.sendViaSms ?? true,
    send_via_push: data.sendViaPush ?? true,
    send_via_email: data.sendViaEmail ?? false,
    recipient_count: recipientCount,
    status: 'scheduled'
  };

  const { data: scheduledMessage, error } = await supabase
    .from('scheduled_messages')
    .insert(scheduledMessageData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create scheduled message: ${error.message}`);
  }

  return scheduledMessage;
}

/**
 * Get scheduled messages with optional filtering
 */
export async function getScheduledMessages(filters: ScheduledMessageFilters = {}): Promise<ScheduledMessage[]> {
  // Using imported supabase client
  
  let query = supabase
    .from('scheduled_messages')
    .select('*')
    .order('send_at', { ascending: true });

  if (filters.eventId) {
    query = query.eq('event_id', filters.eventId);
  }

  if (filters.status?.length) {
    query = query.in('status', filters.status);
  }

  if (filters.messageType?.length) {
    query = query.in('message_type', filters.messageType);
  }

  if (filters.sendAfter) {
    query = query.gte('send_at', filters.sendAfter.toISOString());
  }

  if (filters.sendBefore) {
    query = query.lte('send_at', filters.sendBefore.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch scheduled messages: ${error.message}`);
  }

  return data || [];
}

/**
 * Update a scheduled message
 */
export async function updateScheduledMessage(
  id: string, 
  updates: Partial<CreateScheduledMessageData>
): Promise<ScheduledMessage> {
  // Using imported supabase client

  const updateData: ScheduledMessageUpdate = {};

  if (updates.content !== undefined) {
    updateData.content = updates.content;
  }

  if (updates.subject !== undefined) {
    updateData.subject = updates.subject;
  }

  if (updates.messageType !== undefined) {
    updateData.message_type = updates.messageType;
  }

  if (updates.sendAt !== undefined) {
    updateData.send_at = updates.sendAt.toISOString();
  }

  if (updates.targetAllGuests !== undefined) {
    updateData.target_all_guests = updates.targetAllGuests;
  }

  if (updates.targetGuestIds !== undefined) {
    updateData.target_guest_ids = updates.targetGuestIds;
  }

  if (updates.targetGuestTags !== undefined) {
    updateData.target_guest_tags = updates.targetGuestTags;
  }

  if (updates.targetSubEventIds !== undefined) {
    updateData.target_sub_event_ids = updates.targetSubEventIds;
  }

  if (updates.sendViaSms !== undefined) {
    updateData.send_via_sms = updates.sendViaSms;
  }

  if (updates.sendViaPush !== undefined) {
    updateData.send_via_push = updates.sendViaPush;
  }

  if (updates.sendViaEmail !== undefined) {
    updateData.send_via_email = updates.sendViaEmail;
  }

  // Recalculate recipient count if targeting changed
  if (updates.targetAllGuests !== undefined || 
      updates.targetGuestIds !== undefined || 
      updates.targetGuestTags !== undefined) {
    
    const { data: existingMessage } = await supabase
      .from('scheduled_messages')
      .select('event_id')
      .eq('id', id)
      .single();

    if (existingMessage) {
      let recipientCount = 0;
      if (updates.targetAllGuests || (updates.targetAllGuests === undefined && !updates.targetGuestIds && !updates.targetGuestTags)) {
        const { count } = await supabase
          .from('event_guests')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', existingMessage.event_id);
        recipientCount = count || 0;
      } else {
        let query = supabase
          .from('event_guests')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', existingMessage.event_id);

        if (updates.targetGuestIds?.length) {
          query = query.in('id', updates.targetGuestIds);
        }

        if (updates.targetGuestTags?.length) {
          query = query.overlaps('guest_tags', updates.targetGuestTags);
        }

        const { count } = await query;
        recipientCount = count || 0;
      }

      updateData.recipient_count = recipientCount;
    }
  }

  const { data, error } = await supabase
    .from('scheduled_messages')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update scheduled message: ${error.message}`);
  }

  return data;
}

/**
 * Cancel a scheduled message
 */
export async function cancelScheduledMessage(id: string): Promise<ScheduledMessage> {
  // Using imported supabase client

  const { data, error } = await supabase
    .from('scheduled_messages')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('status', 'scheduled') // Only allow cancelling scheduled messages
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to cancel scheduled message: ${error.message}`);
  }

  return data;
}

/**
 * Delete a scheduled message (for cancelled/failed messages)
 */
export async function deleteScheduledMessage(id: string): Promise<void> {
  // Using imported supabase client

  const { error } = await supabase
    .from('scheduled_messages')
    .delete()
    .eq('id', id)
    .in('status', ['cancelled', 'failed']); // Only allow deleting cancelled or failed messages

  if (error) {
    throw new Error(`Failed to delete scheduled message: ${error.message}`);
  }
}

/**
 * Get scheduled messages ready for processing (for CRON job)
 */
export async function getReadyScheduledMessages(): Promise<ScheduledMessage[]> {
  // Using imported supabase client

  const { data, error } = await supabase
    .from('scheduled_messages')
    .select('*')
    .eq('status', 'scheduled')
    .lte('send_at', new Date().toISOString())
    .order('send_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch ready scheduled messages: ${error.message}`);
  }

  return data || [];
}

/**
 * Mark scheduled message as sending
 */
export async function markScheduledMessageAsSending(id: string): Promise<ScheduledMessage> {
  // Using imported supabase client

  const { data, error } = await supabase
    .from('scheduled_messages')
    .update({ status: 'sending' })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to mark message as sending: ${error.message}`);
  }

  return data;
}

/**
 * Mark scheduled message as sent
 */
export async function markScheduledMessageAsSent(
  id: string, 
  successCount: number, 
  failureCount: number
): Promise<ScheduledMessage> {
  // Using imported supabase client

  const { data, error } = await supabase
    .from('scheduled_messages')
    .update({ 
      status: 'sent',
      sent_at: new Date().toISOString(),
      success_count: successCount,
      failure_count: failureCount
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to mark message as sent: ${error.message}`);
  }

  return data;
}

/**
 * Mark scheduled message as failed
 */
export async function markScheduledMessageAsFailed(id: string, failureCount: number): Promise<ScheduledMessage> {
  // Using imported supabase client

  const { data, error } = await supabase
    .from('scheduled_messages')
    .update({ 
      status: 'failed',
      failure_count: failureCount
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to mark message as failed: ${error.message}`);
  }

  return data;
} 