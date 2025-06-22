import { supabase } from './client';
import type { EventParticipantInsert, EventParticipantUpdate } from './types';

// Event participant database helpers
export const getEventParticipants = async (eventId: string) => {
  return await supabase
    .from('event_participants')
    .select(
      `
      *,
      user:public_user_profiles(*)
    `,
    )
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
};

// Participant lookup by user for event access
export const findParticipantByUser = async (
  eventId: string,
  userId: string,
) => {
  return await supabase
    .from('event_participants')
    .select('*')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .single();
};

// Create event participant
export const createEventParticipant = async (
  participantData: EventParticipantInsert,
) => {
  return await supabase
    .from('event_participants')
    .insert(participantData)
    .select()
    .single();
};

export const updateEventParticipant = async (
  participantId: string,
  participantData: EventParticipantUpdate,
) => {
  return await supabase
    .from('event_participants')
    .update(participantData)
    .eq('id', participantId)
    .select()
    .single();
};

// Real-time subscription for event participants
export const subscribeToEventParticipants = (
  eventId: string,
  callback: (payload: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    new: Record<string, unknown>;
    old: Record<string, unknown>;
  }) => void,
) => {
  return supabase
    .channel(`event-participants-${eventId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'event_participants',
        filter: `event_id=eq.${eventId}`,
      },
      callback,
    )
    .subscribe();
};
