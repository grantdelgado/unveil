import { useState, useCallback, useEffect, useMemo } from 'react';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { useEventSubscription } from '@/hooks/realtime';
import { useDebounce } from '@/hooks/common';
import type { Database } from '@/app/reference/supabase.types';

// Optimized guest type - compatible with existing components  
export type OptimizedGuest = {
  id: string;
  event_id: string;
  user_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  phone: string;
  rsvp_status: string | null;
  notes: string | null;
  guest_tags: string[] | null;
  role: string;
  invited_at: string | null;
  phone_number_verified: boolean | null;
  sms_opt_out: boolean | null;
  preferred_communication: string | null;
  created_at: string | null;
  updated_at: string | null;
  /** 
   * Stored display name (automatically synced with users.full_name)
   */
  display_name: string;
  /** 
   * Computed display name from COALESCE(display_name, users.full_name, guest_name)
   * Prefer this over guest_name for UI display
   * @readonly
   */
  guest_display_name: string;
  // Maintain compatibility with existing components
  users: {
    id: string;
    full_name: string | null;
    phone: string;
    email: string | null;
    avatar_url: string | null;
    created_at: string | null;
    updated_at: string | null;
    intended_redirect: string | null;
    onboarding_completed: boolean;
  } | null;
};

interface UseGuestDataOptions {
  eventId: string;
  onGuestUpdated?: () => void;
  // New pagination options
  pageSize?: number;
  enablePagination?: boolean;
}

interface UseGuestDataReturn {
  guests: OptimizedGuest[];
  loading: boolean;
  error: Error | null;
  fetchData: () => Promise<void>;
  // Pagination controls
  currentPage: number;
  totalCount: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextPage: () => Promise<void>;
  previousPage: () => Promise<void>;
  goToPage: (page: number) => Promise<void>;
  // Existing functionality
  handleRSVPUpdate: (guestId: string, newStatus: string) => Promise<void>;
  handleRemoveGuest: (guestId: string) => Promise<void>;
  handleMarkAllPendingAsAttending: () => Promise<void>;
  handleBulkRSVPUpdate: (guestIds: string[], newStatus: string) => Promise<void>;
  filteredGuests: OptimizedGuest[];
  statusCounts: {
    total: number;
    attending: number;
    pending: number;
    maybe: number;
    declined: number;
  };
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filterByRSVP: string;
  setFilterByRSVP: (filter: string) => void;
}

export function useGuestData({ 
  eventId, 
  onGuestUpdated,
  pageSize = 50, // Default page size optimized for mobile
  enablePagination = true 
}: UseGuestDataOptions): UseGuestDataReturn {
  const [guests, setGuests] = useState<OptimizedGuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterByRSVP, setFilterByRSVP] = useState('all');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Optimized query using RPC function for guest display names
  const fetchGuestsOptimized = useCallback(async (page: number = 1): Promise<{
    data: OptimizedGuest[];
    count: number;
  }> => {
    const offset = enablePagination ? (page - 1) * pageSize : 0;
    const limit = enablePagination ? pageSize : null;

    // Use RPC function to get guests with computed display names
    const { data: guestData, error: guestError } = await supabase
      .rpc('get_event_guests_with_display_names', {
        p_event_id: eventId,
        p_limit: limit ?? undefined,
        p_offset: offset
      });

    if (guestError) throw guestError;

    // Get total count for pagination
    const { count } = await supabase
      .from('event_guests')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId);

    // Transform to optimized format with computed display name
    const optimizedGuests: OptimizedGuest[] = (guestData || []).map(guest => ({
      id: guest.id,
      event_id: guest.event_id,
      user_id: guest.user_id,
      guest_name: guest.guest_name,
      guest_email: guest.guest_email,
      phone: guest.phone,
      rsvp_status: guest.rsvp_status as OptimizedGuest['rsvp_status'],
      notes: guest.notes,
      guest_tags: guest.guest_tags,
      role: guest.role,
      invited_at: guest.invited_at,
      phone_number_verified: guest.phone_number_verified,
      sms_opt_out: guest.sms_opt_out,
      preferred_communication: guest.preferred_communication,
      created_at: guest.created_at,
      updated_at: guest.updated_at,
      // Add stored and computed display names from RPC function
      display_name: guest.display_name,
      guest_display_name: guest.guest_display_name,
      // Maintain compatibility with existing components expecting nested users object
      users: guest.user_id ? {
        id: guest.user_id,
        full_name: guest.user_full_name,
        phone: guest.user_phone || guest.phone,
        email: guest.user_email || guest.guest_email,
        avatar_url: guest.user_avatar_url,
        created_at: guest.user_created_at,
        updated_at: guest.user_updated_at,
        intended_redirect: guest.user_intended_redirect,
        onboarding_completed: guest.user_onboarding_completed || false,
      } : null,
    }));

    return { data: optimizedGuests, count: count || 0 };
  }, [eventId, pageSize, enablePagination]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, count } = await fetchGuestsOptimized(currentPage);
      setGuests(data);
      setTotalCount(count);
    } catch (fetchError) {
      const errorMessage = fetchError instanceof Error ? fetchError : new Error('Failed to fetch guests');
      setError(errorMessage);
      logger.databaseError('Error fetching guests', fetchError);
    } finally {
      setLoading(false);
    }
  }, [fetchGuestsOptimized, currentPage]);

  // Pagination controls
  const totalPages = Math.ceil(totalCount / pageSize);
  const hasNextPage = currentPage < totalPages;
  const hasPreviousPage = currentPage > 1;

  const nextPage = useCallback(async () => {
    if (hasNextPage) {
      setCurrentPage(prev => prev + 1);
    }
  }, [hasNextPage]);

  const previousPage = useCallback(async () => {
    if (hasPreviousPage) {
      setCurrentPage(prev => prev - 1);
    }
  }, [hasPreviousPage]);

  const goToPage = useCallback(async (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  }, [totalPages]);

  // Trigger fetch when page changes
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Optimized real-time subscription using event pooling for better performance
  useEventSubscription({
    eventId,
    table: 'event_guests',
    event: '*',
    enabled: Boolean(eventId),
    performanceOptions: {
      enablePooling: true,
      eventId,
    },
    onDataChange: useCallback(async (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      logger.realtime('Real-time guest update', { 
        eventType: payload.eventType, 
        guestId: payload.new && 'id' in payload.new ? payload.new.id : null 
      });
      
      // Smart refresh: only fetch current page instead of all data
      const { data } = await fetchGuestsOptimized(currentPage);
      setGuests(data);
    }, [fetchGuestsOptimized, currentPage]),
    onError: useCallback((error: Error) => {
      logger.realtimeError('Guest management subscription error', error);
      setError(error);
    }, [])
  });

  // Optimized RSVP update with single query instead of optimistic + revert pattern
  const handleRSVPUpdate = useCallback(async (guestId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('event_guests')
        .update({ rsvp_status: newStatus })
        .eq('id', guestId);

      if (error) throw error;
      
      // Update local state efficiently
      setGuests(prev => 
        prev.map(guest => 
          guest.id === guestId 
            ? { ...guest, rsvp_status: newStatus as OptimizedGuest['rsvp_status'] }
            : guest
        )
      );
      
      onGuestUpdated?.();
    } catch (updateError) {
      logger.databaseError('Error updating RSVP', updateError);
      throw updateError;
    }
  }, [onGuestUpdated]);

  const handleRemoveGuest = useCallback(async (guestId: string) => {
    try {
      const { error } = await supabase
        .from('event_guests')
        .delete()
        .eq('id', guestId);

      if (error) throw error;
      
      // Remove from local state
      setGuests(prev => prev.filter(guest => guest.id !== guestId));
      setTotalCount(prev => prev - 1);
      
      onGuestUpdated?.();
    } catch (removeError) {
      logger.databaseError('Error removing guest', removeError);
      throw removeError;
    }
  }, [onGuestUpdated]);

  // Optimized bulk operations using single UPDATE query instead of multiple
  const handleMarkAllPendingAsAttending = useCallback(async () => {
    const pendingGuests = guests.filter(guest => guest.rsvp_status === 'pending');
    if (pendingGuests.length === 0) return;

    try {
      // Single bulk update query instead of multiple individual updates
      const { error } = await supabase
        .from('event_guests')
        .update({ rsvp_status: 'attending' })
        .eq('event_id', eventId)
        .eq('rsvp_status', 'pending');

      if (error) throw error;
      
      // Update local state
      setGuests(prev => 
        prev.map(guest => 
          guest.rsvp_status === 'pending' 
            ? { ...guest, rsvp_status: 'attending' }
            : guest
        )
      );
      
      onGuestUpdated?.();
    } catch (bulkError) {
      logger.databaseError('Error updating pending RSVPs', bulkError);
      throw bulkError;
    }
  }, [guests, eventId, onGuestUpdated]);

  const handleBulkRSVPUpdate = useCallback(async (guestIds: string[], newStatus: string) => {
    try {
      // Single bulk update query instead of multiple individual updates
      const { error } = await supabase
        .from('event_guests')
        .update({ rsvp_status: newStatus })
        .in('id', guestIds);

      if (error) throw error;
      
      // Update local state
      setGuests(prev => 
        prev.map(guest => 
          guestIds.includes(guest.id)
            ? { ...guest, rsvp_status: newStatus as OptimizedGuest['rsvp_status'] }
            : guest
        )
      );
      
      onGuestUpdated?.();
    } catch (bulkError) {
      logger.databaseError('Error updating RSVPs', bulkError);
      throw bulkError;
    }
  }, [onGuestUpdated]);

  // Enhanced filtering with memoization
  const filteredGuests = useMemo(() => {
    return guests.filter(guest => {
      const displayName = guest.users?.full_name || guest.guest_name || '';
      const matchesSearch = !debouncedSearchTerm || 
        displayName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        guest.phone.includes(debouncedSearchTerm) ||
        guest.users?.phone?.includes(debouncedSearchTerm);

      const matchesRSVP = filterByRSVP === 'all' || guest.rsvp_status === filterByRSVP;
      return matchesSearch && matchesRSVP;
    });
  }, [guests, debouncedSearchTerm, filterByRSVP]);

  // Status counts with memoization
  const statusCounts = useMemo(() => ({
    total: totalCount, // Use actual total count from database
    attending: guests.filter(guest => guest.rsvp_status === 'attending').length,
    pending: guests.filter(guest => guest.rsvp_status === 'pending').length,
    maybe: guests.filter(guest => guest.rsvp_status === 'maybe').length,
    declined: guests.filter(guest => guest.rsvp_status === 'declined').length,
  }), [guests, totalCount]);

  return {
    guests,
    loading,
    error,
    fetchData,
    // Pagination
    currentPage,
    totalCount,
    hasNextPage,
    hasPreviousPage,
    nextPage,
    previousPage,
    goToPage,
    // Existing functionality
    handleRSVPUpdate,
    handleRemoveGuest,
    handleMarkAllPendingAsAttending,
    handleBulkRSVPUpdate,
    filteredGuests,
    statusCounts,
    searchTerm,
    setSearchTerm,
    filterByRSVP,
    setFilterByRSVP,
  };
}