import { supabase } from '@/lib/supabase/client';

// Subscribe to event messages
export function subscribeToEventMessages(
  eventId: string,
  callback: (message: unknown) => void,
) {
  const subscription = supabase
    .channel(`messages:${eventId}`)
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

  return {
    unsubscribe: () => subscription.unsubscribe(),
  };
}

// Subscribe to event media
export function subscribeToEventMedia(
  eventId: string,
  callback: (media: unknown) => void,
) {
  const subscription = supabase
    .channel(`media:${eventId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'media',
        filter: `event_id=eq.${eventId}`,
      },
      callback,
    )
    .subscribe();

  return {
    unsubscribe: () => subscription.unsubscribe(),
  };
}
