'use client';

// External dependencies
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

// Error boundary and feedback system
import { GuestManagementErrorBoundary } from '@/components/features/guest-management/shared/ErrorBoundary';
import { FeedbackProvider, useFeedback } from '@/components/features/guest-management/shared/UserFeedback';

// Internal utilities
import { cn } from '@/lib/utils';

// Internal hooks (specific imports for better tree-shaking)
import { useHapticFeedback, usePullToRefresh } from '@/hooks/common';
import { 
  useGuestMutations 
} from '@/hooks/guests';
import { useSimpleGuestStore } from '@/hooks/guests/useSimpleGuestStore';

// Internal components (specific imports)
import { SecondaryButton, CardContainer } from '@/components/ui';
import { GuestStatusSummary } from './GuestStatusSummary';
import { BulkActionShortcuts } from './BulkActionShortcuts';
import { GuestListItem } from './GuestListItem';

interface GuestManagementProps {
  eventId: string;
  onGuestUpdated?: () => void;
  onImportGuests?: () => void;
  onSendMessage?: (messageType: 'reminder') => void;
}

function GuestManagementContent({
  eventId,
  onGuestUpdated,
  onImportGuests,
  onSendMessage,
}: GuestManagementProps) {
  const { showError, showSuccess } = useFeedback();
  const [selectedGuests, setSelectedGuests] = useState<Set<string>>(new Set());
  
  // 🚀 PERFORMANCE OPTIMIZATION: Focused hook architecture
  // Split monolithic useGuestData into focused, single-responsibility hooks:
  // - Reduces unnecessary re-renders (memoized computations)
  // - Better maintainability and testing
  // - Optimized dependency arrays prevent cascade re-renders
  // - Follows single responsibility principle for better performance
  // Week 3: Replaced heavy useGuestData hook with focused alternatives
  const { 
    guests, 
    statusCounts, 
    loading,
    refreshGuests 
  } = useSimpleGuestStore(eventId);
  
  // Local filtering state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterByRSVP, setFilterByRSVP] = useState('all');
  
  // Filter guests based on search and RSVP status
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
    
    // Apply RSVP filter
    if (filterByRSVP !== 'all') {
      filtered = filtered.filter(guest => {
        if (!guest.rsvp_status) return filterByRSVP === 'pending';
        return guest.rsvp_status === filterByRSVP;
      });
    }
    
    return filtered;
  }, [guests, searchTerm, filterByRSVP]);
  
  const fetchData = refreshGuests;
  const { 
    handleRSVPUpdate: baseHandleRSVPUpdate,
    handleRemoveGuest: baseHandleRemoveGuest,
    handleMarkAllPendingAsAttending: baseHandleMarkAllPendingAsAttending,
    handleBulkRSVPUpdate,
  } = useGuestMutations({ eventId, onGuestUpdated });

  // Interaction enhancements
  const { triggerHaptic } = useHapticFeedback();
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Pull-to-refresh functionality
  const pullToRefresh = usePullToRefresh({
    onRefresh: async () => {
      await fetchData();
      triggerHaptic('success');
    },
    threshold: 80,
    maxPullDistance: 120
  });

  // Enhanced handlers with haptic feedback
  const handleRSVPUpdate = useCallback(async (guestId: string, newStatus: string) => {
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
    }
  }, [baseHandleRSVPUpdate, triggerHaptic, showError, showSuccess]);

  const handleRemoveGuest = useCallback(async (guestId: string) => {
    if (!confirm('Are you sure you want to remove this guest?')) return;
    try {
      await baseHandleRemoveGuest(guestId);
      showSuccess('Guest Removed', 'The guest has been successfully removed from the event.');
    } catch {
      showError(
        'Failed to Remove Guest',
        'There was an error removing the guest. Please try again.',
        () => handleRemoveGuest(guestId)
      );
    }
  }, [baseHandleRemoveGuest, showError, showSuccess]);

  const handleMarkAllPendingAsAttending = useCallback(async () => {
    const pendingCount = statusCounts.pending;
    if (pendingCount === 0) return;

    if (!confirm(`Mark ${pendingCount} pending guests as attending?`)) return;

    try {
      triggerHaptic('medium');
      await baseHandleMarkAllPendingAsAttending();
      triggerHaptic('success');
      showSuccess('Bulk Update Complete', `Successfully marked ${pendingCount} guests as attending.`);
    } catch {
      triggerHaptic('error');
      showError(
        'Bulk Update Failed',
        'There was an error updating the guest statuses. Please try again.',
        handleMarkAllPendingAsAttending
      );
    }
  }, [baseHandleMarkAllPendingAsAttending, statusCounts.pending, triggerHaptic, showError, showSuccess]);

  const handleSendReminderToPending = useCallback(() => {
    onSendMessage?.('reminder');
  }, [onSendMessage]);

  const handleBulkRSVPUpdateWithFeedback = useCallback(async (newStatus: string) => {
    if (selectedGuests.size === 0) return;

    const guestCount = selectedGuests.size;
    try {
      triggerHaptic('medium');
      await handleBulkRSVPUpdate(Array.from(selectedGuests), newStatus);
      setSelectedGuests(new Set());
      triggerHaptic('success');
      showSuccess('Bulk Update Complete', `Successfully updated ${guestCount} guests to ${newStatus}.`);
    } catch {
      triggerHaptic('error');
      showError(
        'Bulk Update Failed',
        'There was an error updating the selected guests. Please try again.',
        () => handleBulkRSVPUpdateWithFeedback(newStatus)
      );
    }
  }, [handleBulkRSVPUpdate, selectedGuests, triggerHaptic, showError, showSuccess]);

  // Memoize expensive calculations
  const pullToRefreshStyle = useMemo(() => ({
    transform: pullToRefresh.isPulling ? `translateY(${Math.min(pullToRefresh.pullDistance, 100)}px)` : 'translateY(0)',
    transition: pullToRefresh.isPulling ? 'none' : 'transform 200ms ease-out'
  }), [pullToRefresh.isPulling, pullToRefresh.pullDistance]);

  const guestCountText = useMemo(() => {
    const count = filteredGuests.length;
    const isFiltered = searchTerm || filterByRSVP !== 'all';
    return `${count} guest${count !== 1 ? 's' : ''}${isFiltered ? ' (filtered)' : ''}`;
  }, [filteredGuests.length, searchTerm, filterByRSVP]);

  const isAllSelected = useMemo(() => 
    selectedGuests.size === filteredGuests.length && filteredGuests.length > 0
  , [selectedGuests.size, filteredGuests.length]);

  const selectAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedGuests(new Set());
    } else {
      setSelectedGuests(new Set(filteredGuests.map(guest => guest.id)));
    }
  }, [isAllSelected, filteredGuests]);

  const handleToggleGuestSelect = useCallback((guestId: string, selected: boolean) => {
    const newSelected = new Set(selectedGuests);
    if (selected) {
      newSelected.add(guestId);
    } else {
      newSelected.delete(guestId);
    }
    setSelectedGuests(newSelected);
  }, [selectedGuests]);

  // Attach pull-to-refresh listeners
  useEffect(() => {
    pullToRefresh.bindToElement(containerRef.current);
  }, [pullToRefresh]);

  if (loading) {
    return (
      <div className="space-y-4">
        {/* Enhanced skeleton with shimmer effect */}
        <div className="animate-pulse space-y-4">
          {/* Status pills skeleton */}
          <div className="flex gap-2 overflow-x-auto">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-10 w-20 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:200%_100%] animate-shimmer rounded-full flex-shrink-0"></div>
            ))}
          </div>
          
          {/* Search and filters skeleton */}
          <div className="h-12 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:200%_100%] animate-shimmer rounded-lg"></div>
          
          {/* Guest list skeleton */}
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-20 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:200%_100%] animate-shimmer rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
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
      
      {/* Status Pills - Always at Top */}
      <div>
        <GuestStatusSummary
          eventId={eventId}
          activeFilter={filterByRSVP}
          onFilterChange={setFilterByRSVP}
          className="mb-4"
        />
      </div>

      {/* Essential Actions */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Guest List</h3>
        <div className="flex gap-2">
          <SecondaryButton
            onClick={onImportGuests}
            className="inline-flex items-center gap-2"
          >
            <span>📄</span>
            Import Guests
          </SecondaryButton>
        </div>
      </div>

      {/* Search Bar - Sticky on Mobile */}
      <div className="sticky top-0 z-10 bg-white pb-2">
        <div className="relative">
          <input
            type="text"
            placeholder="Search guests by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={cn(
              'w-full px-4 py-3 pl-10 pr-4 border border-gray-300 rounded-lg',
              'focus:ring-2 focus:ring-[#FF6B6B] focus:border-transparent',
              'text-base min-h-[44px]', // Touch-friendly
              'placeholder:text-gray-500'
            )}
            autoComplete="off"
            autoFocus={false}
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-gray-400 text-lg">🔍</span>
          </div>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
              type="button"
            >
              <span className="text-gray-400 hover:text-gray-600 text-lg">✕</span>
            </button>
          )}
        </div>
      </div>

      {/* Bulk Actions - Only show when actionable */}
      {statusCounts.pending > 5 && (
        <BulkActionShortcuts
          onMarkAllPendingAsAttending={handleMarkAllPendingAsAttending}
          onSendReminderToPending={handleSendReminderToPending}
          onImportGuests={() => onImportGuests?.()}
          pendingCount={statusCounts.pending}
          totalCount={statusCounts.total}
          loading={loading}
        />
      )}

      {/* Selection Prompt - Help users discover bulk selection */}
      {filteredGuests.length > 2 && selectedGuests.size === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">💡</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900">Tip: Bulk Actions</p>
              <p className="text-xs text-blue-700">Select multiple guests to update RSVPs, send messages, or manage them together</p>
            </div>
            <button
              onClick={() => {
                // Select first few guests as demo
                const firstFew = new Set(filteredGuests.slice(0, 2).map(g => g.id));
                setSelectedGuests(firstFew);
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Try it
            </button>
          </div>
        </div>
      )}

      {/* Selected Actions Bar - Enhanced with better UX */}
      {selectedGuests.size > 0 && (
        <div className="bg-gradient-to-r from-[#FF6B6B] to-purple-600 text-white rounded-lg p-4 shadow-lg border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎯</span>
              <p className="font-medium">
                {selectedGuests.size} guest{selectedGuests.size > 1 ? 's' : ''} selected
              </p>
            </div>
            <button
              onClick={() => setSelectedGuests(new Set())}
              className="text-white/80 hover:text-white transition-colors duration-200 p-1 rounded"
              title="Clear selection"
            >
              ✕
            </button>
          </div>
                     <div className="flex flex-wrap gap-2">
             <SecondaryButton
               onClick={() => handleBulkRSVPUpdateWithFeedback('attending')}
               className="bg-white text-gray-900 hover:bg-gray-100 py-2 px-3"
               fullWidth={false}
             >
               ✅ Attending
             </SecondaryButton>
             <SecondaryButton
               onClick={() => handleBulkRSVPUpdateWithFeedback('maybe')}
               className="bg-white text-gray-900 hover:bg-gray-100 py-2 px-3"
               fullWidth={false}
             >
               🤷‍♂️ Maybe
             </SecondaryButton>
             <SecondaryButton
               onClick={() => handleBulkRSVPUpdateWithFeedback('declined')}
               className="bg-white text-gray-900 hover:bg-gray-100 py-2 px-3"
               fullWidth={false}
             >
               ❌ Declined
             </SecondaryButton>
             <SecondaryButton
               onClick={() => handleBulkRSVPUpdateWithFeedback('pending')}
               className="bg-white text-gray-900 hover:bg-gray-100 py-2 px-3"
               fullWidth={false}
             >
               ⏳ Pending
             </SecondaryButton>
           </div>
        </div>
      )}

      {/* Guest List - Mobile Optimized */}
      <CardContainer className="overflow-hidden">
        {/* Header with Select All - Enhanced with contextual hints */}
        <div className={cn(
          "flex items-center justify-between p-4 border-b border-gray-200 transition-all duration-200",
          selectedGuests.size > 0 && "bg-purple-50 border-purple-200"
        )}>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={selectAll}
              className="h-4 w-4 text-[#FF6B6B] focus:ring-[#FF6B6B] border-gray-300 rounded"
              title="Select all guests"
            />
            <span className="text-sm font-medium text-gray-700">
              {guestCountText}
            </span>
            {selectedGuests.size === 0 && filteredGuests.length > 0 && (
              <span className="text-xs text-gray-500 ml-2">
                → Select guests for bulk actions
              </span>
            )}
          </div>
          
          {selectedGuests.size > 0 && (
            <div className="text-xs text-purple-600 font-medium">
              {selectedGuests.size}/{filteredGuests.length} selected
            </div>
          )}
        </div>

        {/* Guest Cards */}
        <div className="divide-y divide-gray-100">
          {filteredGuests.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <div className="text-3xl mb-2">
                {searchTerm || filterByRSVP !== 'all' ? '🔍' : '👥'}
              </div>
              <p className="font-medium">
                {searchTerm || filterByRSVP !== 'all' 
                  ? 'No guests match your filters' 
                  : 'No guests yet'}
              </p>
              {!searchTerm && filterByRSVP === 'all' && (
                <p className="text-sm mt-1">Import your guest list to get started</p>
              )}
            </div>
          ) : (
            filteredGuests.map((guest) => (
              <GuestListItem
                key={guest.id}
                guest={guest}
                isSelected={selectedGuests.has(guest.id)}
                onToggleSelect={handleToggleGuestSelect}
                onRSVPUpdate={handleRSVPUpdate}
                onRemove={handleRemoveGuest}
              />
            ))
          )}
        </div>
      </CardContainer>
    </div>
  );
}

// Main export with error boundary and feedback provider
export function GuestManagement(props: GuestManagementProps) {
  return (
    <GuestManagementErrorBoundary>
      <FeedbackProvider>
        <GuestManagementContent {...props} />
      </FeedbackProvider>
    </GuestManagementErrorBoundary>
  );
}
