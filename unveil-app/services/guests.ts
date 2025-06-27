import { supabase } from '@/lib/supabase/client';
import type {
  EventGuest,
  EventGuestInsert,
  EventGuestUpdate,
  EventGuestWithUser,
  UserInsert,
  User,
  ServiceResponse,
  ServiceResponseArray,
} from '@/lib/supabase/types';
import { logDatabaseError } from '@/lib/logger';

// Error handling for database constraints
const handleDatabaseError = (error: unknown, context: string) => {
  logDatabaseError(`Database error in ${context}`, error, context);

  const dbError = error as { code?: string; message?: string };

  if (dbError.code === '23505') {
    if (dbError.message?.includes('phone')) {
      throw new Error('A user with this phone number already exists');
    }
    if (dbError.message?.includes('event_participants_event_id_user_id_key') || 
        dbError.message?.includes('event_guests_event_id_user_id_key')) {
      throw new Error('This user is already a guest in this event');
    }
  }

  if (dbError.code === '23503') {
    throw new Error('Invalid event or user reference');
  }

  throw new Error(dbError.message || 'Database operation failed');
};

// Guest service functions (unified guest management)
export const getEventGuests = async (
  eventId: string,
): Promise<ServiceResponseArray<EventGuestWithUser>> => {
  try {
    const result = await supabase
      .from('event_guests')
      .select(
        `
        *,
        users:user_id(*)
      `,
      )
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    return {
      data: result.data || [],
      error: result.error ? new Error(result.error.message) : null,
    };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error
          ? error
          : new Error('Failed to get event guests'),
    };
  }
};

  // Guest functions have replaced legacy functions

export const getUserByPhone = async (
  phone: string,
): Promise<ServiceResponse<User>> => {
  try {
    const result = await supabase
      .from('users')
      .select('*')
      .eq('phone', phone)
      .single();

    return {
      data: result.data,
      error: result.error ? new Error(result.error.message) : null,
    };
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'PGRST116'
    ) {
      return { data: null, error: null }; // User not found is OK
    }
    return {
      data: null,
      error:
        error instanceof Error
          ? error
          : new Error('Failed to get user by phone'),
    };
  }
};

export const createUser = async (
  userData: UserInsert,
): Promise<ServiceResponse<User>> => {
  try {
    const result = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single();

    return {
      data: result.data,
      error: result.error ? new Error(result.error.message) : null,
    };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error ? error : new Error('Failed to create user'),
    };
  }
};

export const updateGuest = async (
  id: string,
  updates: EventGuestUpdate,
) => {
  try {
    return await supabase
      .from('event_guests')
      .update(updates)
      .eq('id', id)
      .select(
        `
        *,
        users:user_id(*)
      `,
      )
      .single();
  } catch (error) {
    handleDatabaseError(error, 'updateGuest');
  }
};

// Legacy participant function replaced with updateGuest

export const removeGuest = async (eventId: string, userId: string) => {
  try {
    return await supabase
      .from('event_guests')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', userId);
  } catch (error) {
    handleDatabaseError(error, 'removeGuest');
  }
};

// Support removing by phone for phone-only guests
export const removeGuestByPhone = async (eventId: string, phone: string) => {
  try {
    return await supabase
      .from('event_guests')
      .delete()
      .eq('event_id', eventId)
      .eq('phone', phone)
      .is('user_id', null);
  } catch (error) {
    handleDatabaseError(error, 'removeGuestByPhone');
  }
};

// Legacy participant function replaced with removeGuest

export const importGuests = async (
  eventId: string,
  guests: Array<{
    name: string;
    phone: string;
    email?: string;
    role?: 'host' | 'guest';
  }>,
) => {
  try {
    // Create guest entries in event_guests table
    // We can create guests with or without user accounts
    const guestInserts: EventGuestInsert[] = [];

    for (const guest of guests) {
      // Try to find existing user by phone
      const { data: existingUser } = await getUserByPhone(guest.phone);

      guestInserts.push({
        event_id: eventId,
        user_id: existingUser?.id || null,
        guest_name: guest.name,
        guest_email: guest.email || null,
        phone: guest.phone,
        role: guest.role || 'guest',
        rsvp_status: 'pending',
        sms_opt_out: false,
        preferred_communication: 'sms',
      });
    }

    return await supabase.from('event_guests').insert(guestInserts)
      .select(`
        *,
        users:user_id(*)
      `);
  } catch (error) {
    handleDatabaseError(error, 'importGuests');
  }
};

// Legacy participant function replaced with importGuests

export const updateGuestRSVP = async (
  eventId: string,
  userId: string,
  status: 'attending' | 'declined' | 'maybe' | 'pending',
) => {
  try {
    return await supabase
      .from('event_guests')
      .update({ rsvp_status: status })
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .select(
        `
        *,
        users:user_id(*)
      `,
      )
      .single();
  } catch (error) {
    handleDatabaseError(error, 'updateGuestRSVP');
  }
};

// Support updating RSVP by phone for phone-only guests
export const updateGuestRSVPByPhone = async (
  eventId: string,
  phone: string,
  status: 'attending' | 'declined' | 'maybe' | 'pending',
) => {
  try {
    return await supabase
      .from('event_guests')
      .update({ rsvp_status: status })
      .eq('event_id', eventId)
      .eq('phone', phone)
      .select(
        `
        *,
        users:user_id(*)
      `,
      )
      .single();
  } catch (error) {
    handleDatabaseError(error, 'updateGuestRSVPByPhone');
  }
};



export const addGuestToEvent = async (
  guestData: EventGuestInsert,
) => {
  try {
    return await supabase
      .from('event_guests')
      .insert(guestData)
      .select(
        `
        *,
        users:user_id(*)
      `,
      )
      .single();
  } catch (error) {
    handleDatabaseError(error, 'addGuestToEvent');
  }
};



export const getGuestsByRole = async (
  eventId: string,
  role: 'host' | 'guest',
) => {
  try {
    return await supabase
      .from('event_guests')
      .select(
        `
        *,
        users:user_id(*)
      `,
      )
      .eq('event_id', eventId)
      .eq('role', role)
      .order('created_at', { ascending: false });
  } catch (error) {
    handleDatabaseError(error, 'getGuestsByRole');
  }
};



// Guest management functions above

// Guest invitation (supports both authenticated and phone-only guests)
export const inviteGuest = async (
  eventId: string,
  guestData: {
    name: string;
    phone: string;
    email?: string;
  },
) => {
  try {
    // Check if user exists
    const { data: existingUser } = await getUserByPhone(guestData.phone);

    // Add as guest directly to event_guests table
    return await addGuestToEvent({
      event_id: eventId,
      user_id: existingUser?.id || null,
      guest_name: guestData.name,
      guest_email: guestData.email || null,
      phone: guestData.phone,
      role: 'guest',
      rsvp_status: 'pending',
      sms_opt_out: false,
      preferred_communication: 'sms',
    });
  } catch (error) {
    handleDatabaseError(error, 'inviteGuest');
  }
};

// Note: removeGuest is already defined above

export const bulkInviteGuests = importGuests;

export const getGuestsByTags = async (eventId: string, tags?: string[]) => {
  try {
    if (!tags || tags.length === 0) {
      // Return all guests if no tags specified
      return await getGuestsByRole(eventId, 'guest');
    }

    // Filter by tags using the guest_tags array field
    return await supabase
      .from('event_guests')
      .select(
        `
        *,
        users:user_id(*)
      `,
      )
      .eq('event_id', eventId)
      .eq('role', 'guest')
      .overlaps('guest_tags', tags)
      .order('created_at', { ascending: false });
  } catch (error) {
    handleDatabaseError(error, 'getGuestsByTags');
  }
};

export const getGuestStats = async (eventId: string) => {
  try {
    const { data: guests } = await getEventGuests(eventId);

    if (!guests) {
      return {
        data: {
          total: 0,
          attending: 0,
          declined: 0,
          maybe: 0,
          pending: 0,
        },
        error: null,
      };
    }

    const guestList = guests.filter(
      (g: EventGuest) => g.role === 'guest',
    );
    const stats = {
      total: guestList.length,
      attending: guestList.filter(
        (g: EventGuest) => g.rsvp_status === 'attending',
      ).length,
      declined: guestList.filter(
        (g: EventGuest) => g.rsvp_status === 'declined',
      ).length,
      maybe: guestList.filter((g: EventGuest) => g.rsvp_status === 'maybe')
        .length,
      pending: guestList.filter(
        (g: EventGuest) => g.rsvp_status === 'pending',
      ).length,
    };

    return {
      data: stats,
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error,
    };
  }
};
