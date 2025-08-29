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
import { GuestsFlags } from '@/lib/config/guests';

// Simplified guest type that matches the get_event_guests_with_display_names RPC function
interface SimpleGuest {
  id: string;
  event_id: string;
  user_id: string | null;
  guest_name: string | null;
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
  updateGuestOptimistically: (
    guestId: string,
    updates: Partial<SimpleGuest>,
  ) => void;
  rollbackOptimisticUpdate: (guestId: string) => void;
  // Pagination state and controls
  currentPage: number;
  hasMore: boolean;
  isPaging: boolean;
  loadNextPage: () => Promise<void>;
}

/**
 * Simplified guest store with reliable data fetching
 * Prioritizes stability over real-time features for MVP
 */
export function useSimpleGuestStore(eventId: string): SimpleGuestStoreReturn {
  const [guests, setGuests] = useState<SimpleGuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    'connecting' | 'connected' | 'disconnected' | 'error'
  >('connecting');
  const [guestSnapshots, setGuestSnapshots] = useState<
    Map<string, SimpleGuest>
  >(new Map());
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isPaging, setIsPaging] = useState(false);

  // Calculate status counts from guests array
  const statusCounts = useCallback(
    (guestsList: SimpleGuest[]): SimpleGuestStatusCounts => {
      if (!Array.isArray(guestsList)) {
        return {
          total: 0,
          attending: 0,
          declined: 0,
        };
      }

      return calculateAttendanceCounts(guestsList);
    },
    [],
  );

  // Fetch guests from database with pagination support
  const fetchGuestsCore = useCallback(async (page: number = 1, isAppending: boolean = false) => {
    if (!eventId) {
      logger.warn('useSimpleGuestStore: No eventId provided');
      setGuests([]);
      setLoading(false);
      setConnectionStatus('error');
      return;
    }

    try {
      if (!isAppending) {
        setLoading(true);
      } else {
        setIsPaging(true);
      }
      setError(null);
      setConnectionStatus('connecting');

      // Compute pagination parameters based on feature flag
      const limit = GuestsFlags.paginationEnabled ? GuestsFlags.pageSize : null;
      const offset = GuestsFlags.paginationEnabled ? (page - 1) * GuestsFlags.pageSize : 0;

      logger.info('Fetching guests for event', { 
        eventId, 
        page, 
        limit, 
        offset, 
        paginationEnabled: GuestsFlags.paginationEnabled 
      });

      // Use RPC function to get guests with computed display names
      const { data: guestData, error: guestError } = await supabase.rpc(
        'get_event_guests_with_display_names',
        {
          p_event_id: eventId,
          p_limit: limit ?? undefined,
          p_offset: offset,
        },
      );

      if (guestError) {
        throw new Error(`Failed to fetch guests: ${guestError.message}`);
      }

      // Process and normalize the data - now matches the RPC function exactly
      const processedGuests = (guestData || []).map((guest) => ({
        // Map all fields from the RPC function
        id: guest.id,
        event_id: guest.event_id,
        user_id: guest.user_id,
        guest_name: guest.guest_name,
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
        user_phone: guest.user_phone,
        user_avatar_url: guest.user_avatar_url,
        user_created_at: guest.user_created_at,
        user_updated_at: guest.user_updated_at,
        user_intended_redirect: guest.user_intended_redirect,
        user_onboarding_completed: guest.user_onboarding_completed,
        // Legacy users object for backward compatibility
        users: guest.user_id
          ? {
              id: guest.user_id,
              full_name: guest.user_full_name,
              phone: guest.user_phone || guest.phone,
              avatar_url: guest.user_avatar_url,
            }
          : null,
      })) as SimpleGuest[];

      // Handle pagination state and guest list management
      if (isAppending && page > 1) {
        // Append new guests, deduplicating by ID
        setGuests(prevGuests => {
          const existingIds = new Set(prevGuests.map(g => g.id));
          const newGuests = processedGuests.filter(g => !existingIds.has(g.id));
          return [...prevGuests, ...newGuests];
        });
      } else {
        // Replace guests (first page or refresh)
        setGuests(processedGuests);
        setCurrentPage(1);
      }

      // Update pagination state based on feature flag
      if (GuestsFlags.paginationEnabled) {
        const receivedCount = processedGuests.length;
        setHasMore(receivedCount === GuestsFlags.pageSize);
        setCurrentPage(page);
        
        // Debug logging for pagination (dev only)
        if (process.env.NODE_ENV === 'development') {
          logger.debug('guests.pagination', {
            page,
            pageSize: GuestsFlags.pageSize,
            received: receivedCount,
            hasMore: receivedCount === GuestsFlags.pageSize,
          });
        }
      } else {
        // Non-paginated mode: no more pages
        setHasMore(false);
        setCurrentPage(1);
      }

      setConnectionStatus('connected');
      setError(null);

      logger.info('Successfully fetched guests', {
        eventId,
        page,
        count: processedGuests.length,
        totalInStore: isAppending ? 'appending' : processedGuests.length,
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error occurred';
      logger.error('Error fetching guests', { eventId, page, error: errorMessage });

      setError(errorMessage);
      setConnectionStatus('error');
      
      // Don't clear guests on pagination errors, only on initial load errors
      if (!isAppending) {
        setGuests([]);
        setCurrentPage(1);
        setHasMore(false);
      }
    } finally {
      if (!isAppending) {
        setLoading(false);
      } else {
        setIsPaging(false);
      }
    }
  }, [eventId]);

  // Create request manager for this event
  const requestManager = useMemo(
    () => createEventRequestManager(eventId),
    [eventId],
  );

  // Throttled version of fetchGuests for initial load
  const fetchGuests = useMemo(
    () => requestManager.throttledFetch((page = 1, isAppending = false) => fetchGuestsCore(page, isAppending)),
    [requestManager, fetchGuestsCore],
  );

  // Load next page function for infinite scroll
  const loadNextPage = useCallback(async () => {
    if (!GuestsFlags.paginationEnabled || !hasMore || isPaging || loading) {
      return;
    }

    const nextPage = currentPage + 1;
    logger.info('Loading next page', { eventId, currentPage, nextPage });
    
    try {
      await fetchGuestsCore(nextPage, true);
    } catch (error) {
      logger.error('Failed to load next page', { eventId, nextPage, error });
    }
  }, [eventId, currentPage, hasMore, isPaging, loading, fetchGuestsCore]);

  // Initial fetch on mount and when eventId changes
  useEffect(() => {
    let isMounted = true;

    const loadGuests = async () => {
      if (isMounted) {
        // Reset pagination state on eventId change
        setCurrentPage(1);
        setHasMore(true);
        setIsPaging(false);
        await fetchGuestsCore(1, false);
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
        const shouldPoll = !lastUpdate || now - parseInt(lastUpdate) > 300000; // 5 minutes

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
  const updateGuestOptimistically = useCallback(
    (guestId: string, updates: Partial<SimpleGuest>) => {
      setGuests((prevGuests) => {
        // Find and store snapshot of original guest before updating
        const originalGuest = prevGuests.find((g) => g.id === guestId);
        if (originalGuest) {
          setGuestSnapshots((prev) =>
            new Map(prev).set(guestId, originalGuest),
          );
        }

        return prevGuests.map((guest) =>
          guest.id === guestId ? { ...guest, ...updates } : guest,
        );
      });
    },
    [],
  );

  // Rollback function to revert optimistic updates
  const rollbackOptimisticUpdate = useCallback((guestId: string) => {
    setGuestSnapshots((prevSnapshots) => {
      const snapshot = prevSnapshots.get(guestId);
      if (snapshot) {
        setGuests((prevGuests) =>
          prevGuests.map((guest) => (guest.id === guestId ? snapshot : guest)),
        );
        // Remove snapshot after rollback
        const newSnapshots = new Map(prevSnapshots);
        newSnapshots.delete(guestId);
        return newSnapshots;
      }
      return prevSnapshots;
    });
  }, []);

  // Refresh function that resets pagination
  const refreshGuests = useCallback(async () => {
    setCurrentPage(1);
    setHasMore(true);
    setIsPaging(false);
    await fetchGuestsCore(1, false);
  }, [fetchGuestsCore]);

  return {
    guests: guests || [], // Ensure never undefined
    statusCounts: statusCounts(guests),
    loading,
    error,
    connectionStatus,
    refreshGuests,
    updateGuestOptimistically,
    rollbackOptimisticUpdate,
    // Pagination state and controls
    currentPage,
    hasMore,
    isPaging,
    loadNextPage,
  };
}

/**
 * Hook for components that only need guest list data
 */
export function useSimpleGuestList(eventId: string) {
  const { guests, loading, error, refreshGuests } =
    useSimpleGuestStore(eventId);

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
