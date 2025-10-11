'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
// useRouter import removed as it's no longer needed
// Core dependencies
import { useHostGuestDecline } from '@/hooks/guests';
import { supabase } from '@/lib/supabase/client';
import { sendSingleGuestInvite } from '@/lib/services/singleInvite';
import { useEventCapabilities } from '@/hooks/useEventCapabilities';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useEventRoleTotals } from '@/hooks/guests/useEventRoleTotals';

import { useSimpleGuestStore } from '@/hooks/guests/useSimpleGuestStore';
import { useUnifiedGuestCounts } from '@/hooks/guests';
import { GuestsFlags } from '@/lib/config/guests';

// Local components
import { SecondaryButton, PrimaryButton } from '@/components/ui';
import { GuestListItem } from './GuestListItem';
import { GuestControlPanel } from './GuestControlPanel';
import { ConfirmBulkInviteModal } from './ConfirmBulkInviteModal';
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
  // Router removed as it's no longer used after bulk invite modal integration

  // Enhanced state management with invitation status filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterByRSVP, setFilterByRSVP] = useState<
    'all' | 'attending' | 'declined' | 'not_invited' | 'invited'
  >('all');
  const [invitingGuestId, setInvitingGuestId] = useState<string | null>(null);
  const [showBulkInviteModal, setShowBulkInviteModal] = useState(false);
  const [roleActionLoading, setRoleActionLoading] = useState<string | null>(null);
  
  // Infinite scroll ref
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Get current user and capabilities
  const { session } = useAuth();
  const currentUserId = session?.user?.id;
  
  // Determine current user's role (assume host for guest management page)
  const currentUserRole = 'host' as const;
  
  const capabilities = useEventCapabilities({
    eventId,
    userRole: currentUserRole,
  });

  // Get accurate total counts for section headers
  const { 
    hostsTotal, 
    guestsTotal, 
    refetch: refetchTotals 
  } = useEventRoleTotals(eventId);

  // Data hooks with pagination support
  const { 
    guests, 
    loading, 
    refreshGuests, 
    hasMore, 
    isPaging, 
    loadNextPage 
  } = useSimpleGuestStore(eventId);

  // Use unified counts for consistency with dashboard
  const { counts: unifiedCounts, refresh: refreshCounts } =
    useUnifiedGuestCounts(eventId);

  // Note: Legacy RSVP mutations removed as part of RSVP-Lite hard cutover

  // RSVP-Lite: Host decline management
  const { clearGuestDecline } = useHostGuestDecline({
    eventId,
    onDeclineClearSuccess: () => {
      showSuccess('Guest decline status cleared successfully');
      refreshGuests(); // Refresh to get updated data
      refreshCounts(); // Refresh unified counts
      onGuestUpdated?.();
    },
  });

  // Handler for Send Invitations button - now opens confirmation modal
  const handleSendInvitations = useCallback(() => {
    setShowBulkInviteModal(true);
  }, []);

  // Role management handlers
  const handlePromoteToHost = useCallback(async (userId: string) => {
    if (!capabilities.canPromoteGuests) {
      showError('You do not have permission to promote guests');
      return;
    }

    // Log action attempt (PII-safe)
    console.info('ui.roles.action_clicked', {
      action: 'promote',
      target_user_id: userId,
    });

    setRoleActionLoading(userId);
    
    try {
      const response = await fetch('/api/roles/promote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId,
          userId, // This should be guest.user_id, not guest.id
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle specific error codes with appropriate user messages
        if (response.status === 401) {
          throw new Error('You need to be logged in to change roles');
        } else if (response.status === 403) {
          throw new Error("You don't have permission to change roles");
        } else if (response.status === 409) {
          // 409 should not happen in promote, but handle gracefully
          throw new Error('Role conflict - please refresh and try again');
        } else if (result.error === 'invalid_phone_unrelated') {
          // Phone validation should not occur in promote
          throw new Error("Couldn't make host. Please try again.");
        } else if (result.error === 'user_not_guest') {
          throw new Error('User is not a member of this event');
        } else {
          throw new Error(result.message || result.error || 'Failed to promote guest');
        }
      }

      showSuccess('Guest successfully promoted to host');
      refreshGuests();
      refreshCounts();
      refetchTotals(); // Update section header counts
      onGuestUpdated?.();

      // Log success (PII-safe)
      console.info('ui.roles.promote', {
        event_id: eventId,
        target_user_id: userId,
      });

    } catch (error) {
      console.error('Failed to promote guest:', error);
      showError(error instanceof Error ? error.message : 'Failed to promote guest');
    } finally {
      setRoleActionLoading(null);
    }
  }, [eventId, capabilities.canPromoteGuests, showError, showSuccess, refreshGuests, refreshCounts, refetchTotals, onGuestUpdated]);

  const handleDemoteFromHost = useCallback(async (userId: string) => {
    if (!capabilities.canDemoteHosts) {
      showError('You do not have permission to demote hosts');
      return;
    }

    // Prevent self-demotion
    if (userId === currentUserId) {
      showError('You cannot demote yourself');
      return;
    }

    // Log action attempt (PII-safe)
    console.info('ui.roles.action_clicked', {
      action: 'demote',
      target_user_id: userId,
    });

    setRoleActionLoading(userId);
    
    try {
      const response = await fetch('/api/roles/demote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId,
          userId, // This should be guest.user_id, not guest.id
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle specific error codes with appropriate user messages
        if (response.status === 401) {
          throw new Error('You need to be logged in to change roles');
        } else if (response.status === 403) {
          throw new Error("You don't have permission to change roles");
        } else if (response.status === 409) {
          throw new Error('You must keep at least one host');
        } else {
          throw new Error(result.message || result.error || 'Failed to demote host');
        }
      }

      showSuccess('Host successfully demoted to guest');
      refreshGuests();
      refreshCounts();
      refetchTotals(); // Update section header counts
      onGuestUpdated?.();

      // Log success (PII-safe)
      console.info('ui.roles.demote', {
        event_id: eventId,
        target_user_id: userId,
      });

    } catch (error) {
      console.error('Failed to demote host:', error);
      showError(error instanceof Error ? error.message : 'Failed to demote host');
    } finally {
      setRoleActionLoading(null);
    }
  }, [eventId, currentUserId, capabilities.canDemoteHosts, showError, showSuccess, refreshGuests, refreshCounts, refetchTotals, onGuestUpdated]);

  // Handler for bulk invite success
  const handleBulkInviteSuccess = useCallback(() => {
    refreshGuests(); // Refresh to get updated invitation status
    refreshCounts(); // Refresh unified counts
    onGuestUpdated?.();
  }, [refreshGuests, refreshCounts, onGuestUpdated]);

  // Handler for one-tap invite action
  const handleInviteGuest = useCallback(
    async (guestId: string) => {
      const guest = guests.find((g) => g.id === guestId);
      const guestName =
        guest?.guest_display_name ||
        guest?.guest_name ||
        guest?.users?.full_name ||
        'Guest';

      try {
        setInvitingGuestId(guestId);

        const result = await sendSingleGuestInvite({
          eventId,
          guestId,
        });

        if (!result.success) {
          throw new Error(result.error || 'Failed to send invitation');
        }

        // Show different success messages based on mode
        if (result.data?.simulationMode) {
          showSuccess(
            `🔧 DEV: Invitation simulated for ${guestName}! (No SMS sent)`,
          );
        } else if (result.data?.configMode === 'development-tunnel') {
          showSuccess(`📱 Invitation sent to ${guestName} via tunnel!`);
        } else {
          showSuccess(`📱 Invitation sent to ${guestName}!`);
        }

        refreshGuests(); // Refresh to get updated invitation status
        refreshCounts(); // Refresh unified counts
        onGuestUpdated?.();
      } catch (err) {
        console.error('Failed to send invitation:', err);

        // Show more helpful error messages based on error content
        let errorTitle = 'Invitation Failed';
        let errorMessage =
          err instanceof Error
            ? err.message
            : 'Failed to send invitation. Please try again.';

        if (errorMessage.includes('Public base URL not configured')) {
          errorTitle = 'Configuration Required';
          errorMessage =
            'SMS invitations require configuration. Check the console or documentation for setup instructions.';
        } else if (
          errorMessage.includes('DEV_TUNNEL_URL') ||
          errorMessage.includes('DEV_SIMULATE_INVITES')
        ) {
          errorTitle = 'Development Setup Required';
          errorMessage =
            'For local development, either set up a tunnel or enable simulation mode. Check the documentation for details.';
        }

        showError(errorTitle, errorMessage);
      } finally {
        setInvitingGuestId(null);
      }
    },
    [
      eventId,
      guests,
      showSuccess,
      showError,
      refreshGuests,
      refreshCounts,
      onGuestUpdated,
    ],
  );

  // Listen for guest data refresh events (e.g., after guest import)
  useEffect(() => {
    const handleGuestDataRefresh = (event: CustomEvent) => {
      if (event.detail?.eventId === eventId) {
        // Trigger refresh of both guest data and counts
        refreshGuests();
        refreshCounts(); // CRITICAL: Also refresh unified counts for Send Invitations button
      }
    };

    window.addEventListener(
      'guestDataRefresh',
      handleGuestDataRefresh as EventListener,
    );

    return () => {
      window.removeEventListener(
        'guestDataRefresh',
        handleGuestDataRefresh as EventListener,
      );
    };
  }, [eventId, refreshGuests, refreshCounts]);

  // Infinite scroll intersection observer
  useEffect(() => {
    if (!GuestsFlags.paginationEnabled || !loadMoreRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !isPaging && !loading) {
          // Debounce the load next page call
          const timeoutId = setTimeout(() => {
            loadNextPage();
          }, GuestsFlags.scrollDebounceMs);
          
          return () => clearTimeout(timeoutId);
        }
      },
      {
        threshold: 0.1,
        rootMargin: '100px', // Trigger 100px before the element is visible
      }
    );

    observer.observe(loadMoreRef.current);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isPaging, loading, loadNextPage]);

  // Reset pagination when filter or search changes
  useEffect(() => {
    if (GuestsFlags.paginationEnabled) {
      refreshGuests(); // This will reset to page 1
    }
  }, [filterByRSVP, searchTerm, refreshGuests]); // Reset when filter or search changes

  // Segment guests by role for hosts summary and list organization
  const { hosts, regularGuests } = useMemo(() => {
    if (!guests || !Array.isArray(guests)) return { hosts: [], regularGuests: [] };
    
    const hosts = guests.filter(guest => guest.role === 'host');
    const regularGuests = guests.filter(guest => guest.role !== 'host');
    
    // Log segment counts (PII-safe)
    console.info('ui.guests.segment_counts', {
      hosts: hosts.length,
      guests: regularGuests.length,
    });
    
    return { hosts, regularGuests };
  }, [guests]);

  // Note: Removed old filteredGuests logic - now using segmented filtering approach

  // Apply filtering to segmented lists
  const { filteredHosts, filteredRegularGuests } = useMemo(() => {
    const applyFilters = (guestList: typeof guests) => {
      if (!guestList || !Array.isArray(guestList)) return [];

      let filtered = guestList;

      // Apply search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        filtered = filtered.filter((guest) => {
          const displayName = guest.guest_display_name?.toLowerCase() || '';
          const guestName = guest.guest_name?.toLowerCase() || '';
          const phone = guest.phone?.toLowerCase() || '';
          const userFullName = guest.users?.full_name?.toLowerCase() || '';

          return (
            displayName.includes(searchLower) ||
            guestName.includes(searchLower) ||
            phone.includes(searchLower) ||
            userFullName.includes(searchLower)
          );
        });
      }

      // Apply invitation status filter
      if (filterByRSVP !== 'all') {
        filtered = filtered.filter((guest) => {
          const hasDeclined = !!guest.declined_at;
          const hasBeenInvited = !!guest.last_invited_at;

          switch (filterByRSVP) {
            case 'declined':
              return hasDeclined;
            case 'invited':
              return hasBeenInvited && !hasDeclined;
            case 'not_invited':
              return !hasBeenInvited && !hasDeclined;
            case 'attending':
              return !hasDeclined;
            default:
              return true;
          }
        });
      }

      return filtered;
    };

    return {
      filteredHosts: applyFilters(hosts),
      filteredRegularGuests: applyFilters(regularGuests),
    };
  }, [hosts, regularGuests, searchTerm, filterByRSVP]);

  // Log section counts when rendered (PII-safe)
  useEffect(() => {
    if (hostsTotal > 0 || guestsTotal > 0) {
      console.info('ui.guests.section_counts_rendered', {
        hosts_total: hostsTotal,
        guests_total: guestsTotal,
        hosts_filtered: filteredHosts.length,
        guests_filtered: filteredRegularGuests.length,
        has_filters: !!(searchTerm || filterByRSVP !== 'all'),
      });
    }
  }, [hostsTotal, guestsTotal, filteredHosts.length, filteredRegularGuests.length, searchTerm, filterByRSVP]);

  // Note: RSVP updates now handled through decline/clear decline actions only
  // Legacy RSVP dropdown removed as part of RSVP-Lite hard cutover

  // Guest removal with soft-delete
  const handleRemoveGuestWithFeedback = useCallback(
    async (guestId: string) => {
      const guest = guests.find((g) => g.id === guestId);
      const guestName =
        guest?.guest_display_name ||
        guest?.guest_name ||
        guest?.users?.full_name ||
        'Guest';

      if (
        !confirm(
          `Remove ${guestName} from the guest list? They will no longer receive updates about this event.`,
        )
      ) {
        return;
      }

      try {
        const { error } = await supabase.rpc('soft_delete_guest', {
          p_guest_id: guestId,
        });

        if (error) throw error;

        showSuccess(`${guestName} has been removed from the guest list`);

        // Comprehensive cache invalidation for membership changes
        refreshGuests(); // Refresh guest data
        refreshCounts(); // Refresh unified counts
        onGuestUpdated?.(); // Notify parent components

        // Invalidate user events to update "Choose an event" list immediately
        // This ensures removed guests no longer see the event
        const queryClient = (window as unknown as Record<string, unknown>)
          .__queryClient;
        if (
          queryClient &&
          typeof queryClient === 'object' &&
          'invalidateQueries' in queryClient
        ) {
          const qc = queryClient as {
            invalidateQueries: (options: { queryKey: string[] }) => void;
          };
          qc.invalidateQueries({ queryKey: ['events'] });
          qc.invalidateQueries({ queryKey: ['user-events'] });
        }
      } catch (err) {
        console.error('Failed to remove guest:', err);
        showError('Remove Failed', 'Failed to remove guest. Please try again.');
      }
    },
    [
      guests,
      showSuccess,
      showError,
      refreshGuests,
      refreshCounts,
      onGuestUpdated,
    ],
  );

  // RSVP-Lite: Clear guest decline handler
  const handleClearGuestDecline = useCallback(
    async (guestUserId: string) => {
      const guest = guests.find((g) => g.user_id === guestUserId);
      const guestName =
        guest?.guest_display_name ||
        guest?.guest_name ||
        guest?.users?.full_name ||
        'Guest';

      if (
        !confirm(
          `Clear decline status for ${guestName}? They will be able to receive day-of logistics again.`,
        )
      ) {
        return;
      }

      try {
        await clearGuestDecline(guestUserId);
      } catch {
        showError(
          'Clear Failed',
          'Failed to clear decline status. Please try again.',
        );
      }
    },
    [clearGuestDecline, guests, showError],
  );

  // Note: Bulk RSVP actions removed as part of RSVP-Lite hard cutover
  // Guests are either attending (default) or declined (via "Can't make it" button)

  // Use unified counts for consistency with dashboard
  const simplifiedCounts: GuestStatusCounts = useMemo(
    () => ({
      total: unifiedCounts.total_guests,
      attending: unifiedCounts.attending,
      declined: unifiedCounts.declined,
      not_invited: unifiedCounts.not_invited,
      invited: unifiedCounts.total_invited,
    }),
    [unifiedCounts],
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Loading skeleton - simplified */}
        <div className="animate-pulse space-y-4">
          <div className="h-20 bg-gray-200 rounded-lg"></div>
          <div className="h-16 bg-gray-200 rounded-lg"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
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
        onSendInvitations={handleSendInvitations}
        hasGuests={guests.length > 0}
      />

      {/* Segmented Guest List */}
      {filteredHosts.length === 0 && filteredRegularGuests.length === 0 ? (
        <div className="bg-white rounded-lg p-8 text-center shadow-sm border border-gray-100">
          <div className="text-6xl mb-4">
            {searchTerm || filterByRSVP !== 'all' ? '🔍' : '👥'}
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {searchTerm || filterByRSVP !== 'all'
              ? 'No matching guests'
              : 'No guests yet'}
          </h3>
          <p className="text-gray-600 mb-6">
            {searchTerm || filterByRSVP !== 'all'
              ? 'Try adjusting your search or filter to find guests.'
              : 'Get started by adding guests individually or importing from a CSV file.'}
          </p>
          {!searchTerm && filterByRSVP === 'all' && (
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
        <div className="space-y-4">
          {/* Hosts Section */}
          {filteredHosts.length > 0 && (
            <div id="hosts-section">
              {/* Sticky Header */}
              <div 
                className="sticky top-0 bg-white/80 backdrop-blur-sm border-b border-gray-200 px-4 py-3 z-10"
                role="heading"
                aria-level={2}
              >
                <h2 className="text-lg font-semibold text-gray-900">
                  HOSTS ({searchTerm || filterByRSVP !== 'all' ? `${filteredHosts.length} of ${hostsTotal}` : hostsTotal})
                </h2>
              </div>
              
              {/* Host Items */}
              <div className="space-y-1 pt-2">
                {filteredHosts.map((guest) => (
                  <GuestListItem
                    key={guest.id}
                    guest={guest}
                    onRemove={() => handleRemoveGuestWithFeedback(guest.id)}
                    onClearDecline={handleClearGuestDecline}
                    onInvite={handleInviteGuest}
                    inviteLoading={invitingGuestId === guest.id}
                    onPromoteToHost={handlePromoteToHost}
                    onDemoteFromHost={handleDemoteFromHost}
                    roleActionLoading={roleActionLoading === guest.user_id}
                    eventId={eventId}
                    currentUserRole={currentUserRole}
                    currentUserId={currentUserId}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Guests Section */}
          {filteredRegularGuests.length > 0 && (
            <div id="guests-section">
              {/* Sticky Header */}
              <div 
                className="sticky top-0 bg-white/80 backdrop-blur-sm border-b border-gray-200 px-4 py-3 z-10"
                role="heading"
                aria-level={2}
              >
                <h2 className="text-lg font-semibold text-gray-900">
                  GUESTS ({searchTerm || filterByRSVP !== 'all' ? `${filteredRegularGuests.length} of ${guestsTotal}` : guestsTotal})
                </h2>
              </div>
              
              {/* Guest Items */}
              <div className="space-y-1 pt-2">
                {filteredRegularGuests.map((guest) => (
                  <GuestListItem
                    key={guest.id}
                    guest={guest}
                    onRemove={() => handleRemoveGuestWithFeedback(guest.id)}
                    onClearDecline={handleClearGuestDecline}
                    onInvite={handleInviteGuest}
                    inviteLoading={invitingGuestId === guest.id}
                    onPromoteToHost={handlePromoteToHost}
                    onDemoteFromHost={handleDemoteFromHost}
                    roleActionLoading={roleActionLoading === guest.user_id}
                    eventId={eventId}
                    currentUserRole={currentUserRole}
                    currentUserId={currentUserId}
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* Infinite scroll loading sentinel */}
          {GuestsFlags.paginationEnabled && hasMore && (
            <div 
              ref={loadMoreRef}
              className="flex items-center justify-center py-6"
              aria-label="Loading more guests"
            >
              {isPaging ? (
                <div className="flex items-center gap-3 text-gray-500">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-pink-500"></div>
                  <span className="text-sm font-medium">Loading more guests...</span>
                </div>
              ) : (
                <div className="h-4" /> // Invisible trigger area
              )}
            </div>
          )}
        </div>
      )}

      {/* Bulk Invite Confirmation Modal */}
      <ConfirmBulkInviteModal
        isOpen={showBulkInviteModal}
        onClose={() => setShowBulkInviteModal(false)}
        onSuccess={handleBulkInviteSuccess}
        eventId={eventId}
        eligibleCount={simplifiedCounts.not_invited}
        excludedReasons={[
          'Guests without valid phone numbers',
          'Guests who opted out of SMS',
          'Guests already invited',
          'Hosts (cannot be invited)',
        ]}
      />
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
