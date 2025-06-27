import { supabase } from './client';
import type { EventGuestInsert, EventGuestUpdate } from './types';

// Event guest database helpers
export const getEventGuests = async (eventId: string) => {
  return await supabase
    .from('event_guests')
    .select(
      `
      *,
      users:user_id(*)
    `,
    )
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
};

// Event guest management functions
// All guest management now unified under event_guests table.

// Guest lookup by user for event access
export const findGuestByUser = async (
  eventId: string,
  userId: string,
) => {
  return await supabase
    .from('event_guests')
    .select('*')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .single();
};

// Guest lookup by phone for event access (supports phone-only guests)
export const findGuestByPhone = async (
  eventId: string,
  phone: string,
) => {
  return await supabase
    .from('event_guests')
    .select('*')
    .eq('event_id', eventId)
    .eq('phone', phone)
    .single();
};

// Backward compatibility (deprecated)
/** @deprecated Use findGuestByUser instead */


// Create event guest
export const createEventGuest = async (
  guestData: EventGuestInsert,
) => {
  return await supabase
    .from('event_guests')
    .insert(guestData)
    .select()
    .single();
};

export const updateEventGuest = async (
  guestId: string,
  guestData: EventGuestUpdate,
) => {
  return await supabase
    .from('event_guests')
    .update(guestData)
    .eq('id', guestId)
    .select()
    .single();
};

// Backward compatibility (deprecated)
// Guest functions above handle all guest management

// Real-time subscription for event guests
export const subscribeToEventGuests = (
  eventId: string,
  callback: (payload: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    new: Record<string, unknown>;
    old: Record<string, unknown>;
  }) => void,
) => {
  return supabase
    .channel(`event-guests-${eventId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'event_guests',
        filter: `event_id=eq.${eventId}`,
      },
      callback,
    )
    .subscribe();
};

// Backward compatibility (deprecated)
// Legacy subscription functions replaced with guest subscriptions above
