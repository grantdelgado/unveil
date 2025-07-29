import { supabase } from '@/lib/supabase/client';

// Get event by ID with host information
export async function getEventById(eventId: string) {
  try {
    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        host_user:users!events_host_user_id_fkey(*)
      `)
      .eq('id', eventId)
      .single();

    if (error) throw error;

    // Transform data to match EventWithHost type
    const transformedData = data ? {
      ...data,
      host: data.host_user,
      host_user: undefined // Remove the original property
    } : null;

    return { success: true, data: transformedData };
  } catch (error) {
    console.error('Error fetching event:', error);
    return { success: false, error };
  }
}

// Get events hosted by a user
export async function getHostEvents(userId: string) {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('host_user_id', userId)
      .order('event_date', { ascending: false });

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Error fetching host events:', error);
    return { success: false, error, data: [] };
  }
}

// Get event guests with user information
export async function getEventGuests(eventId: string) {
  try {
    const { data, error } = await supabase
      .from('event_guests')
      .select(`
        *,
        users(*)
      `)
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Error fetching event guests:', error);
    return { success: false, error, data: [] };
  }
} 