import { supabase } from './client';
import type { MediaInsert } from './types';

// Media database helpers
export const getEventMedia = async (eventId: string) => {
  return await supabase
    .from('media')
    .select(
      `
      *,
      uploader:public_user_profiles!media_uploader_user_id_fkey(*)
    `,
    )
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
};

export const createMedia = async (mediaData: MediaInsert) => {
  return await supabase.from('media').insert(mediaData).select().single();
};

// Real-time subscription for media
export const subscribeToEventMedia = (
  eventId: string,
  callback: (payload: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    new: Record<string, unknown>;
    old: Record<string, unknown>;
  }) => void,
) => {
  return supabase
    .channel(`event-media-${eventId}`)
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
};
