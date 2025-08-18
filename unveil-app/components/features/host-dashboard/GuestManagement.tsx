'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
// Core dependencies
import { useHostGuestDecline } from '@/hooks/guests';

import { useSimpleGuestStore } from '@/hooks/guests/useSimpleGuestStore';

// Local components
import { SecondaryButton, PrimaryButton } from '@/components/ui';
import { GuestListItem } from './GuestListItem';
import { GuestControlPanel } from './GuestControlPanel';
import { GuestManagementErrorBoundary } from './ErrorBoundary';
import { FeedbackProvider, useFeedback } from './UserFeedback';

// Local types
import type { GuestManagementProps, GuestStatusCounts } from './types';

/**
 * Simplified Guest Management Content (Phase 3 MVP)
 * Reduced complexity: 503 LOC → ~250 LOC target
 * Removed: Progress chart, activity feed, pull-to-refresh, complex bulk selection
 */
function GuestManagementContent({
  eventId,
  onGuestUpdated,
  onImportGuests,
  onAddIndividualGuest,
}: GuestManagementProps) {
  const { showError, showSuccess } = useFeedback();

  // Simplified state management - RSVP-Lite filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterByRSVP, setFilterByRSVP] = useState<'all' | 'attending' | 'declined'>('all');

  // Data hooks
  const { 
    guests, 
    statusCounts, 
    loading,
    refreshGuests
  } = useSimpleGuestStore(eventId);
  
  // Note: Legacy RSVP mutations removed as part of RSVP-Lite hard cutover

  // RSVP-Lite: Host decline management
  const { clearGuestDecline } = useHostGuestDecline({
    eventId,
    onDeclineClearSuccess: () => {
      showSuccess('Guest decline status cleared successfully');
      refreshGuests(); // Refresh to get updated data
      onGuestUpdated?.();
    }
  });



  // Listen for guest data refresh events (e.g., after guest import)
  useEffect(() => {
    const handleGuestDataRefresh = (event: CustomEvent) => {
      if (event.detail?.eventId === eventId) {
        // Trigger refresh of guest data
        refreshGuests();
      }
    };

    window.addEventListener('guestDataRefresh', handleGuestDataRefresh as EventListener);
    
    return () => {
      window.removeEventListener('guestDataRefresh', handleGuestDataRefresh as EventListener);
    };
  }, [eventId, refreshGuests]);

  // Helper function to extract first name from display name
  const getFirstName = useCallback((guest: typeof guests[0]) => {
    const displayName = guest.guest_display_name || guest.users?.full_name || guest.guest_name || '';
    return displayName.split(' ')[0]?.trim() || '';
  }, []);

  // Simplified filtering and sorting (removed complex multi-filter logic)
  const filteredGuests = useMemo(() => {
    if (!guests || !Array.isArray(guests)) return [];
    
    let filtered = guests;
    
    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(guest => {
        const displayName = guest.guest_display_name?.toLowerCase() || '';
        const guestName = guest.guest_name?.toLowerCase() || '';
        const guestEmail = guest.guest_email?.toLowerCase() || '';
        const phone = guest.phone?.toLowerCase() || '';
        const userFullName = guest.users?.full_name?.toLowerCase() || '';
        
        return (
          displayName.includes(searchLower) ||
          guestName.includes(searchLower) ||
          guestEmail.includes(searchLower) ||
          phone.includes(searchLower) ||
          userFullName.includes(searchLower)
        );
      });
    }
    
    // Apply RSVP-Lite filter (3 options: all, attending, declined)
    if (filterByRSVP !== 'all') {
      filtered = filtered.filter(guest => {
        if (filterByRSVP === 'attending') {
          return !guest.declined_at; // Attending = not declined
        }
        if (filterByRSVP === 'declined') {
          return !!guest.declined_at; // Declined = has declined_at
        }
        return true; // 'all' case
      });
    }
    
    // Sort alphabetically by first name (case-insensitive, null names last)
    return filtered.sort((a, b) => {
      const firstNameA = getFirstName(a);
      const firstNameB = getFirstName(b);
      
      // Handle null/empty names - sort them last
      if (!firstNameA && !firstNameB) return 0;
      if (!firstNameA) return 1;
      if (!firstNameB) return -1;
      
      // Case-insensitive alphabetical sort
      return firstNameA.toLowerCase().localeCompare(firstNameB.toLowerCase());
    });
  }, [guests, searchTerm, filterByRSVP, getFirstName]);

  // Note: RSVP updates now handled through decline/clear decline actions only
  // Legacy RSVP dropdown removed as part of RSVP-Lite hard cutover

  // Note: Guest removal functionality deferred to post-RSVP-Lite implementation
  const handleRemoveGuestWithFeedback = useCallback(async () => {
    showError('Feature Unavailable', 'Guest removal will be available in the next update.');
  }, [showError]);

  // RSVP-Lite: Clear guest decline handler
  const handleClearGuestDecline = useCallback(async (guestUserId: string) => {
    const guest = guests.find(g => g.user_id === guestUserId);
    const guestName = guest?.guest_display_name || guest?.guest_name || guest?.users?.full_name || 'Guest';
    
    if (!confirm(`Clear decline status for ${guestName}? They will be able to receive day-of logistics again.`)) {
      return;
    }

    try {
      await clearGuestDecline(guestUserId);
    } catch {
      showError('Clear Failed', 'Failed to clear decline status. Please try again.');
    }
  }, [clearGuestDecline, guests, showError]);

  // Note: Bulk RSVP actions removed as part of RSVP-Lite hard cutover
  // Guests are either attending (default) or declined (via "Can't make it" button)

  // Calculate counts for RSVP-Lite status summary
  const simplifiedCounts: GuestStatusCounts = useMemo(() => ({
    total: statusCounts?.total || 0,
    attending: statusCounts?.attending || 0,
    declined: statusCounts?.declined || 0,
  }), [statusCounts]);

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Loading skeleton - simplified */}
        <div className="animate-pulse space-y-4">
          <div className="h-20 bg-gray-200 rounded-lg"></div>
          <div className="h-16 bg-gray-200 rounded-lg"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Control Panel - Single unified top section */}
      <GuestControlPanel
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        filterByRSVP={filterByRSVP}
        onFilterChange={setFilterByRSVP}
        statusCounts={simplifiedCounts}
        onImportGuests={onImportGuests || (() => {})}
        onAddIndividualGuest={onAddIndividualGuest}
        hasGuests={guests.length > 0}
      />

      {/* Bulk Actions (if applicable) */}
      {/* Note: Bulk actions removed as part of RSVP-Lite hard cutover */}

      {/* Guest List */}
      {filteredGuests.length === 0 ? (
        <div className="bg-white rounded-lg p-8 text-center shadow-sm border border-gray-100">
          <div className="text-6xl mb-4">
            {searchTerm || filterByRSVP !== 'all' ? '🔍' : '👥'}
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {searchTerm || filterByRSVP !== 'all' ? 'No matching guests' : 'No guests yet'}
          </h3>
          <p className="text-gray-600 mb-6">
            {searchTerm || filterByRSVP !== 'all' 
              ? 'Try adjusting your search or filter to find guests.'
              : 'Get started by adding guests individually or importing from a CSV file.'
            }
          </p>
          {(!searchTerm && filterByRSVP === 'all') && (
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <PrimaryButton 
                onClick={onAddIndividualGuest}
                fullWidth={false}
                className="min-h-[44px] px-8"
              >
                👤 Add Individual Guest
              </PrimaryButton>
              <SecondaryButton 
                onClick={onImportGuests}
                fullWidth={false}
                className="min-h-[44px] px-8"
              >
                📄 Import from CSV
              </SecondaryButton>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          {/* Guest items - reduced spacing between cards */}
          {filteredGuests.map((guest) => (
            <GuestListItem
              key={guest.id}
              guest={guest}
              onRemove={handleRemoveGuestWithFeedback}
              onClearDecline={handleClearGuestDecline}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Main Guest Management component with error boundary and feedback
 * Simplified for MVP - reduced from 503 LOC to ~250 LOC
 */
export function GuestManagement(props: GuestManagementProps) {
  return (
    <GuestManagementErrorBoundary>
      <FeedbackProvider>
        <GuestManagementContent {...props} />
      </FeedbackProvider>
    </GuestManagementErrorBoundary>
  );
}