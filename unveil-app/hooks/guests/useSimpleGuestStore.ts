/**
 * Simplified Guest Store for MVP
 * 
 * This is a simplified, more stable version of the guest store
 * that prioritizes reliability over advanced features.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { createEventRequestManager } from '@/lib/utils/requestThrottling';
import { calculateAttendanceCounts } from '@/lib/guests/attendance';

// Simplified guest type that matches the get_event_guests_with_display_names RPC function
interface SimpleGuest {
  id: string;
  event_id: string;
  user_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  phone: string | null;
  rsvp_status: string | null;
  notes: string | null;
  guest_tags: string[] | null;
  role: string;
  // Invitation tracking fields
  invited_at: string | null;
  last_invited_at: string | null;
  first_invited_at: string | null;
  last_messaged_at: string | null;
  invite_attempts: number | null;
  joined_at: string | null;
  // RSVP-Lite fields
  declined_at: string | null;
  decline_reason: string | null;
  removed_at: string | null;
  phone_number_verified: boolean | null;
  sms_opt_out: boolean | null;
  preferred_communication: string | null;
  created_at: string | null;
  updated_at: string | null;
  /** Computed display name from COALESCE(users.full_name, event_guests.guest_name) */
  guest_display_name: string;
  // User fields from the join
  user_full_name: string | null;
  user_email: string | null;
  user_phone: string | null;
  user_avatar_url: string | null;
  user_created_at: string | null;
  user_updated_at: string | null;
  user_intended_redirect: string | null;
  user_onboarding_completed: boolean | null;
  // Legacy users object for backward compatibility
  users?: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    avatar_url: string | null;
  } | null;
}

interface SimpleGuestStatusCounts {
  total: number;
  attending: number;
  declined: number;
}

interface SimpleGuestStoreReturn {
  guests: SimpleGuest[];
  statusCounts: SimpleGuestStatusCounts;
  loading: boolean;
  error: string | null;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  refreshGuests: () => Promise<void>;
  updateGuestOptimistically: (guestId: string, updates: Partial<SimpleGuest>) => void;
  rollbackOptimisticUpdate: (guestId: string) => void;
}

/**
 * Simplified guest store with reliable data fetching
 * Prioritizes stability over real-time features for MVP
 */
export function useSimpleGuestStore(eventId: string): SimpleGuestStoreReturn {
  const [guests, setGuests] = useState<SimpleGuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [guestSnapshots, setGuestSnapshots] = useState<Map<string, SimpleGuest>>(new Map());

  // Calculate status counts from guests array
  const statusCounts = useCallback((guestsList: SimpleGuest[]): SimpleGuestStatusCounts => {
    if (!Array.isArray(guestsList)) {
      return {
        total: 0,
        attending: 0,
        declined: 0,
      };
    }

    return calculateAttendanceCounts(guestsList);
  }, []);

  // Fetch guests from database (core function without throttling)
  const fetchGuestsCore = useCallback(async () => {
    if (!eventId) {
      logger.warn('useSimpleGuestStore: No eventId provided');
      setGuests([]);
      setLoading(false);
      setConnectionStatus('error');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setConnectionStatus('connecting');

      logger.info('Fetching guests for event', { eventId });

      // Use RPC function to get guests with computed display names
      const { data: guestData, error: guestError } = await supabase
        .rpc('get_event_guests_with_display_names', {
          p_event_id: eventId,
          p_limit: undefined,
          p_offset: 0
        });

      if (guestError) {
        throw new Error(`Failed to fetch guests: ${guestError.message}`);
      }

      // Process and normalize the data - now matches the RPC function exactly
      const processedGuests = (guestData || []).map(guest => ({
        // Map all fields from the RPC function
        id: guest.id,
        event_id: guest.event_id,
        user_id: guest.user_id,
        guest_name: guest.guest_name,
        guest_email: guest.guest_email,
        phone: guest.phone,
        rsvp_status: guest.rsvp_status,
        notes: guest.notes,
        guest_tags: guest.guest_tags,
        role: guest.role,
        // Invitation tracking fields
        invited_at: guest.invited_at,
        last_invited_at: guest.last_invited_at,
        first_invited_at: guest.first_invited_at,
        last_messaged_at: guest.last_messaged_at,
        invite_attempts: guest.invite_attempts,
        joined_at: guest.joined_at,
        // RSVP-Lite fields
        declined_at: guest.declined_at,
        decline_reason: guest.decline_reason,
        removed_at: guest.removed_at,
        phone_number_verified: guest.phone_number_verified,
        sms_opt_out: guest.sms_opt_out,
        preferred_communication: guest.preferred_communication,
        created_at: guest.created_at,
        updated_at: guest.updated_at,
        // Computed display name
        guest_display_name: guest.guest_display_name,
        // User fields from the join
        user_full_name: guest.user_full_name,
        user_email: guest.user_email,
        user_phone: guest.user_phone,
        user_avatar_url: guest.user_avatar_url,
        user_created_at: guest.user_created_at,
        user_updated_at: guest.user_updated_at,
        user_intended_redirect: guest.user_intended_redirect,
        user_onboarding_completed: guest.user_onboarding_completed,
        // Legacy users object for backward compatibility
        users: guest.user_id ? {
          id: guest.user_id,
          full_name: guest.user_full_name,
          email: guest.user_email || guest.guest_email,
          phone: guest.user_phone || guest.phone,
          avatar_url: guest.user_avatar_url,
        } : null,
      })) as SimpleGuest[];

      setGuests(processedGuests);
      setConnectionStatus('connected');
      setError(null);

      logger.info('Successfully fetched guests', { 
        eventId, 
        count: processedGuests.length 
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      logger.error('Error fetching guests', { eventId, error: errorMessage });
      
      setError(errorMessage);
      setConnectionStatus('error');
      setGuests([]); // Set to empty array to prevent undefined issues
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  // Create request manager for this event
  const requestManager = useMemo(() => createEventRequestManager(eventId), [eventId]);

  // Throttled version of fetchGuests
  const fetchGuests = useMemo(
    () => requestManager.throttledFetch(fetchGuestsCore),
    [requestManager, fetchGuestsCore]
  );

  // Initial fetch on mount and when eventId changes
  useEffect(() => {
    let isMounted = true;
    
    const loadGuests = async () => {
      if (isMounted) {
        await fetchGuestsCore();
      }
    };
    
    loadGuests();
    
    return () => {
      isMounted = false;
    };
  }, [eventId]); // Only depend on eventId, not fetchGuests

  // Set up a very conservative polling mechanism (only every 5 minutes when needed)
  useEffect(() => {
    if (connectionStatus !== 'connected') return;

    const pollInterval = setInterval(() => {
      // Only poll if the tab is visible and hasn't been updated recently
      if (document.visibilityState === 'visible') {
        const lastUpdate = localStorage.getItem(`guest-last-update-${eventId}`);
        const now = Date.now();
        const shouldPoll = !lastUpdate || (now - parseInt(lastUpdate)) > 300000; // 5 minutes
        
        if (shouldPoll) {
          logger.debug('🛠️ Polling for guest updates', { eventId });
          fetchGuests();
          localStorage.setItem(`guest-last-update-${eventId}`, now.toString());
        }
      }
    }, 300000); // Poll every 5 minutes instead of 2 minutes

    return () => {
      clearInterval(pollInterval);
    };
  }, [connectionStatus, fetchGuests]); // Use throttled version

  // Optimistic update function for immediate UI feedback
  const updateGuestOptimistically = useCallback((guestId: string, updates: Partial<SimpleGuest>) => {
    setGuests(prevGuests => {
      // Find and store snapshot of original guest before updating
      const originalGuest = prevGuests.find(g => g.id === guestId);
      if (originalGuest) {
        setGuestSnapshots(prev => new Map(prev).set(guestId, originalGuest));
      }
      
      return prevGuests.map(guest => 
        guest.id === guestId 
          ? { ...guest, ...updates }
          : guest
      );
    });
  }, []);

  // Rollback function to revert optimistic updates
  const rollbackOptimisticUpdate = useCallback((guestId: string) => {
    setGuestSnapshots(prevSnapshots => {
      const snapshot = prevSnapshots.get(guestId);
      if (snapshot) {
        setGuests(prevGuests => 
          prevGuests.map(guest => 
            guest.id === guestId ? snapshot : guest
          )
        );
        // Remove snapshot after rollback
        const newSnapshots = new Map(prevSnapshots);
        newSnapshots.delete(guestId);
        return newSnapshots;
      }
      return prevSnapshots;
    });
  }, []);

  return {
    guests: guests || [], // Ensure never undefined
    statusCounts: statusCounts(guests),
    loading,
    error,
    connectionStatus,
    refreshGuests: fetchGuestsCore,
    updateGuestOptimistically,
    rollbackOptimisticUpdate,
  };
}

/**
 * Hook for components that only need guest list data
 */
export function useSimpleGuestList(eventId: string) {
  const { guests, loading, error, refreshGuests } = useSimpleGuestStore(eventId);
  
  return {
    guests: guests || [],
    loading,
    error,
    refresh: refreshGuests,
  };
}

/**
 * Hook for components that only need status counts
 */
export function useSimpleGuestStatusCounts(eventId: string) {
  const { statusCounts, loading, error } = useSimpleGuestStore(eventId);
  
  return {
    statusCounts,
    loading,
    error,
  };
}