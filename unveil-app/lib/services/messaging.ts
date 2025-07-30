import { supabase } from '@/lib/supabase/client';
import type { 
  SendMessageRequest, 
  ScheduledMessageFilters, 
  CreateScheduledMessageData 
} from '@/lib/types/messaging';

// Send message service
export async function sendMessageToEvent(request: SendMessageRequest) {
  try {
    // Create message record
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        event_id: request.eventId,
        content: request.content,
        message_type: request.messageType,
        sender_user_id: (await supabase.auth.getUser()).data.user?.id,
      })
      .select()
      .single();

    if (messageError) throw messageError;

    return { success: true, data: message };
  } catch (error) {
    console.error('Error sending message:', error);
    return { success: false, error };
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

// Create scheduled message
export async function createScheduledMessage(messageData: CreateScheduledMessageData) {
  try {
    const currentUser = await supabase.auth.getUser();
    if (!currentUser.data.user?.id) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('scheduled_messages')
      .insert({
        event_id: messageData.eventId,
        content: messageData.content,
        send_at: messageData.sendAt,
        message_type: messageData.messageType,
        send_via_sms: messageData.sendViaSms,
        send_via_email: messageData.sendViaEmail,
        send_via_push: messageData.sendViaPush,
        subject: messageData.subject || null,
        sender_user_id: currentUser.data.user.id,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error creating scheduled message:', error);
    return { success: false, error };
  }
} 