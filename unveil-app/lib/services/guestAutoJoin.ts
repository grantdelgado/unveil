import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { normalizePhoneNumber } from '@/lib/utils/phone';
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

// Phone normalization moved to lib/utils/phone.ts

/**
 * Auto-join invited guests to events they're eligible for using secure DB-side RPC
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

    // Normalize phone for consistent matching
    let normalizedPhone: string | undefined;
    if (userPhone) {
      const phoneValidation = normalizePhoneNumber(userPhone);
      if (!phoneValidation.isValid) {
        logger.apiError('Invalid phone number format', { 
          userId, 
          error: phoneValidation.error 
        }, 'guestAutoJoin.autoJoinInvitedGuests');
        return { success: false, joinedEvents: [], error: phoneValidation.error || 'Invalid phone number format' };
      }
      normalizedPhone = phoneValidation.normalized!;
    }

    logger.api('Starting bulk auto-join process', { 
      userId, 
      hasPhone: !!normalizedPhone 
    }, 'guestAutoJoin.autoJoinInvitedGuests');

    // Call the secure DB-side RPC function
    const { data: result, error: rpcError } = await supabase
      .rpc('bulk_guest_auto_join', {
        p_phone: normalizedPhone || null
      });

    if (rpcError) {
      logger.apiError('Bulk auto-join RPC failed', rpcError, 'guestAutoJoin.autoJoinInvitedGuests');
      return { success: false, joinedEvents: [], error: 'Database error occurred' };
    }

    if (!result || typeof result !== 'object') {
      logger.apiError('Invalid bulk auto-join RPC response', { result }, 'guestAutoJoin.autoJoinInvitedGuests');
      return { success: false, joinedEvents: [], error: 'Invalid response from database' };
    }

    // Handle the response
    if (result.status === 'success') {
      const linkedEvents = result.linked_events || [];
      const alreadyLinkedEvents = result.already_linked_events || [];
      
      logger.api('Bulk auto-join completed successfully', { 
        userId, 
        totalLinked: result.total_linked || 0,
        totalAlreadyLinked: result.total_already_linked || 0,
        linkedEvents,
        alreadyLinkedEvents
      }, 'guestAutoJoin.autoJoinInvitedGuests');

      return {
        success: true,
        joinedEvents: linkedEvents,
      };
    } else {
      logger.apiError('Bulk auto-join failed', { 
        status: result.status, 
        message: result.message,
        errorCode: result.error_code
      }, 'guestAutoJoin.autoJoinInvitedGuests');
      
      return { 
        success: false, 
        joinedEvents: [], 
        error: result.message || 'Bulk auto-join failed' 
      };
    }

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
 * Auto-join a specific event by phone number using secure DB-side RPC
 * This handles the single event join flow from invitation links
 */
export async function autoJoinEventByPhone(
  eventId: string,
  userId: string, 
  phoneNumber: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!eventId || !userId || !phoneNumber) {
      return { success: false, error: 'Missing required parameters' };
    }

    // Normalize the phone number
    const phoneValidation = normalizePhoneNumber(phoneNumber);
    if (!phoneValidation.isValid) {
      logger.apiError('Invalid phone number format', { 
        eventId, 
        userId, 
        error: phoneValidation.error 
      }, 'guestAutoJoin.autoJoinEventByPhone');
      return { success: false, error: phoneValidation.error || 'Invalid phone number format' };
    }

    const normalizedPhone = phoneValidation.normalized!;

    logger.api('Starting DB-side auto-join', { 
      eventId, 
      userId, 
      phone: normalizedPhone.slice(0, 6) + '...' 
    }, 'guestAutoJoin.autoJoinEventByPhone');

    // Call the secure DB-side RPC function
    const { data: result, error: rpcError } = await supabase
      .rpc('guest_auto_join', {
        p_event_id: eventId,
        p_phone: normalizedPhone
      });

    if (rpcError) {
      logger.apiError('RPC call failed', rpcError, 'guestAutoJoin.autoJoinEventByPhone');
      return { success: false, error: 'Database error occurred' };
    }

    if (!result || typeof result !== 'object') {
      logger.apiError('Invalid RPC response', { result }, 'guestAutoJoin.autoJoinEventByPhone');
      return { success: false, error: 'Invalid response from database' };
    }

    // Handle the different response statuses
    switch (result.status) {
      case 'linked':
        logger.api('Successfully linked guest to event', { 
          eventId, 
          userId, 
          guestId: result.guest_id 
        }, 'guestAutoJoin.autoJoinEventByPhone');
        return { success: true };

      case 'already_linked':
        logger.api('User already linked to event', { 
          eventId, 
          userId 
        }, 'guestAutoJoin.autoJoinEventByPhone');
        return { success: false, error: 'already_joined' };

      case 'not_invited':
        logger.api('No invitation found', { 
          eventId, 
          userId, 
          phone: normalizedPhone.slice(0, 6) + '...' 
        }, 'guestAutoJoin.autoJoinEventByPhone');
        return { success: false, error: 'not_invited' };

      case 'conflict':
        logger.api('Invitation already claimed by different user', { 
          eventId, 
          userId 
        }, 'guestAutoJoin.autoJoinEventByPhone');
        return { success: false, error: 'already_claimed' };

      case 'error':
      default:
        logger.apiError('Auto-join failed', { 
          status: result.status, 
          message: result.message 
        }, 'guestAutoJoin.autoJoinEventByPhone');
        return { success: false, error: result.message || 'Auto-join failed' };
    }

  } catch (error) {
    logger.apiError('Auto-join event process failed', error, 'guestAutoJoin.autoJoinEventByPhone');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'auto_join_failed'
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
