'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useMessagingRecipients } from './useMessagingRecipients';
import type { GuestWithDisplayName } from '@/lib/types/messaging';

export interface UseGuestSelectionOptions {
  eventId: string;
  searchQuery?: string;
  debounceMs?: number;
  preselectionPreset?: string | null;
  preselectedGuestIds?: string[];
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
  debounceMs = 300,
  preselectionPreset,
  preselectedGuestIds
}: UseGuestSelectionOptions): UseGuestSelectionReturn {
  
  // Core state
  const [selectedGuestIds, setSelectedGuestIds] = useState<string[]>([]);
  const [internalSearchQuery, setInternalSearchQuery] = useState(searchQuery);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);

  // Use unified messaging recipients hook for canonical scope consistency
  const { recipients, loading, error, refresh } = useMessagingRecipients(eventId);

  // Transform recipients to GuestWithDisplayName format for compatibility
  const allGuests: GuestWithDisplayName[] = useMemo(() => {
    return recipients.map(recipient => ({
      id: recipient.event_guest_id,
      guest_name: recipient.guest_name,
      guest_email: recipient.guest_email,
      phone: recipient.phone,
      guest_tags: recipient.guest_tags,
      declined_at: recipient.declined_at,
      rsvp_status: recipient.declined_at ? 'declined' : 'attending', // RSVP-Lite logic
      display_name: recipient.guest_display_name,
      sms_opt_out: recipient.sms_opt_out,
      role: recipient.role,
      invited_at: recipient.invited_at,
      last_invited_at: null, // Not needed for messaging
      invite_attempts: null, // Not needed for messaging
      joined_at: null, // Not needed for messaging
      users: recipient.user_full_name ? {
        id: '', // Not needed for messaging
        full_name: recipient.user_full_name,
        phone: recipient.user_phone,
        email: recipient.user_email
      } : null,
      displayName: recipient.guest_display_name,
      hasValidPhone: recipient.has_valid_phone,
      isOptedOut: recipient.sms_opt_out
    }));
  }, [recipients]);

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
    setHasUserInteracted(true);
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
    setHasUserInteracted(true);
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
    setHasUserInteracted(true);
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

  // Handle preselection or auto-select all eligible guests on first load
  useEffect(() => {
    if (allGuests.length > 0 && selectedGuestIds.length === 0 && !hasUserInteracted) {
      let guestIdsToSelect: string[] = [];

      if (preselectionPreset && preselectionPreset !== 'custom') {
        // Handle preset-based selection
        switch (preselectionPreset) {
          case 'not_invited':
            guestIdsToSelect = allGuests
              .filter(guest => 
                !guest.invited_at && 
                !guest.joined_at && 
                !guest.declined_at && 
                !guest.sms_opt_out &&
                guest.role !== 'host'
              )
              .map(guest => guest.id);
            break;
          case 'invited':
            guestIdsToSelect = allGuests
              .filter(guest => 
                guest.invited_at && 
                !guest.joined_at && 
                !guest.declined_at && 
                !guest.sms_opt_out
              )
              .map(guest => guest.id);
            break;

          default:
            // Default to all eligible
            guestIdsToSelect = allGuests
              .filter(guest => !guest.declined_at && !guest.sms_opt_out)
              .map(guest => guest.id);
        }
      } else if (preselectedGuestIds && preselectedGuestIds.length > 0) {
        // Handle explicit guest ID selection
        guestIdsToSelect = preselectedGuestIds.filter(id => 
          allGuests.some(guest => guest.id === id && !guest.declined_at && !guest.sms_opt_out)
        );
      } else {
        // Default: auto-select all eligible guests
        guestIdsToSelect = allGuests
          .filter(guest => !guest.declined_at && !guest.sms_opt_out)
          .map(guest => guest.id);
      }

      if (guestIdsToSelect.length > 0) {
        setSelectedGuestIds(guestIdsToSelect);
      }
    }
  }, [allGuests, selectedGuestIds.length, hasUserInteracted, preselectionPreset, preselectedGuestIds]);

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
          refresh();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [eventId, refresh]);

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
