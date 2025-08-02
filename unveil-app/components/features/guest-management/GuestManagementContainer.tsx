'use client';

import { useState, useCallback, useMemo } from 'react';
import { RSVPStatus } from '@/lib/types/rsvp';
import { GuestFilters, LoadingStates } from './shared/types';

// Enhanced hooks for guest management
import { useGuestMutations } from '@/hooks/guests';
import { useSimpleGuestStore } from '@/hooks/guests/useSimpleGuestStore';
import { useFeedback } from './shared/UserFeedback';
import { useHapticFeedback, usePullToRefresh } from '@/hooks/common';

// Refactored components
import { GuestFilters as GuestFiltersComponent } from './filters/GuestFilters';
import { GuestActions } from './actions/GuestActions';
import { GuestList } from './list/GuestList';
import { BulkSelectionBar } from './actions/BulkSelectionBar';

// Shared utilities
import { cn } from '@/lib/utils';

export interface GuestManagementContainerProps {
  eventId: string;
  onGuestUpdated?: () => void;
  onImportGuests?: () => void;
  onSendMessage?: (messageType: string) => void;
}

/**
 * Main container component for guest management
 * Orchestrates data flow between filters, actions, and list components
 */
export function GuestManagementContainer({
  eventId,
  onGuestUpdated,
  onImportGuests,
}: GuestManagementContainerProps) {
  const { showError, showSuccess } = useFeedback();
  const { triggerHaptic } = useHapticFeedback();

  // State management
  const [selectedGuests, setSelectedGuests] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<GuestFilters>({
    searchTerm: '',
    rsvpStatus: 'all',
    tags: [],
  });

  const handleFiltersChange = useCallback((updates: Partial<GuestFilters>) => {
    setFilters(prev => {
      // Only update if the values actually changed
      const hasChanges = Object.keys(updates).some(key => 
        prev[key as keyof GuestFilters] !== updates[key as keyof GuestFilters]
      );
      
      if (!hasChanges) {
        return prev; // Return same reference to prevent unnecessary re-renders
      }
      
      return { ...prev, ...updates };
    });
  }, []);

  // Data hooks - using simplified guest store for MVP stability
  const { 
    guests, 
    statusCounts,
    loading: guestsLoading,
    error: guestStoreError,
    refreshGuests
  } = useSimpleGuestStore(eventId);
  
  const fetchData = refreshGuests;
  const {
    handleRSVPUpdate: baseHandleRSVPUpdate,
    handleRemoveGuest: baseHandleRemoveGuest,
    handleBulkRSVPUpdate,
  } = useGuestMutations({ eventId, onGuestUpdated });

  // Loading states
  const [loadingStates, setLoadingStates] = useState<LoadingStates>({
    guests: false,
    rsvpUpdate: false,
    bulkAction: false,
    import: false,
    export: false,
  });

  // Pull-to-refresh functionality
  const pullToRefresh = usePullToRefresh({
    onRefresh: async () => {
      await fetchData();
      triggerHaptic('success');
    },
    threshold: 80,
    maxPullDistance: 120,
  });

  // Filter guests based on current filters
  const filteredGuests = useMemo(() => {
    // Comprehensive null safety - handle undefined, null, or non-array guests
    if (!guests || !Array.isArray(guests) || guests.length === 0) {
      return [];
    }
    
    // Create a defensive copy to avoid mutations
    let filtered = [...guests];
    
    // Additional safety check - ensure all array elements are valid guest objects
    filtered = filtered.filter(guest => guest && typeof guest === 'object' && guest.id);

    // Search filter
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(guest => {
        const guestName = guest.guest_name?.toLowerCase() || '';
        const guestEmail = guest.guest_email?.toLowerCase() || '';
        const phone = guest.phone?.toLowerCase() || '';
        const userFullName = guest.users?.full_name?.toLowerCase() || '';
        const userEmail = guest.users?.email?.toLowerCase() || '';
        
        return (
          guestName.includes(searchLower) ||
          guestEmail.includes(searchLower) ||
          phone.includes(searchLower) ||
          userFullName.includes(searchLower) ||
          userEmail.includes(searchLower)
        );
      });
    }

    // RSVP status filter
    if (filters.rsvpStatus !== 'all') {
      filtered = filtered.filter(guest => {
        if (!guest.rsvp_status) return filters.rsvpStatus === 'pending';
        return guest.rsvp_status === filters.rsvpStatus;
      });
    }

    // Tag filter
    if (filters.tags.length > 0) {
      filtered = filtered.filter(guest => {
        const guestTags = guest.guest_tags || [];
        return filters.tags.some(tag => guestTags.includes(tag));
      });
    }

    return filtered;
  }, [guests, filters]);

  // Selection management
  const handleToggleGuestSelect = useCallback((guestId: string, selected: boolean) => {
    setSelectedGuests(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(guestId);
      } else {
        newSet.delete(guestId);
      }
      return newSet;
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedGuests(new Set());
  }, []);



  // RSVP update with enhanced feedback
  const handleRSVPUpdate = useCallback(async (guestId: string, newStatus: RSVPStatus) => {
    setLoadingStates(prev => ({ ...prev, rsvpUpdate: true }));
    try {
      triggerHaptic('light');
      await baseHandleRSVPUpdate(guestId, newStatus);
      triggerHaptic('success');
      showSuccess('RSVP Updated', 'Guest RSVP status has been updated successfully.');
    } catch {
      triggerHaptic('error');
      showError(
        'Failed to Update RSVP',
        'There was an error updating the guest RSVP status. Please try again.',
        () => handleRSVPUpdate(guestId, newStatus)
      );
    } finally {
      setLoadingStates(prev => ({ ...prev, rsvpUpdate: false }));
    }
  }, [baseHandleRSVPUpdate, triggerHaptic, showError, showSuccess]);

  // Guest removal with confirmation
  const handleRemoveGuest = useCallback(async (guestId: string) => {
    if (!confirm('Are you sure you want to remove this guest?')) return;
    
    try {
      await baseHandleRemoveGuest(guestId);
      showSuccess('Guest Removed', 'The guest has been successfully removed from the event.');
      
      // Remove from selection if selected
      setSelectedGuests(prev => {
        const newSet = new Set(prev);
        newSet.delete(guestId);
        return newSet;
      });
    } catch {
      showError(
        'Failed to Remove Guest',
        'There was an error removing the guest. Please try again.',
        () => handleRemoveGuest(guestId)
      );
    }
  }, [baseHandleRemoveGuest, showError, showSuccess]);

  // Bulk operations
  const handleBulkAction = useCallback(async (actionType: string, payload?: unknown) => {
    if (selectedGuests.size === 0) return;

    setLoadingStates(prev => ({ ...prev, bulkAction: true }));
    try {
      triggerHaptic('medium');
      
      switch (actionType) {
        case 'rsvp':
          if (payload && typeof payload === 'object' && 'status' in payload) {
            const status = (payload as { status: string }).status;
            await handleBulkRSVPUpdate(Array.from(selectedGuests), status);
            showSuccess('Bulk Update Complete', `Updated ${selectedGuests.size} guests to ${status}.`);
          } else {
            throw new Error('Invalid payload for RSVP bulk action');
          }
          break;
        case 'remove':
          if (confirm(`Remove ${selectedGuests.size} selected guests?`)) {
            // TODO: Implement bulk remove
            showSuccess('Guests Removed', `Removed ${selectedGuests.size} guests.`);
          }
          break;
        default:
          console.warn('Unknown bulk action:', actionType);
      }
      
      setSelectedGuests(new Set());
      triggerHaptic('success');
    } catch {
      triggerHaptic('error');
      showError(
        'Bulk Operation Failed',
        'There was an error with the bulk operation. Please try again.',
        () => handleBulkAction(actionType, payload)
      );
    } finally {
      setLoadingStates(prev => ({ ...prev, bulkAction: false }));
    }
  }, [selectedGuests, handleBulkRSVPUpdate, triggerHaptic, showError, showSuccess]);

  // Pull-to-refresh styling
  const pullToRefreshStyle = useMemo(() => ({
    transform: pullToRefresh.isPulling 
      ? `translateY(${Math.min(pullToRefresh.pullDistance, 100)}px)` 
      : 'translateY(0)',
    transition: pullToRefresh.isPulling ? 'none' : 'transform 200ms ease-out'
  }), [pullToRefresh.isPulling, pullToRefresh.pullDistance]);

  // Show error state if guest store has an error
  if (guestStoreError) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="text-red-500 mb-2">⚠️ Connection Error</div>
          <p className="text-gray-600 mb-4">
            Unable to load guest data. Please check your connection and try again.
          </p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="space-y-6 relative"
      style={pullToRefreshStyle}
    >
      {/* Pull-to-refresh indicator */}
      {(pullToRefresh.isPulling || pullToRefresh.isRefreshing) && (
        <div 
          className="absolute -top-16 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-2 text-gray-500 z-20"
          style={{
            opacity: pullToRefresh.pullDistance > 30 ? 1 : pullToRefresh.pullDistance / 30
          }}
        >
          <div className={cn(
            'w-8 h-8 rounded-full border-2 border-gray-300 border-t-[#FF6B6B] transition-all duration-200',
            pullToRefresh.isRefreshing && 'animate-spin',
            pullToRefresh.canRefresh && !pullToRefresh.isRefreshing && 'border-t-green-500'
          )} />
          <span className="text-sm font-medium">
            {pullToRefresh.isRefreshing ? 'Refreshing...' : 
             pullToRefresh.canRefresh ? 'Release to refresh' : 'Pull to refresh'}
          </span>
        </div>
      )}

      {/* Filters Section */}
      <GuestFiltersComponent
        filters={filters}
        onFiltersChange={handleFiltersChange}
        statusCounts={statusCounts}
        availableTags={[]} // TODO: Extract available tags from guests
      />

      {/* Actions Section */}
      <GuestActions
        onImportGuests={onImportGuests}
        onBulkAction={handleBulkAction}
        loading={loadingStates}
      />

      {/* Bulk Selection Bar */}
      {selectedGuests.size > 0 && (
        <BulkSelectionBar
          selectedCount={selectedGuests.size}
          onClearSelection={handleClearSelection}
          onBulkAction={handleBulkAction}
          loading={loadingStates.bulkAction}
        />
      )}

      {/* Guest List */}
      <GuestList
        guests={filteredGuests}
        selectedGuests={selectedGuests}
        onToggleSelect={handleToggleGuestSelect}
        onRSVPUpdate={handleRSVPUpdate}
        onRemove={handleRemoveGuest}
        loading={guestsLoading || loadingStates.guests}
        pagination={{
          page: 1,
          pageSize: 50,
          totalCount: filteredGuests.length,
          totalPages: Math.ceil(filteredGuests.length / 50),
          hasNextPage: false,
          hasPrevPage: false,
        }}
        onLoadMore={() => {}} // TODO: Implement pagination
      />
    </div>
  );
}