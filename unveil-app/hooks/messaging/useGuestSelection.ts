'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { GuestWithDisplayName } from '@/lib/types/messaging';

export interface UseGuestSelectionOptions {
  eventId: string;
  searchQuery?: string;
  debounceMs?: number;
}

export interface UseGuestSelectionReturn {
  // Guest data
  allGuests: GuestWithDisplayName[];
  eligibleGuests: GuestWithDisplayName[];
  filteredGuests: GuestWithDisplayName[];
  
  // Selection state
  selectedGuestIds: string[];
  
  // Computed counts
  totalSelected: number;
  willReceiveMessage: number; // Guests with valid delivery channels
  
  // Actions
  toggleGuestSelection: (guestId: string) => void;
  selectAllEligible: () => void;
  clearAllSelection: () => void;
  setSearchQuery: (query: string) => void;
  
  // Loading/error states
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for managing explicit guest selection in the message composer
 * Replaces RSVP-based filtering with direct per-guest selection
 */
export function useGuestSelection({
  eventId,
  searchQuery = '',
  debounceMs = 300
}: UseGuestSelectionOptions): UseGuestSelectionReturn {
  
  // Core state
  const [allGuests, setAllGuests] = useState<GuestWithDisplayName[]>([]);
  const [selectedGuestIds, setSelectedGuestIds] = useState<string[]>([]);
  const [internalSearchQuery, setInternalSearchQuery] = useState(searchQuery);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch all guests for the event with computed display names
   */
  const fetchGuests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: guests, error: guestsError } = await supabase
        .from('event_guests')
        .select(`
          id,
          guest_name,
          phone,
          guest_email,
          guest_tags,
          declined_at,
          rsvp_status,
          display_name,
          sms_opt_out,
          users (
            id,
            full_name,
            phone,
            email
          )
        `)
        .eq('event_id', eventId)
        .order('guest_name', { ascending: true });

      if (guestsError) throw guestsError;

      // Transform to GuestWithDisplayName format
      const transformedGuests: GuestWithDisplayName[] = (guests || []).map(guest => {
        const displayName = guest.display_name || 
                          guest.guest_name || 
                          guest.users?.full_name || 
                          'Unnamed Guest';
        
        // For authenticated users, check users.phone; for non-authenticated guests, check guest.phone
        const effectivePhone = guest.users?.phone || guest.phone;
        const hasValidPhone = !!(effectivePhone && effectivePhone.trim());
        const isOptedOut = !!guest.sms_opt_out;

        return {
          ...guest,
          displayName,
          hasValidPhone,
          isOptedOut
        } as GuestWithDisplayName;
      });

      setAllGuests(transformedGuests);

      // Auto-select all eligible guests on first load (if no selection exists), excluding opted-out
      if (selectedGuestIds.length === 0) {
        const eligibleGuestIds = transformedGuests
          .filter(guest => !guest.declined_at && !guest.sms_opt_out)
          .map(guest => guest.id);
        setSelectedGuestIds(eligibleGuestIds);
      }

    } catch (err) {
      console.error('Error fetching guests:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch guests');
    } finally {
      setLoading(false);
    }
  }, [eventId, selectedGuestIds.length]);

  /**
   * Derived data - eligible guests (declined_at IS NULL)
   */
  const eligibleGuests = useMemo(() => {
    return allGuests.filter(guest => !guest.declined_at);
  }, [allGuests]);

  /**
   * Derived data - filtered guests based on search
   */
  const filteredGuests = useMemo(() => {
    if (!internalSearchQuery.trim()) {
      return eligibleGuests;
    }

    const query = internalSearchQuery.toLowerCase().trim();
    return eligibleGuests.filter(guest => {
      const searchableText = [
        guest.displayName,
        guest.guest_name,
        guest.guest_email,
        guest.users?.full_name,
        ...(guest.guest_tags || [])
      ].filter(Boolean).join(' ').toLowerCase();

      return searchableText.includes(query);
    });
  }, [eligibleGuests, internalSearchQuery]);

  /**
   * Computed counts
   */
  const totalSelected = selectedGuestIds.length;
  
  const willReceiveMessage = useMemo(() => {
    return allGuests.filter(guest => 
      selectedGuestIds.includes(guest.id) && guest.hasValidPhone && !guest.isOptedOut
    ).length;
  }, [allGuests, selectedGuestIds]);

  /**
   * Toggle individual guest selection
   */
  const toggleGuestSelection = useCallback((guestId: string) => {
    setSelectedGuestIds(prev => {
      const newSelection = prev.includes(guestId) 
        ? prev.filter(id => id !== guestId)
        : [...prev, guestId];
      
      // Analytics: Track selection changes
      console.log('composer_selection_changed', {
        event_id: eventId,
        guest_id: guestId,
        action: prev.includes(guestId) ? 'deselect' : 'select',
        selected_count: newSelection.length
      });
      
      return newSelection;
    });
  }, [eventId]);

  /**
   * Select all eligible guests (excluding opted-out)
   */
  const selectAllEligible = useCallback(() => {
    const eligibleIds = eligibleGuests
      .filter(guest => !guest.isOptedOut)
      .map(guest => guest.id);
    setSelectedGuestIds(eligibleIds);
    
    // Analytics: Track select all
    console.log('composer_select_all', {
      event_id: eventId,
      selected_count: eligibleIds.length
    });
  }, [eligibleGuests, eventId]);

  /**
   * Clear all selection
   */
  const clearAllSelection = useCallback(() => {
    setSelectedGuestIds([]);
    
    // Analytics: Track clear all
    console.log('composer_clear_all', {
      event_id: eventId
    });
  }, [eventId]);

  /**
   * Update search query with debouncing
   */
  const setSearchQuery = useCallback((query: string) => {
    setInternalSearchQuery(query);
  }, []);

  /**
   * Manual refresh
   */
  const refresh = useCallback(async () => {
    await fetchGuests();
  }, [fetchGuests]);

  // Initial fetch
  useEffect(() => {
    if (eventId) {
      fetchGuests();
    }
  }, [eventId, fetchGuests]);

  // Set up real-time subscription for guest updates
  useEffect(() => {
    if (!eventId) return;

    const subscription = supabase
      .channel(`guest_selection:${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_guests',
          filter: `event_id=eq.${eventId}`
        },
        (payload) => {
          console.log('Guest data updated for selection:', payload);
          // Refresh guest data when changes occur
          fetchGuests();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [eventId, fetchGuests]);

  return {
    allGuests,
    eligibleGuests,
    filteredGuests,
    selectedGuestIds,
    totalSelected,
    willReceiveMessage,
    toggleGuestSelection,
    selectAllEligible,
    clearAllSelection,
    setSearchQuery,
    loading,
    error,
    refresh
  };
}
