import { useState, useCallback, useEffect, useMemo } from 'react';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { useRealtimeSubscription } from '@/hooks/realtime';
import { useDebounce } from '@/hooks/common';
import type { Database } from '@/app/reference/supabase.types';

type Guest = Database['public']['Tables']['event_guests']['Row'] & {
  users: Database['public']['Tables']['users']['Row'] | null;
};

interface UseGuestDataOptions {
  eventId: string;
  onGuestUpdated?: () => void;
}

interface UseGuestDataReturn {
  guests: Guest[];
  loading: boolean;
  error: Error | null;
  fetchData: () => Promise<void>;
  handleRSVPUpdate: (guestId: string, newStatus: string) => Promise<void>;
  handleRemoveGuest: (guestId: string) => Promise<void>;
  handleMarkAllPendingAsAttending: () => Promise<void>;
  handleBulkRSVPUpdate: (guestIds: string[], newStatus: string) => Promise<void>;
  filteredGuests: Guest[];
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

export function useGuestData({ eventId, onGuestUpdated }: UseGuestDataOptions): UseGuestDataReturn {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterByRSVP, setFilterByRSVP] = useState('all');
  
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: guestData, error: guestError } = await supabase
        .from('event_guests')
        .select(`
          *,
          users:user_id(*)
        `)
        .eq('event_id', eventId);

      if (guestError) throw guestError;
      setGuests(guestData || []);
    } catch (fetchError) {
      const errorMessage = fetchError instanceof Error ? fetchError : new Error('Failed to fetch guests');
      setError(errorMessage);
      logger.databaseError('Error fetching guests', fetchError);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  // Set up real-time subscription
  useRealtimeSubscription({
    subscriptionId: `guest-management-${eventId}`,
    table: 'event_guests',
    event: '*',
    filter: `event_id=eq.${eventId}`,
    enabled: Boolean(eventId),
    onDataChange: useCallback(async (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      logger.realtime('Real-time guest update', { eventType: payload.eventType, guestId: payload.new?.id });
      await fetchData();
    }, [fetchData]),
    onError: useCallback((error: Error) => {
      logger.realtimeError('Guest management subscription error', error);
      setError(error);
    }, [])
  });

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRSVPUpdate = useCallback(async (guestId: string, newStatus: string) => {
    try {
      // Optimistic update
      setGuests(prev => 
        prev.map(guest => 
          guest.id === guestId 
            ? { ...guest, rsvp_status: newStatus as 'attending' | 'declined' | 'maybe' | 'pending' }
            : guest
        )
      );

      const { error } = await supabase
        .from('event_guests')
        .update({ rsvp_status: newStatus })
        .eq('id', guestId);

      if (error) throw error;
      
      onGuestUpdated?.();
    } catch (updateError) {
      logger.databaseError('Error updating RSVP', updateError);
      // Revert optimistic update on error
      await fetchData();
      throw updateError;
    }
  }, [fetchData, onGuestUpdated]);

  const handleRemoveGuest = useCallback(async (guestId: string) => {
    try {
      const { error } = await supabase
        .from('event_guests')
        .delete()
        .eq('id', guestId);

      if (error) throw error;
      await fetchData();
      onGuestUpdated?.();
    } catch (removeError) {
      logger.databaseError('Error removing guest', removeError);
      throw removeError;
    }
  }, [fetchData, onGuestUpdated]);

  const handleMarkAllPendingAsAttending = useCallback(async () => {
    const pendingGuests = guests.filter(guest => guest.rsvp_status === 'pending');
    if (pendingGuests.length === 0) return;

    try {
      const operations = pendingGuests.map(guest =>
        supabase
          .from('event_guests')
          .update({ rsvp_status: 'attending' })
          .eq('id', guest.id)
      );

      await Promise.all(operations);
      await fetchData();
      onGuestUpdated?.();
    } catch (bulkError) {
      logger.databaseError('Error updating pending RSVPs', bulkError);
      throw bulkError;
    }
  }, [guests, fetchData, onGuestUpdated]);

  const handleBulkRSVPUpdate = useCallback(async (guestIds: string[], newStatus: string) => {
    try {
      const operations = guestIds.map(guestId =>
        supabase
          .from('event_guests')
          .update({ rsvp_status: newStatus })
          .eq('id', guestId)
      );

      await Promise.all(operations);
      await fetchData();
      onGuestUpdated?.();
    } catch (bulkError) {
      logger.databaseError('Error updating RSVPs', bulkError);
      throw bulkError;
    }
  }, [fetchData, onGuestUpdated]);

  // Enhanced filtering with memoization
  const filteredGuests = useMemo(() => {
    return guests.filter(guest => {
      const matchesSearch = !debouncedSearchTerm || 
        guest.users?.full_name?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        guest.guest_name?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        guest.users?.id?.includes(debouncedSearchTerm);

      const matchesRSVP = filterByRSVP === 'all' || guest.rsvp_status === filterByRSVP;
      return matchesSearch && matchesRSVP;
    });
  }, [guests, debouncedSearchTerm, filterByRSVP]);

  // Status counts with memoization
  const statusCounts = useMemo(() => ({
    total: guests.length,
    attending: guests.filter(guest => guest.rsvp_status === 'attending').length,
    pending: guests.filter(guest => guest.rsvp_status === 'pending').length,
    maybe: guests.filter(guest => guest.rsvp_status === 'maybe').length,
    declined: guests.filter(guest => guest.rsvp_status === 'declined').length,
  }), [guests]);

  return {
    guests,
    loading,
    error,
    fetchData,
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