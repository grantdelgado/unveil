import { supabase } from './client';
import type { EventInsert, EventUpdate } from './types';

// Database helpers for events
export const createEvent = async (eventData: EventInsert) => {
  return await supabase.from('events').insert(eventData).select().single();
};

export const updateEvent = async (eventId: string, eventData: EventUpdate) => {
  return await supabase
    .from('events')
    .update(eventData)
    .eq('id', eventId)
    .select()
    .single();
};

export const getEventWithHost = async (eventId: string) => {
  // Fetch event without user join to avoid RLS conflicts
  const result = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single();

  // If we got the event, try to fetch host info separately (gracefully handle RLS)
  if (result.data && !result.error) {
    try {
      const { data: hostData } = await supabase
        .from('users')
        .select('*')
        .eq('id', result.data.host_user_id)
        .single();

      // Add host data if we successfully fetched it
      if (hostData) {
        return {
          data: {
            ...result.data,
            host: hostData,
          },
          error: null,
        };
      }
    } catch (hostError) {
      // Host fetch failed due to RLS - this is expected behavior
      // Return event without host information rather than failing entirely
      console.warn('Could not fetch host information (RLS blocked):', hostError);
    }

    // Return event data without host information when RLS blocks access
    return {
      data: {
        ...result.data,
        host: null,
      },
      error: null,
    };
  }

  return result;
};

// Permission helpers using MCP-verified RLS functions
export const isEventHost = async (eventId: string) => {
  const { data, error } = await supabase.rpc('is_event_host', {
    p_event_id: eventId,
  });

  return { isHost: data, error };
};

export const isEventGuest = async (eventId: string) => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { isGuest: false, error: null };

  const { data, error } = await supabase
    .from('event_guests')
    .select('id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .eq('role', 'guest')
    .single();

  return { isGuest: !!data, error };
};
