import { supabase } from '@/lib/supabase/client';
import type { EventDetailsFormData } from '@/lib/validation/events';

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

// Get event guests with user information and computed display names
export async function getEventGuests(eventId: string) {
  try {
    // Use RPC function to get guests with computed display names
    const { data, error } = await supabase
      .rpc('get_event_guests_with_display_names', {
        p_event_id: eventId,
        p_limit: undefined,
        p_offset: 0
      });

    if (error) throw error;

    // Transform to include users object for compatibility
    const transformedData = (data || []).map(guest => ({
      ...guest,
      users: guest.user_id ? {
        id: guest.user_id,
        full_name: guest.user_full_name,
        email: guest.user_email,
        phone: guest.user_phone,
        avatar_url: guest.user_avatar_url,
        created_at: guest.user_created_at,
        updated_at: guest.user_updated_at,
        intended_redirect: guest.user_intended_redirect,
        onboarding_completed: guest.user_onboarding_completed || false,
      } : null,
    }));

    return { success: true, data: transformedData };
  } catch (error) {
    console.error('Error fetching event guests:', error);
    return { success: false, error, data: [] };
  }
}

// Update event details (MVP fields only)
export async function updateEventDetails(
  eventId: string, 
  formData: EventDetailsFormData
) {
  try {
    // Import transform function to avoid circular dependency
    const { transformEventDetailsForDB } = await import('@/lib/validation/events');
    const updateData = transformEventDetailsForDB(formData);

    const { data, error } = await supabase
      .from('events')
      .update(updateData)
      .eq('id', eventId)
      .select()
      .single();

    if (error) {
      // Handle specific error cases
      if (error.code === 'PGRST116') {
        throw new Error('Event not found');
      }
      if (error.code === '42501' || error.message?.includes('permission denied')) {
        throw new Error('You don\'t have permission to edit this event');
      }
      throw error;
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error updating event details:', error);
    
    // Return user-friendly error messages
    const message = error instanceof Error 
      ? error.message 
      : 'Failed to update event details';
      
    return { success: false, error: message };
  }
}

// Verify host permissions for event editing
export async function verifyHostPermissions(eventId: string) {
  try {
    const { data: isHost, error } = await supabase
      .rpc('is_event_host', { p_event_id: eventId });

    if (error) {
      console.error('Host permission check failed:', error);
      return { success: false, error: 'Failed to verify permissions' };
    }

    if (!isHost) {
      return { success: false, error: 'You don\'t have permission to edit this event' };
    }

    return { success: true, data: true };
  } catch (error) {
    console.error('Error verifying host permissions:', error);
    return { success: false, error: 'Permission verification failed' };
  }
} 