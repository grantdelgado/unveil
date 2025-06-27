import { supabase } from '@/lib/supabase/client';
import type {
  EventInsert,
  EventUpdate,
  EventGuestInsert,
} from '@/lib/supabase/types';
import { logDatabaseError } from '@/lib/logger';
import {
  getEventGuests,
  addGuestToEvent,
  updateGuestRSVP,
  removeGuest,
  updateGuest,
} from './guests';

// Error handling for database constraints
const handleDatabaseError = (error: unknown, context: string) => {
  logDatabaseError(`Database error in ${context}`, error, context);

  const dbError = error as { code?: string; message?: string };

  if (dbError.code === '23505') {
    throw new Error('A record with this information already exists');
  }

  if (dbError.code === '23503') {
    if (dbError.message?.includes('host_user_id')) {
      throw new Error('Invalid host user ID');
    }
    if (dbError.message?.includes('event_id')) {
      throw new Error('Invalid event ID');
    }
    if (dbError.message?.includes('user_id')) {
      throw new Error('Invalid user ID');
    }
    throw new Error('Invalid reference in database');
  }

  if (dbError.code === '23514') {
    throw new Error('Data validation failed - please check your input');
  }

  throw new Error(dbError.message || 'Database operation failed');
};

/**
 * Creates a new event in the database
 * 
 * Creates an event record and automatically makes the caller the host.
 * Requires valid host_user_id that matches an authenticated user.
 * 
 * @param eventData - Event data to insert (title, date, location, etc.)
 * @returns Promise resolving to Supabase response with created event and host info
 * 
 * @throws {Error} If validation fails or database constraints are violated
 * 
 * @example
 * ```typescript
 * const eventData = {
 *   title: 'Wedding Reception',
 *   event_date: '2024-06-15T18:00:00Z',
 *   location: 'Grand Ballroom',
 *   host_user_id: 'user-123'
 * }
 * const { data: event, error } = await createEvent(eventData)
 * ```
 * 
 * @see {@link updateEvent} for modifying existing events
 * @see {@link deleteEvent} for removing events
 */
export const createEvent = async (eventData: EventInsert) => {
  try {
    return await supabase
      .from('events')
      .insert(eventData)
      .select(
        `
        *,
        host:users!events_host_user_id_fkey(*)
      `,
      )
      .single();
  } catch (error) {
    handleDatabaseError(error, 'createEvent');
  }
};

/**
 * Updates an existing event
 * 
 * Modifies event details like title, date, location, or description.
 * Only the event host can update event details (enforced by RLS).
 * 
 * @param id - The event ID to update
 * @param updates - Partial event data with fields to update
 * @returns Promise resolving to Supabase response with updated event
 * 
 * @throws {Error} If event not found, access denied, or validation fails
 * 
 * @example
 * ```typescript
 * const updates = { 
 *   title: 'Updated Wedding Reception',
 *   location: 'New Venue Address'
 * }
 * const { data: event, error } = await updateEvent('event-123', updates)
 * ```
 * 
 * @see {@link createEvent} for creating new events
 * @see {@link getEventById} for retrieving event details
 */
export const updateEvent = async (id: string, updates: EventUpdate) => {
  try {
    return await supabase
      .from('events')
      .update(updates)
      .eq('id', id)
      .select(
        `
        *,
        host:users!events_host_user_id_fkey(*)
      `,
      )
      .single();
  } catch (error) {
    handleDatabaseError(error, 'updateEvent');
  }
};

/**
 * Deletes an event and all associated data
 * 
 * Permanently removes the event and cascades to delete:
 * - Event guests
 * - Media uploads
 * - Messages
 * - Other related data
 * 
 * Only the event host can delete events (enforced by RLS).
 * 
 * @param id - The event ID to delete
 * @returns Promise resolving to Supabase delete response
 * 
 * @throws {Error} If event not found or access denied
 * 
 * @example
 * ```typescript
 * const { error } = await deleteEvent('event-123')
 * if (!error) {
 *   console.log('Event deleted successfully')
 * }
 * ```
 * 
 * @warning This operation is irreversible and deletes all event data
 * @see {@link updateEvent} for non-destructive changes
 */
export const deleteEvent = async (id: string) => {
  try {
    return await supabase.from('events').delete().eq('id', id);
  } catch (error) {
    handleDatabaseError(error, 'deleteEvent');
  }
};

/**
 * Retrieves a single event by ID with host information
 * 
 * Fetches complete event details including host profile data.
 * Access is controlled by RLS policies based on user's relationship to the event.
 * 
 * @param id - The event ID to retrieve
 * @returns Promise resolving to Supabase response with event and host data
 * 
 * @throws {Error} If event not found or access denied
 * 
 * @example
 * ```typescript
 * const { data: event, error } = await getEventById('event-123')
 * if (event) {
 *   console.log('Event:', event.title)
 *   console.log('Host:', event.host.display_name)
 * }
 * ```
 * 
 * @see {@link getHostEvents} for host's events
 * @see {@link getGuestEvents} for guest events
 */
export const getEventById = async (id: string) => {
  try {
    return await supabase
      .from('events')
      .select(
        `
        *,
        host:users!events_host_user_id_fkey(*)
      `,
      )
      .eq('id', id)
      .single();
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'PGRST116'
    ) {
      throw new Error('Event not found');
    }
    handleDatabaseError(error, 'getEventById');
  }
};

export const getHostEvents = async (hostId: string) => {
  try {
    return await supabase
      .from('events')
      .select(
        `
        *,
        host:users!events_host_user_id_fkey(*)
      `,
      )
      .eq('host_user_id', hostId)
      .order('event_date', { ascending: true });
  } catch (error) {
    handleDatabaseError(error, 'getHostEvents');
  }
};

export const getGuestEvents = async (userId: string) => {
  try {
    return await supabase
      .from('event_guests')
      .select(
        `
        *,
        event:events(
          *,
          host:users!events_host_user_id_fkey(*)
        )
      `,
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
  } catch (error) {
    handleDatabaseError(error, 'getGuestEvents');
  }
};













export const getEventStats = async (eventId: string) => {
  try {
    const [guestsResult, mediaResult, messagesResult] = await Promise.all(
      [
        supabase
          .from('event_guests')
          .select('rsvp_status')
          .eq('event_id', eventId),
        supabase.from('media').select('id').eq('event_id', eventId),
        supabase.from('messages').select('id').eq('event_id', eventId),
      ],
    );

    const guests = guestsResult.data || [];
    const rsvpCounts = {
      attending: guests.filter((g) => g.rsvp_status === 'attending')
        .length,
      declined: guests.filter((g) => g.rsvp_status === 'declined').length,
      maybe: guests.filter((g) => g.rsvp_status === 'maybe').length,
      pending: guests.filter((g) => g.rsvp_status === 'pending').length,
      total: guests.length,
    };

    return {
      data: {
        guests: rsvpCounts,
        media_count: mediaResult.data?.length || 0,
        message_count: messagesResult.data?.length || 0,
      },
      error: null,
    };
  } catch (error) {
    handleDatabaseError(error, 'getEventStats');
  }
};

// Event utility functions

// Additional utility functions for backward compatibility
export const getEventsByUser = async (userId: string) => {
  try {
    // Get both hosted events and guest events
    const [hostedResult, guestResult] = await Promise.all([
      getHostEvents(userId),
      getGuestEvents(userId),
    ]);

    const hostedEvents = hostedResult?.data || [];
    const guestEvents = (guestResult?.data || [])
      .map((g) => g.event)
      .filter(Boolean);

    // Combine and deduplicate events
    const allEvents = [...hostedEvents, ...guestEvents];
    const uniqueEvents = allEvents.filter(
      (event, index, self) =>
        index === self.findIndex((e) => e.id === event.id),
    );

    return {
      data: uniqueEvents,
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error,
    };
  }
};

export const getUserEventRole = async (eventId: string, userId: string) => {
  try {
    // Check if user is the host
    const { data: event } = await supabase
      .from('events')
      .select('host_user_id')
      .eq('id', eventId)
      .single();

    if (event?.host_user_id === userId) {
      return { data: 'host', error: null };
    }

    // Check if user is a guest
    const { data: guest } = await supabase
      .from('event_guests')
      .select('role')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .single();

    if (guest) {
      return { data: guest.role, error: null };
    }

    return { data: null, error: null };
  } catch (error) {
    return { data: null, error: error };
  }
};

export const isEventHost = async (eventId: string, userId: string) => {
  try {
    const { data: event } = await supabase
      .from('events')
      .select('host_user_id')
      .eq('id', eventId)
      .single();

    return {
      data: event?.host_user_id === userId,
      error: null,
    };
  } catch (error) {
    return {
      data: false,
      error: error,
    };
  }
};

export const isEventGuest = async (eventId: string, userId: string) => {
  try {
    const { data: guest } = await supabase
      .from('event_guests')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .eq('role', 'guest')
      .single();

    return {
      data: !!guest,
      error: null,
    };
  } catch (error) {
    return {
      data: false,
      error: error,
    };
  }
};
