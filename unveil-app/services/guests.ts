import { supabase } from '@/lib/supabase/client';
import type {
  EventParticipant,
  EventParticipantInsert,
  EventParticipantUpdate,
  EventParticipantWithUser,
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
    if (dbError.message?.includes('event_participants_event_id_user_id_key')) {
      throw new Error('This user is already a participant in this event');
    }
  }

  if (dbError.code === '23503') {
    throw new Error('Invalid event or user reference');
  }

  throw new Error(dbError.message || 'Database operation failed');
};

// Participant service functions (replaces legacy guest functions)
export const getEventParticipants = async (
  eventId: string,
): Promise<ServiceResponseArray<EventParticipantWithUser>> => {
  try {
    const result = await supabase
      .from('event_participants')
      .select(
        `
        *,
        user:public_user_profiles(*)
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
          : new Error('Failed to get event participants'),
    };
  }
};

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

export const updateParticipant = async (
  id: string,
  updates: EventParticipantUpdate,
) => {
  try {
    return await supabase
      .from('event_participants')
      .update(updates)
      .eq('id', id)
      .select(
        `
        *,
        user:public_user_profiles(*)
      `,
      )
      .single();
  } catch (error) {
    handleDatabaseError(error, 'updateParticipant');
  }
};

export const removeParticipant = async (eventId: string, userId: string) => {
  try {
    return await supabase
      .from('event_participants')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', userId);
  } catch (error) {
    handleDatabaseError(error, 'removeParticipant');
  }
};

export const importParticipants = async (
  eventId: string,
  participants: Array<{
    name: string;
    phone: string;
    email?: string;
    role?: 'host' | 'guest';
  }>,
) => {
  try {
    // First, create or find users
    const userResults: User[] = [];

    for (const participant of participants) {
      // Try to find existing user by phone
      const { data: existingUser } = await getUserByPhone(participant.phone);

      if (existingUser) {
        userResults.push(existingUser);
      } else {
        // Create new user
        const { data: newUser, error } = await createUser({
          full_name: participant.name,
          phone: participant.phone,
          email: participant.email || null,
        });

        if (error) throw error;
        if (newUser) userResults.push(newUser);
      }
    }

    // Then, add them to the event as participants
    const participantInserts: EventParticipantInsert[] = userResults.map(
      (user, index) => ({
        event_id: eventId,
        user_id: user.id,
        role: participants[index].role || 'guest',
        rsvp_status: 'pending',
      }),
    );

    return await supabase.from('event_participants').insert(participantInserts)
      .select(`
        *,
        user:public_user_profiles(*)
      `);
  } catch (error) {
    handleDatabaseError(error, 'importParticipants');
  }
};

export const updateParticipantRSVP = async (
  eventId: string,
  userId: string,
  status: 'attending' | 'declined' | 'maybe' | 'pending',
) => {
  try {
    return await supabase
      .from('event_participants')
      .update({ rsvp_status: status })
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .select(
        `
        *,
        user:public_user_profiles(*)
      `,
      )
      .single();
  } catch (error) {
    handleDatabaseError(error, 'updateParticipantRSVP');
  }
};

export const addParticipantToEvent = async (
  participantData: EventParticipantInsert,
) => {
  try {
    return await supabase
      .from('event_participants')
      .insert(participantData)
      .select(
        `
        *,
        user:public_user_profiles(*)
      `,
      )
      .single();
  } catch (error) {
    handleDatabaseError(error, 'addParticipantToEvent');
  }
};

export const getParticipantsByRole = async (
  eventId: string,
  role: 'host' | 'guest',
) => {
  try {
    return await supabase
      .from('event_participants')
      .select(
        `
        *,
        user:public_user_profiles(*)
      `,
      )
      .eq('event_id', eventId)
      .eq('role', role)
      .order('created_at', { ascending: false });
  } catch (error) {
    handleDatabaseError(error, 'getParticipantsByRole');
  }
};

// Legacy function names removed - use participant-based functions instead

// Additional legacy functions for backward compatibility
export const inviteGuest = async (
  eventId: string,
  guestData: {
    name: string;
    phone: string;
    email?: string;
  },
) => {
  try {
    // Create or find user
    const { data: existingUser } = await getUserByPhone(guestData.phone);

    let userId: string;
    if (existingUser) {
      userId = existingUser.id;
    } else {
      const { data: newUser, error } = await createUser({
        full_name: guestData.name,
        phone: guestData.phone,
        email: guestData.email || null,
      });

      if (error) throw error;
      if (!newUser) throw new Error('Failed to create user');
      userId = newUser.id;
    }

    // Add as participant
    return await addParticipantToEvent({
      event_id: eventId,
      user_id: userId,
      role: 'guest',
      rsvp_status: 'pending',
    });
  } catch (error) {
    handleDatabaseError(error, 'inviteGuest');
  }
};

export const removeGuest = removeParticipant;

export const bulkInviteGuests = importParticipants;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const getGuestsByTags = async (eventId: string, _tags?: string[]) => {
  // Since we don't have tags in the simplified schema, just return all guests
  try {
    return await getParticipantsByRole(eventId, 'guest');
  } catch (error) {
    handleDatabaseError(error, 'getGuestsByTags');
  }
};

export const getGuestStats = async (eventId: string) => {
  try {
    const { data: participants } = await getEventParticipants(eventId);

    if (!participants) {
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

    const guests = participants.filter(
      (p: EventParticipant) => p.role === 'guest',
    );
    const stats = {
      total: guests.length,
      attending: guests.filter(
        (g: EventParticipant) => g.rsvp_status === 'attending',
      ).length,
      declined: guests.filter(
        (g: EventParticipant) => g.rsvp_status === 'declined',
      ).length,
      maybe: guests.filter((g: EventParticipant) => g.rsvp_status === 'maybe')
        .length,
      pending: guests.filter(
        (g: EventParticipant) => g.rsvp_status === 'pending',
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
