import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import type { Database } from '@/app/reference/supabase.types';

type Event = Database['public']['Tables']['events']['Row'];

/**
 * Auto-join service for invited guests
 * Handles the logic for automatically admitting invited guests to events
 */

interface AutoJoinResult {
  success: boolean;
  joinedEvents: string[];
  error?: string;
}

/**
 * Normalize phone number to E.164 format for consistent matching
 */
export function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');
  
  // Add + prefix if not present and assume US number if 10 digits
  if (digitsOnly.length === 10) {
    return `+1${digitsOnly}`;
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    return `+${digitsOnly}`;
  } else if (!phone.startsWith('+')) {
    return `+${digitsOnly}`;
  }
  
  return phone;
}

/**
 * Auto-join invited guests to events they're eligible for
 * This should be called after user sign-in to activate their event memberships
 */
export async function autoJoinInvitedGuests(
  userId: string, 
  userPhone?: string
): Promise<AutoJoinResult> {
  try {
    if (!userId) {
      return { success: false, joinedEvents: [], error: 'User ID required' };
    }

    logger.api('Starting auto-join process', { userId, userPhone }, 'guestAutoJoin.autoJoinInvitedGuests');

    // Normalize phone for consistent matching
    const normalizedPhone = userPhone ? normalizePhoneNumber(userPhone) : null;

    // Find all event_guests records that match this user by phone or user_id
    // but don't have user_id set yet (unlinked invitations)
    const { data: matchingGuests, error: fetchError } = await supabase
      .from('event_guests')
      .select(`
        id,
        event_id,
        phone,
        user_id,
        guest_name,
        events!inner (
          id,
          title,
          is_public,
          allow_open_signup
        )
      `)
      .or(
        normalizedPhone 
          ? `phone.eq.${normalizedPhone},user_id.eq.${userId}`
          : `user_id.eq.${userId}`
      );

    if (fetchError) {
      logger.apiError('Failed to fetch matching guests', fetchError, 'guestAutoJoin.autoJoinInvitedGuests');
      return { success: false, joinedEvents: [], error: 'Failed to check guest eligibility' };
    }

    if (!matchingGuests || matchingGuests.length === 0) {
      logger.api('No matching guest records found', { userId, normalizedPhone }, 'guestAutoJoin.autoJoinInvitedGuests');
      return { success: true, joinedEvents: [] };
    }

    const joinedEvents: string[] = [];
    const updatePromises: Promise<void>[] = [];

    for (const guest of matchingGuests) {
      // Skip if already linked to this user
      if (guest.user_id === userId) {
        logger.api('Guest already linked', { guestId: guest.id, eventId: guest.event_id }, 'guestAutoJoin.autoJoinInvitedGuests');
        continue;
      }

      // Link the guest record to the authenticated user
      const updatePromise = supabase
        .from('event_guests')
        .update({ 
          user_id: userId,
          updated_at: new Date().toISOString()
        })
        .eq('id', guest.id)
        .then(({ error: updateError }) => {
          if (updateError) {
            logger.apiError('Failed to link guest record', updateError, 'guestAutoJoin.autoJoinInvitedGuests');
            throw updateError;
          } else {
            joinedEvents.push(guest.event_id);
            logger.api('Successfully linked guest to event', { 
              guestId: guest.id, 
              eventId: guest.event_id,
              eventTitle: guest.events.title 
            }, 'guestAutoJoin.autoJoinInvitedGuests');
          }
        }) as Promise<void>;

      updatePromises.push(updatePromise);
    }

    // Execute all updates
    await Promise.all(updatePromises);

    logger.api('Auto-join process completed', { 
      userId, 
      joinedEventsCount: joinedEvents.length,
      joinedEvents 
    }, 'guestAutoJoin.autoJoinInvitedGuests');

    return {
      success: true,
      joinedEvents,
    };

  } catch (error) {
    logger.apiError('Auto-join process failed', error, 'guestAutoJoin.autoJoinInvitedGuests');
    return {
      success: false,
      joinedEvents: [],
      error: error instanceof Error ? error.message : 'Auto-join failed'
    };
  }
}

/**
 * Get events that should be visible to a user based on their phone/user_id
 * This respects the is_public setting (visibility toggle)
 */
export async function getVisibleEventsForUser(
  userId: string
): Promise<{ success: boolean; events: Event[]; error?: string }> {
  try {

    // Get events where:
    // 1. User is linked as a guest (user_id match)
    // 2. User's phone matches AND event is_public=true (visible)
    const { data: visibleEvents, error } = await supabase
      .from('event_guests')
      .select(`
        event_id,
        events!inner (
          id,
          title,
          event_date,
          location,
          is_public,
          allow_open_signup
        )
      `)
      .eq('user_id', userId)
      .eq('events.is_public', true); // Only show events with visibility enabled

    if (error) {
      logger.apiError('Failed to fetch visible events', error, 'guestAutoJoin.getVisibleEventsForUser');
      return { success: false, events: [], error: 'Failed to fetch events' };
    }

    return {
      success: true,
      events: (visibleEvents?.map(eg => eg.events) || []) as Event[]
    };

  } catch (error) {
    logger.apiError('Get visible events failed', error, 'guestAutoJoin.getVisibleEventsForUser');
    return {
      success: false,
      events: [],
      error: error instanceof Error ? error.message : 'Failed to get visible events'
    };
  }
}
