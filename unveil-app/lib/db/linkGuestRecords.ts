/**
 * Shared helper functions for linking guest records to user accounts
 * Ensures event_guests.user_id is always populated when phone numbers match
 */

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { supabase } from '@/lib/supabase/client';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';

export interface LinkGuestRecordsResult {
  success: boolean;
  linkedCount: number;
  error?: string;
}

/**
 * Core function to link guest records to a user account
 * Links ALL guest records with matching phone where user_id IS NULL
 * 
 * @param userId - The user ID to link to
 * @param phone - The phone number in E.164 format
 * @param useServerClient - Whether to use server-side client (for API routes)
 * @returns Result with success status and number of records linked
 */
export async function linkGuestRecordsToUser(
  userId: string,
  phone: string,
  useServerClient: boolean = false
): Promise<LinkGuestRecordsResult> {
  try {
    logger.info('Starting guest record linking', {
      userId,
      phone,
      useServerClient
    });

    // Use appropriate Supabase client
    const supabaseClient = useServerClient 
      ? supabaseAdmin  // Use admin client for server operations to avoid RLS issues
      : supabase;

    // Validate inputs
    if (!userId || !phone) {
      return {
        success: false,
        linkedCount: 0,
        error: 'User ID and phone number are required'
      };
    }

    // Normalize and validate phone number format
    let normalizedPhone = phone;
    
    // If phone doesn't start with +, try to normalize it
    if (!phone.startsWith('+')) {
      const digits = phone.replace(/\D/g, '');
      if (digits.length === 10) {
        normalizedPhone = `+1${digits}`;
      } else if (digits.length === 11 && digits.startsWith('1')) {
        normalizedPhone = `+${digits}`;
      } else {
        logger.error('Invalid phone number format for linking', {
          originalPhone: phone,
          digitsOnly: digits,
          userId
        });
        return {
          success: false,
          linkedCount: 0,
          error: `Invalid phone number format: ${phone}. Expected E.164 format (e.g., +12345678901)`
        };
      }
    }

    // Validate final E.164 format
    if (!normalizedPhone.match(/^\+[1-9]\d{1,14}$/)) {
      logger.error('Phone number failed E.164 validation after normalization', {
        originalPhone: phone,
        normalizedPhone,
        userId
      });
      return {
        success: false,
        linkedCount: 0,
        error: `Phone number must be in E.164 format. Got: ${normalizedPhone}`
      };
    }

    logger.info('Phone number normalized for linking', {
      originalPhone: phone,
      normalizedPhone,
      userId
    });

    // Update all guest records with matching phone where user_id IS NULL
    const { data, error } = await supabaseClient
      .from('event_guests')
      .update({ 
        user_id: userId,
        updated_at: new Date().toISOString()
      })
      .eq('phone', normalizedPhone)
      .is('user_id', null)
      .select('id, event_id, guest_name');

    if (error) {
      logger.error('Failed to link guest records', {
        userId,
        phone: normalizedPhone,
        originalPhone: phone,
        error: error.message
      });
      return {
        success: false,
        linkedCount: 0,
        error: `Database error: ${error.message}`
      };
    }

    const linkedCount = data?.length || 0;

    logger.info('Guest record linking completed', {
      userId,
      phone: normalizedPhone,
      originalPhone: phone,
      linkedCount,
      linkedRecords: data
    });

    return {
      success: true,
      linkedCount
    };

  } catch (error) {
    logger.error('Unexpected error during guest record linking', {
      userId,
      phone,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return {
      success: false,
      linkedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Check if a user exists with the given phone number
 * Used during guest import to enable immediate linking
 * 
 * @param phone - Phone number in E.164 format
 * @param useServerClient - Whether to use server-side client
 * @returns User ID if found, null otherwise
 */
export async function findUserByPhone(
  phone: string,
  useServerClient: boolean = false
): Promise<string | null> {
  try {
    const supabaseClient = useServerClient 
      ? createServerComponentClient({ cookies })
      : supabase;

    const { data, error } = await supabaseClient
      .from('users')
      .select('id')
      .eq('phone', phone)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = No rows found (expected for non-existent users)
      logger.error('Error finding user by phone', {
        phone,
        error: error.message
      });
      return null;
    }

    return data?.id || null;

  } catch (error) {
    logger.error('Unexpected error finding user by phone', {
      phone,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return null;
  }
}

/**
 * Get statistics about guest linking for a specific phone number
 * Useful for debugging and monitoring
 * 
 * @param phone - Phone number in E.164 format
 * @returns Statistics about linked vs unlinked guests
 */
export async function getGuestLinkingStats(phone: string): Promise<{
  totalGuests: number;
  linkedGuests: number;
  unlinkedGuests: number;
  linkedToUserId?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('event_guests')
      .select('id, user_id')
      .eq('phone', phone);

    if (error) {
      return { totalGuests: 0, linkedGuests: 0, unlinkedGuests: 0 };
    }

    const totalGuests = data.length;
    const linkedGuests = data.filter(guest => guest.user_id !== null).length;
    const unlinkedGuests = totalGuests - linkedGuests;
    const linkedToUserId = data.find(guest => guest.user_id !== null)?.user_id;

    return {
      totalGuests,
      linkedGuests,
      unlinkedGuests,
      linkedToUserId
    };

  } catch (error) {
    logger.error('Error getting guest linking stats', {
      phone,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return { totalGuests: 0, linkedGuests: 0, unlinkedGuests: 0 };
  }
}