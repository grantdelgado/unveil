import { supabase } from '@/lib/supabase';
import type { Tables } from '@/app/reference/supabase.types';

type ScheduledMessage = Tables<'scheduled_messages'>;
type EventGuest = Tables<'event_guests'>;

/**
 * Get event guests that match the targeting criteria for a scheduled message
 */
export async function getScheduledMessageTargets(
  eventId: string,
  targetAllGuests: boolean,
  targetGuestIds?: string[] | null,
  targetGuestTags?: string[] | null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _targetSubEventIds?: string[] | null // Future use - sub-events within main event
): Promise<EventGuest[]> {
  // Using imported supabase client
  // Note: _targetSubEventIds is not yet implemented but reserved for future sub-event functionality

  if (targetAllGuests) {
    const { data, error } = await supabase
      .from('event_guests')
      .select('*')
      .eq('event_id', eventId)
      .eq('sms_opt_out', false); // Respect opt-out preferences

    if (error) {
      throw new Error(`Failed to fetch all guests: ${error.message}`);
    }

    return data || [];
  }

  // Build targeted query
  let query = supabase
    .from('event_guests')
    .select('*')
    .eq('event_id', eventId)
    .eq('sms_opt_out', false);

  // Apply filters with OR logic
  const conditions: string[] = [];

  if (targetGuestIds?.length) {
    conditions.push(`id.in.(${targetGuestIds.join(',')})`);
  }

  if (targetGuestTags?.length) {
    conditions.push(`guest_tags.ov.{${targetGuestTags.join(',')}}`);
  }

  // For now, we'll handle sub-events separately since that requires a join
  // TODO: Implement sub-event targeting when sub-events table is ready

  if (conditions.length > 0) {
    query = query.or(conditions.join(','));
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch targeted guests: ${error.message}`);
  }

  return data || [];
}

/**
 * Create a real-time subscription for scheduled messages in an event
 */
export function subscribeToScheduledMessages(
  eventId: string,
  callback: (payload: { 
    eventType: string; 
    new?: ScheduledMessage; 
    old?: ScheduledMessage; 
  }) => void
) {
  // Using imported supabase client
  const channelName = `scheduled_messages:${eventId}`;
  
  console.log(`Setting up real-time subscription for ${channelName}`);
  
  // Create a channel for this event's scheduled messages
  const channel = supabase.channel(channelName);
  
  // Set up postgres changes listener
  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'scheduled_messages',
      filter: `event_id=eq.${eventId}`,
    },
    (payload) => {
      try {
        console.log(`📨 Scheduled message real-time event:`, {
          eventType: payload.eventType,
          table: payload.table,
        });
        
        // Transform payload to match expected format
        const transformedPayload = {
          eventType: payload.eventType,
          new: payload.new as ScheduledMessage | undefined,
          old: payload.old as ScheduledMessage | undefined,
        };
        
        callback(transformedPayload);
      } catch (error) {
        console.error(`❌ Error processing scheduled message real-time event:`, error);
      }
    }
  );
  
  // Subscribe to the channel
  channel.subscribe((status, err) => {
    if (status === 'SUBSCRIBED') {
      console.log(`✅ Scheduled messages subscription active: ${channelName}`);
    } else if (status === 'CHANNEL_ERROR') {
      console.error(`❌ Scheduled messages subscription error: ${channelName}`, err);
    } else if (status === 'TIMED_OUT') {
      console.error(`⏰ Scheduled messages subscription timeout: ${channelName}`);
    } else if (status === 'CLOSED') {
      console.log(`🔌 Scheduled messages subscription closed: ${channelName}`);
    }
  });
  
  // Return proper unsubscribe function
  return {
    unsubscribe: () => {
      console.log(`Unsubscribing from ${channelName}`);
      supabase.removeChannel(channel);
    }
  };
}

/**
 * Get scheduled message statistics for an event
 */
export async function getScheduledMessageStats(eventId: string) {
  // Using imported supabase client

  const { data, error } = await supabase
    .from('scheduled_messages')
    .select('status, recipient_count, success_count, failure_count')
    .eq('event_id', eventId);

  if (error) {
    throw new Error(`Failed to fetch message stats: ${error.message}`);
  }

  // Calculate statistics
  type StatAccumulator = {
    total: number;
    scheduled: number;
    sending: number;
    sent: number;
    failed: number;
    cancelled: number;
    totalRecipients: number;
    totalSent: number;
    totalFailed: number;
  };

  const stats = data?.reduce((acc: StatAccumulator, message) => {
    acc.total += 1;
    acc[message.status as keyof typeof acc] = (acc[message.status as keyof typeof acc] || 0) + 1;
    acc.totalRecipients += message.recipient_count || 0;
    acc.totalSent += message.success_count || 0;
    acc.totalFailed += message.failure_count || 0;
    return acc;
  }, {
    total: 0,
    scheduled: 0,
    sending: 0,
    sent: 0,
    failed: 0,
    cancelled: 0,
    totalRecipients: 0,
    totalSent: 0,
    totalFailed: 0
  }) || {
    total: 0,
    scheduled: 0,
    sending: 0,
    sent: 0,
    failed: 0,
    cancelled: 0,
    totalRecipients: 0,
    totalSent: 0,
    totalFailed: 0
  };

  return stats;
}

/**
 * Batch update scheduled message statuses (for CRON processing)
 */
export async function batchUpdateScheduledMessageStatus(
  messageIds: string[],
  status: string
) {
  // Using imported supabase client

  const { error } = await supabase
    .from('scheduled_messages')
    .update({ status })
    .in('id', messageIds);

  if (error) {
    throw new Error(`Failed to batch update message status: ${error.message}`);
  }
}

/**
 * Get upcoming scheduled messages (next 24 hours)
 */
export async function getUpcomingScheduledMessages(eventId?: string): Promise<ScheduledMessage[]> {
  // Using imported supabase client

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  let query = supabase
    .from('scheduled_messages')
    .select('*')
    .eq('status', 'scheduled')
    .gte('send_at', now.toISOString())
    .lte('send_at', tomorrow.toISOString())
    .order('send_at', { ascending: true });

  if (eventId) {
    query = query.eq('event_id', eventId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch upcoming messages: ${error.message}`);
  }

  return data || [];
}

/**
 * Archive old completed scheduled messages (sent/failed/cancelled > 30 days)
 */
export async function archiveOldScheduledMessages(): Promise<number> {
  // Using imported supabase client

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data, error } = await supabase
    .from('scheduled_messages')
    .delete()
    .in('status', ['sent', 'failed', 'cancelled'])
    .lt('created_at', thirtyDaysAgo.toISOString())
    .select('id');

  if (error) {
    throw new Error(`Failed to archive old messages: ${error.message}`);
  }

  return data?.length || 0;
}

/**
 * Validate scheduled message can be created (check limits, permissions, etc.)
 */
export async function validateScheduledMessage(
  eventId: string,
  sendAt: Date
): Promise<{ valid: boolean; error?: string }> {
  // Using imported supabase client

  // Check if user is event host
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { valid: false, error: 'Authentication required' };
  }

  const { data: event } = await supabase
    .from('events')
    .select('host_user_id')
    .eq('id', eventId)
    .single();

  if (!event || event.host_user_id !== user.id) {
    return { valid: false, error: 'Only event hosts can schedule messages' };
  }

  // Check if send time is in the future
  if (sendAt <= new Date()) {
    return { valid: false, error: 'Send time must be in the future' };
  }

  // Check for reasonable limits (e.g., not more than 1 year in the future)
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
  
  if (sendAt > oneYearFromNow) {
    return { valid: false, error: 'Send time cannot be more than 1 year in the future' };
  }

  // Check if there are too many scheduled messages for this event
  const { count } = await supabase
    .from('scheduled_messages')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('status', 'scheduled');

  if ((count || 0) >= 50) { // Arbitrary limit
    return { valid: false, error: 'Too many scheduled messages for this event' };
  }

  return { valid: true };
} 