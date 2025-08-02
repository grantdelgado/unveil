/**
 * Simplified Guest Store for MVP
 * 
 * This is a simplified, more stable version of the guest store
 * that prioritizes reliability over advanced features.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { getGuestStatusCounts, normalizeRSVPStatus, type RSVPStatus } from '@/lib/types/rsvp';

// Simplified guest type
interface SimpleGuest {
  id: string;
  event_id: string;
  user_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  phone: string;
  rsvp_status: RSVPStatus | null;
  notes: string | null;
  guest_tags: string[] | null;
  role: string;
  created_at: string | null;
  updated_at: string | null;
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
  maybe: number;
  declined: number;
  pending: number;
  confirmed: number;
  responded: number;
}

interface SimpleGuestStoreReturn {
  guests: SimpleGuest[];
  statusCounts: SimpleGuestStatusCounts;
  loading: boolean;
  error: string | null;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  refreshGuests: () => Promise<void>;
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

  // Calculate status counts from guests array
  const statusCounts = useCallback((guestsList: SimpleGuest[]): SimpleGuestStatusCounts => {
    if (!Array.isArray(guestsList)) {
      return {
        total: 0,
        attending: 0,
        maybe: 0,
        declined: 0,
        pending: 0,
        confirmed: 0,
        responded: 0,
      };
    }

    return getGuestStatusCounts(guestsList);
  }, []);

  // Fetch guests from database
  const fetchGuests = useCallback(async () => {
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

      const { data: guestData, error: guestError } = await supabase
        .from('event_guests')
        .select(`
          id,
          event_id,
          user_id,
          guest_name,
          guest_email,
          phone,
          rsvp_status,
          notes,
          guest_tags,
          role,
          created_at,
          updated_at,
          users!event_guests_user_id_fkey(
            id,
            full_name,
            email,
            phone,
            avatar_url
          )
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

      if (guestError) {
        throw new Error(`Failed to fetch guests: ${guestError.message}`);
      }

      // Process and normalize the data
      const processedGuests = (guestData || []).map(guest => ({
        ...guest,
        rsvp_status: normalizeRSVPStatus(guest.rsvp_status),
        // Ensure phone is a string
        phone: guest.phone || '',
        // Normalize users data
        users: Array.isArray(guest.users) ? guest.users[0] : guest.users,
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

  // Initial fetch on mount and when eventId changes
  useEffect(() => {
    let isMounted = true;
    
    const loadGuests = async () => {
      if (isMounted) {
        await fetchGuests();
      }
    };
    
    loadGuests();
    
    return () => {
      isMounted = false;
    };
  }, [eventId]); // Only depend on eventId, not fetchGuests

  // Set up a simple polling mechanism for updates (every 30 seconds)
  useEffect(() => {
    if (connectionStatus !== 'connected') return;

    const pollInterval = setInterval(() => {
      logger.debug('Polling for guest updates', { eventId });
      // Call fetchGuests directly without dependency
      fetchGuests().catch(console.error);
    }, 30000); // Poll every 30 seconds

    return () => {
      clearInterval(pollInterval);
    };
  }, [connectionStatus]); // Only depend on connectionStatus

  return {
    guests: guests || [], // Ensure never undefined
    statusCounts: statusCounts(guests),
    loading,
    error,
    connectionStatus,
    refreshGuests: fetchGuests,
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