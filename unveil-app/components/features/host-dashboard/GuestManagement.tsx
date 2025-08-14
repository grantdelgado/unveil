'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
// Core dependencies
import { useGuestMutations } from '@/hooks/guests';
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
}: GuestManagementProps) {
  const { showError, showSuccess } = useFeedback();

  // Simplified state management - removed complex filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterByRSVP, setFilterByRSVP] = useState<'all' | 'attending' | 'pending'>('all');

  // Data hooks
  const { 
    guests, 
    statusCounts, 
    loading,
    updateGuestOptimistically,
    rollbackOptimisticUpdate,
    refreshGuests
  } = useSimpleGuestStore(eventId);
  
  const {
    handleRSVPUpdate,
    handleRemoveGuest,
    handleMarkAllPendingAsAttending,
  } = useGuestMutations({ 
    eventId, 
    onGuestUpdated,
    onOptimisticRollback: rollbackOptimisticUpdate
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

  // Simplified filtering (removed complex multi-filter logic)
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
    
    // Apply simplified RSVP filter (3 options only)
    if (filterByRSVP !== 'all') {
      filtered = filtered.filter(guest => {
        if (filterByRSVP === 'pending') {
          return !guest.rsvp_status || guest.rsvp_status === 'pending';
        }
        return guest.rsvp_status === filterByRSVP;
      });
    }
    
    return filtered;
  }, [guests, searchTerm, filterByRSVP]);

  // Enhanced handlers with user feedback
  const handleRSVPUpdateWithFeedback = useCallback(async (guestId: string, newStatus: string) => {
    try {
      // Immediately update the UI for instant feedback
      updateGuestOptimistically(guestId, { rsvp_status: newStatus as 'attending' | 'declined' | 'maybe' | 'pending' });
      
      // Then perform the actual database update
      await handleRSVPUpdate(guestId, newStatus);
      showSuccess('RSVP Updated', 'Guest status has been updated successfully.');
    } catch {
      // If the mutation fails, the mutation hook will handle rollback
      showError('Update Failed', 'Failed to update RSVP status. Please try again.');
    }
  }, [handleRSVPUpdate, updateGuestOptimistically, showSuccess, showError]);

  const handleRemoveGuestWithFeedback = useCallback(async (guestId: string) => {
    const guest = guests.find(g => g.id === guestId);
    const guestName = guest?.guest_display_name || guest?.guest_name || guest?.users?.full_name || 'Guest';
    
    if (!confirm(`Are you sure you want to remove ${guestName} from the guest list?`)) {
      return;
    }

    try {
      await handleRemoveGuest(guestId);
      showSuccess('Guest Removed', `${guestName} has been removed from the guest list.`);
    } catch {
      showError('Remove Failed', 'Failed to remove guest. Please try again.');
    }
  }, [handleRemoveGuest, guests, showSuccess, showError]);

  // Simplified bulk action - single "Confirm All Pending" button
  const handleConfirmAllPending = useCallback(async () => {
    const pendingGuests = guests.filter(guest => 
      !guest.rsvp_status || guest.rsvp_status === 'pending'
    );
    
    if (pendingGuests.length === 0) {
      showError('No Pending Guests', 'There are no pending RSVPs to confirm.');
      return;
    }

    if (!confirm(`Confirm all ${pendingGuests.length} pending RSVPs as attending?`)) {
      return;
    }

    try {
      await handleMarkAllPendingAsAttending();
      showSuccess('RSVPs Confirmed', `Marked ${pendingGuests.length} guests as attending.`);
    } catch {
      showError('Bulk Update Failed', 'Failed to update pending RSVPs. Please try again.');
    }
  }, [guests, handleMarkAllPendingAsAttending, showSuccess, showError]);

  // Calculate counts for simplified status summary
  const simplifiedCounts: GuestStatusCounts = useMemo(() => ({
    total: statusCounts?.total || 0,
    attending: statusCounts?.attending || 0,
    pending: statusCounts?.pending || 0,
  }), [statusCounts]);

  const pendingCount = guests.filter(g => !g.rsvp_status || g.rsvp_status === 'pending').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-8">
        <div className="max-w-4xl mx-auto p-4 space-y-6">
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Control Panel - Single unified top section */}
        <GuestControlPanel
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          filterByRSVP={filterByRSVP}
          onFilterChange={setFilterByRSVP}
          statusCounts={simplifiedCounts}
          onImportGuests={onImportGuests || (() => {})}
          hasGuests={guests.length > 0}
        />

        {/* Bulk Actions (if applicable) */}
        {pendingCount > 0 && (
          <div className="flex justify-center">
            <SecondaryButton
              onClick={handleConfirmAllPending}
              className="flex items-center justify-center gap-2 min-h-[44px]"
              fullWidth={false}
            >
              <span>✅</span>
              Confirm All Pending ({pendingCount})
            </SecondaryButton>
          </div>
        )}

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
                : 'Get started by importing your guest list from a CSV file.'
              }
            </p>
            {(!searchTerm && filterByRSVP === 'all') && (
              <PrimaryButton 
                onClick={onImportGuests}
                fullWidth={false}
                className="min-h-[44px] px-8"
              >
                📄 Import Guest List
              </PrimaryButton>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {/* Guest items - reduced spacing between cards */}
            {filteredGuests.map((guest) => (
              <GuestListItem
                key={guest.id}
                guest={guest}
                onRSVPUpdate={handleRSVPUpdateWithFeedback}
                onRemove={handleRemoveGuestWithFeedback}
              />
            ))}
          </div>
        )}
      </div>
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