'use client';

import { useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';

// Core dependencies
import { useGuestMutations } from '@/hooks/guests';
import { useSimpleGuestStore } from '@/hooks/guests/useSimpleGuestStore';

// Local components
import { SecondaryButton, PrimaryButton, CardContainer } from '@/components/ui';
import { GuestListItem } from './GuestListItem';
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
    loading
  } = useSimpleGuestStore(eventId);
  
  const {
    handleRSVPUpdate,
    handleRemoveGuest,
    handleMarkAllPendingAsAttending,
  } = useGuestMutations({ eventId, onGuestUpdated });

  // Simplified filtering (removed complex multi-filter logic)
  const filteredGuests = useMemo(() => {
    if (!guests || !Array.isArray(guests)) return [];
    
    let filtered = guests;
    
    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(guest => {
        const guestName = guest.guest_name?.toLowerCase() || '';
        const guestEmail = guest.guest_email?.toLowerCase() || '';
        const phone = guest.phone?.toLowerCase() || '';
        const userFullName = guest.users?.full_name?.toLowerCase() || '';
        
        return (
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
      await handleRSVPUpdate(guestId, newStatus);
      showSuccess('RSVP Updated', 'Guest status has been updated successfully.');
    } catch {
      showError('Update Failed', 'Failed to update RSVP status. Please try again.');
    }
  }, [handleRSVPUpdate, showSuccess, showError]);

  const handleRemoveGuestWithFeedback = useCallback(async (guestId: string) => {
    const guest = guests.find(g => g.id === guestId);
    const guestName = guest?.guest_name || guest?.users?.full_name || 'Guest';
    
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
      <div className="space-y-6">
        {/* Loading skeleton - simplified */}
        <div className="animate-pulse space-y-4">
          <div className="h-16 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. PRIMARY ACTIONS (Top Priority - Audit Recommendation) */}
      <CardContainer>
        <div className="p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Guest Management</h2>
              <p className="text-sm text-gray-600 mt-1">
                Manage your guest list and track RSVPs
              </p>
            </div>
            
            {/* Primary Actions */}
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <PrimaryButton
                onClick={onImportGuests}
                className="flex items-center justify-center gap-2"
              >
                <span>📄</span>
                Import Guests
              </PrimaryButton>
              
              {/* Simplified bulk action */}
              {pendingCount > 0 && (
                <SecondaryButton
                  onClick={handleConfirmAllPending}
                  className="flex items-center justify-center gap-2"
                >
                  <span>✅</span>
                  Confirm All Pending ({pendingCount})
                </SecondaryButton>
              )}
            </div>
          </div>
          
          {/* Search Bar */}
          <div className="mt-4">
            <input
              type="text"
              placeholder="Search guests by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B6B] focus:border-[#FF6B6B] min-h-[44px]"
            />
          </div>
        </div>
      </CardContainer>

      {/* 2. SIMPLIFIED STATUS SUMMARY (3 filters only) */}
      <CardContainer>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-md font-medium text-gray-900">
              Guest Status
            </h3>
            <span className="text-sm text-gray-600">
              {filteredGuests.length} of {simplifiedCounts.total} guests
            </span>
          </div>
          
          {/* Simplified Filter Pills (3 only - Audit Recommendation) */}
          <div className="flex gap-2 overflow-x-auto">
            {[
              { key: 'all', label: 'All', count: simplifiedCounts.total, emoji: '👥' },
              { key: 'attending', label: 'Attending', count: simplifiedCounts.attending, emoji: '✅' },
              { key: 'pending', label: 'Pending', count: simplifiedCounts.pending, emoji: '⏳' },
            ].map((filter) => (
              <button
                key={filter.key}
                onClick={() => setFilterByRSVP(filter.key as 'all' | 'attending' | 'pending')}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap',
                  'border-2 min-h-[44px] transition-all duration-200',
                  filterByRSVP === filter.key ? [
                    'bg-[#FF6B6B] text-white border-[#FF6B6B]'
                  ] : [
                    'bg-gray-50 text-gray-800 border-gray-200 hover:border-gray-300'
                  ]
                )}
              >
                <span>{filter.emoji}</span>
                <span>{filter.label}</span>
                <span className={cn(
                  'px-2 py-1 rounded-full text-xs font-semibold',
                  filterByRSVP === filter.key ? 'bg-white bg-opacity-20' : 'bg-gray-200'
                )}>
                  {filter.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </CardContainer>

      {/* 3. GUEST LIST (Main Content) */}
      <CardContainer>
        {filteredGuests.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-6xl mb-4">
              {searchTerm || filterByRSVP !== 'all' ? '🔍' : '👥'}
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {searchTerm || filterByRSVP !== 'all' ? 'No matching guests' : 'No guests yet'}
            </h3>
            <p className="text-gray-600 mb-6">
              {searchTerm || filterByRSVP !== 'all' 
                ? 'Try adjusting your search or filter to find guests.'
                : 'Get started by importing your guest list.'
              }
            </p>
            {(!searchTerm && filterByRSVP === 'all') && (
              <PrimaryButton onClick={onImportGuests}>
                Import Guest List
              </PrimaryButton>
            )}
          </div>
        ) : (
          <div>
            {/* List header */}
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-md font-medium text-gray-900">
                Guest List ({filteredGuests.length})
              </h3>
            </div>
            
            {/* Guest items */}
            <div className="divide-y divide-gray-100">
              {filteredGuests.map((guest) => (
                <GuestListItem
                  key={guest.id}
                  guest={guest}
                  isSelected={false} // Simplified - removed selection complexity
                  onToggleSelect={() => {}} // Simplified - removed selection complexity
                  onRSVPUpdate={handleRSVPUpdateWithFeedback}
                  onRemove={handleRemoveGuestWithFeedback}
                />
              ))}
            </div>
          </div>
        )}
      </CardContainer>
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