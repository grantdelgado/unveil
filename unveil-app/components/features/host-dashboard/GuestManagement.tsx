'use client';

// External dependencies
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// Internal utilities
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';

// Internal hooks (specific imports for better tree-shaking)
import { useRealtimeSubscription } from '@/hooks/realtime';
import { useHapticFeedback, usePullToRefresh, useDebounce } from '@/hooks/common';

// Internal components (specific imports)
import { SecondaryButton, CardContainer } from '@/components/ui';
import { GuestStatusSummary } from './GuestStatusSummary';
import { BulkActionShortcuts } from './BulkActionShortcuts';

// Types
import type { Database } from '@/app/reference/supabase.types';

type Guest = Database['public']['Tables']['event_guests']['Row'] & {
  users: Database['public']['Tables']['users']['Row'] | null;
};

// Backward compatibility


interface GuestManagementProps {
  eventId: string;
  onGuestUpdated?: () => void;
  onImportGuests?: () => void;
  onSendMessage?: (messageType: 'reminder') => void;
}

export function GuestManagement({
  eventId,
  onGuestUpdated,
  onImportGuests,
  onSendMessage,
}: GuestManagementProps) {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGuests, setSelectedGuests] = useState<Set<string>>(new Set());
  
  // Enhanced filtering and search with debouncing
  const [searchTerm, setSearchTerm] = useState('');
  const [filterByRSVP, setFilterByRSVP] = useState('all');
  const debouncedSearchTerm = useDebounce(searchTerm, 300); // 300ms debounce

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

  const fetchData = useCallback(async () => {
    setLoading(true);
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
    } catch (error) {
      logger.databaseError('Error fetching guests', error);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  // Set up real-time subscription using centralized hook
  const { } = useRealtimeSubscription({
    subscriptionId: `guest-management-${eventId}`,
    table: 'event_guests',
    event: '*',
    filter: `event_id=eq.${eventId}`,
    enabled: Boolean(eventId),
    onDataChange: useCallback(async (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      logger.realtime('Real-time guest update', { eventType: payload.eventType, guestId: payload.new?.id });
      // Refresh data when guests change
      await fetchData();
    }, [fetchData]),
    onError: useCallback((error: Error) => {
      logger.realtimeError('Guest management subscription error', error);
    }, [])
  });

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Enhanced RSVP update with optimistic updates and haptic feedback
  const handleRSVPUpdate = async (guestId: string, newStatus: string) => {
    try {
      triggerHaptic('light'); // Immediate feedback
      
      // Optimistic update
      setGuests(prev => 
        prev.map(p => 
          p.id === guestId 
            ? { ...p, rsvp_status: newStatus as 'attending' | 'declined' | 'maybe' | 'pending' }
            : p
        )
      );

      const { error } = await supabase
        .from('event_guests')
        .update({ rsvp_status: newStatus })
        .eq('id', guestId);

      if (error) throw error;
      
      triggerHaptic('success'); // Success feedback
      onGuestUpdated?.();
    } catch (error) {
      logger.databaseError('Error updating RSVP', error);
      triggerHaptic('error'); // Error feedback
      // Revert optimistic update on error
      await fetchData();
    }
  };

  const handleRemoveGuest = async (guestId: string) => {
    if (!confirm('Are you sure you want to remove this guest?')) return;

    try {
      const { error } = await supabase
        .from('event_guests')
        .delete()
        .eq('id', guestId);

      if (error) throw error;
      await fetchData();
      onGuestUpdated?.();
    } catch (error) {
      logger.databaseError('Error removing guest', error);
    }
  };

  // Bulk actions with haptic feedback
  const handleMarkAllPendingAsAttending = async () => {
    const pendingGuests = guests.filter(p => p.rsvp_status === 'pending');
    if (pendingGuests.length === 0) return;

    if (!confirm(`Mark ${pendingGuests.length} pending guests as attending?`)) return;

    try {
      triggerHaptic('medium'); // Medium feedback for bulk action
      
      const operations = pendingGuests.map(p =>
        supabase
          .from('event_guests')
          .update({ rsvp_status: 'attending' })
          .eq('id', p.id)
      );

      await Promise.all(operations);
      await fetchData();
      triggerHaptic('success'); // Success feedback
      onGuestUpdated?.();
    } catch (error) {
      logger.databaseError('Error updating pending RSVPs', error);
      triggerHaptic('error');
    }
  };

  const handleSendReminderToPending = () => {
    onSendMessage?.('reminder');
  };

  const handleBulkRSVPUpdate = async (newStatus: string) => {
    if (selectedGuests.size === 0) return;

    try {
      triggerHaptic('medium'); // Medium feedback for bulk action
      
      const operations = Array.from(selectedGuests).map(guestId =>
        supabase
          .from('event_guests')
          .update({ rsvp_status: newStatus })
          .eq('id', guestId)
      );

      await Promise.all(operations);
      await fetchData();
      setSelectedGuests(new Set());
      triggerHaptic('success'); // Success feedback
      onGuestUpdated?.();
    } catch (error) {
      logger.databaseError('Error updating RSVPs', error);
      triggerHaptic('error');
    }
  };
  
  // Attach pull-to-refresh listeners
  useEffect(() => {
    pullToRefresh.bindToElement(containerRef.current);
  }, [pullToRefresh]);

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
    attending: guests.filter(p => p.rsvp_status === 'attending').length,
    pending: guests.filter(p => p.rsvp_status === 'pending').length,
    maybe: guests.filter(p => p.rsvp_status === 'maybe').length,
    declined: guests.filter(p => p.rsvp_status === 'declined').length,
  }), [guests]);

  const selectAll = useCallback(() => {
    if (selectedGuests.size === filteredGuests.length) {
      setSelectedGuests(new Set());
    } else {
      setSelectedGuests(new Set(filteredGuests.map(p => p.id)));
    }
  }, [selectedGuests.size, filteredGuests]);

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
      style={{
        transform: pullToRefresh.isPulling ? `translateY(${Math.min(pullToRefresh.pullDistance, 100)}px)` : 'translateY(0)',
        transition: pullToRefresh.isPulling ? 'none' : 'transform 200ms ease-out'
      }}
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

      {/* Bulk Actions Sidebar for Mobile */}
      <BulkActionShortcuts
        onMarkAllPendingAsAttending={handleMarkAllPendingAsAttending}
        onSendReminderToPending={handleSendReminderToPending}
        onImportGuests={() => onImportGuests?.()}
        pendingCount={statusCounts.pending}
        totalCount={statusCounts.total}
        loading={loading}
      />

      {/* Selected Actions Bar */}
      {selectedGuests.size > 0 && (
        <div className="bg-[#FF6B6B] text-white rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="font-medium">
              {selectedGuests.size} guest{selectedGuests.size > 1 ? 's' : ''} selected
            </p>
            <button
              onClick={() => setSelectedGuests(new Set())}
              className="text-white/80 hover:text-white"
            >
              ✕
            </button>
          </div>
                     <div className="flex flex-wrap gap-2">
             <SecondaryButton
               onClick={() => handleBulkRSVPUpdate('attending')}
               className="bg-white text-gray-900 hover:bg-gray-100 py-2 px-3"
               fullWidth={false}
             >
               ✅ Attending
             </SecondaryButton>
             <SecondaryButton
               onClick={() => handleBulkRSVPUpdate('maybe')}
               className="bg-white text-gray-900 hover:bg-gray-100 py-2 px-3"
               fullWidth={false}
             >
               🤷‍♂️ Maybe
             </SecondaryButton>
             <SecondaryButton
               onClick={() => handleBulkRSVPUpdate('declined')}
               className="bg-white text-gray-900 hover:bg-gray-100 py-2 px-3"
               fullWidth={false}
             >
               ❌ Declined
             </SecondaryButton>
             <SecondaryButton
               onClick={() => handleBulkRSVPUpdate('pending')}
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
        {/* Header with Select All */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={selectedGuests.size === filteredGuests.length && filteredGuests.length > 0}
              onChange={selectAll}
              className="h-4 w-4 text-[#FF6B6B] focus:ring-[#FF6B6B] border-gray-300 rounded"
            />
            <span className="text-sm font-medium text-gray-700">
              {filteredGuests.length} guest{filteredGuests.length !== 1 ? 's' : ''}
              {searchTerm || filterByRSVP !== 'all' ? ` (filtered)` : ''}
            </span>
          </div>
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
              <div
                key={guest.id}
                className="p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedGuests.has(guest.id)}
                    onChange={(e) => {
                      const newSelected = new Set(selectedGuests);
                      if (e.target.checked) {
                        newSelected.add(guest.id);
                      } else {
                        newSelected.delete(guest.id);
                      }
                      setSelectedGuests(newSelected);
                    }}
                    className="mt-1 h-4 w-4 text-[#FF6B6B] focus:ring-[#FF6B6B] border-gray-300 rounded"
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {guest.users?.full_name || guest.guest_name || 'Unnamed Guest'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Role: {guest.role}
                        </p>
                      </div>
                      
                      {/* RSVP Status and Actions */}
                      <div className="flex flex-col items-end gap-2 ml-4">
                        <select
                          value={guest.rsvp_status || 'pending'}
                          onChange={(e) => handleRSVPUpdate(guest.id, e.target.value)}
                          className={cn(
                            'text-xs px-2 py-1 border rounded focus:ring-1 focus:ring-[#FF6B6B]',
                            'min-h-[32px] min-w-[80px]' // Touch-friendly
                          )}
                        >
                          <option value="attending">✅ Attending</option>
                          <option value="maybe">🤷‍♂️ Maybe</option>
                          <option value="declined">❌ Declined</option>
                          <option value="pending">⏳ Pending</option>
                        </select>
                        
                        <button
                          onClick={() => handleRemoveGuest(guest.id)}
                          className={cn(
                            'text-xs px-2 py-1 text-red-600 hover:text-red-700',
                            'hover:bg-red-50 rounded transition-colors',
                            'min-h-[32px] min-w-[60px]' // Touch-friendly
                          )}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContainer>
    </div>
  );
}
