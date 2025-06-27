import { supabase } from './client';
import type { MessageInsert } from './types';

// Message database helpers
export const getEventMessages = async (eventId: string) => {
  return await supabase
    .from('messages')
    .select(
      `
      *,
      sender:users!messages_sender_user_id_fkey(*)
    `,
    )
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
};

export const createMessage = async (messageData: MessageInsert) => {
  return await supabase.from('messages').insert(messageData).select().single();
};

// Real-time subscription for messages
export const subscribeToEventMessages = (
  eventId: string,
  callback: (payload: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    new: Record<string, unknown>;
    old: Record<string, unknown>;
  }) => void,
) => {
  return supabase
    .channel(`event-messages-${eventId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `event_id=eq.${eventId}`,
      },
      callback,
    )
    .subscribe();
};
