'use client';

import { memo, useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { isDeclined } from '@/lib/guests/attendance';
import { HeaderChip } from './HeaderChip';
import { UserAvatar } from '@/components/common/UserAvatar';
import { useEventCapabilities } from '@/hooks/useEventCapabilities';
import type { OptimizedGuest } from './types';

interface GuestListItemProps {
  guest: OptimizedGuest;
  onRemove: () => void;
  onClearDecline?: (guestUserId: string) => void;
  onInvite?: (guestId: string) => Promise<void>; // Now async for one-tap invite
  inviteLoading?: boolean; // Loading state for invite action
  onPromoteToHost?: (userId: string) => Promise<void>; // Role management
  onDemoteFromHost?: (userId: string) => Promise<void>; // Role management
  roleActionLoading?: boolean; // Loading state for role actions
  eventId: string; // Required for capability checking
  currentUserRole: 'host' | 'guest' | null; // Current user's role
  currentUserId?: string | null; // Current user's ID for self-action prevention
}

// Helper function to format relative time
const formatRelativeTime = (timestamp: string | null): string => {
  if (!timestamp) return '';

  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  } catch {
    return '';
  }
};

export const GuestListItem = memo<GuestListItemProps>(
  ({ 
    guest, 
    onRemove, 
    onClearDecline, 
    onInvite, 
    inviteLoading = false,
    onPromoteToHost,
    onDemoteFromHost,
    roleActionLoading = false,
    eventId,
    currentUserRole,
    currentUserId,
  }) => {
    const [showOverflow, setShowOverflow] = useState(false);
    const [showPromoteConfirm, setShowPromoteConfirm] = useState(false);
    const [showDemoteConfirm, setShowDemoteConfirm] = useState(false);
    const overflowRef = useRef<HTMLDivElement>(null);

    // Get capabilities for current user
    const capabilities = useEventCapabilities({
      eventId,
      userRole: currentUserRole,
    });

    // Close overflow menu when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          overflowRef.current &&
          !overflowRef.current.contains(event.target as Node)
        ) {
          setShowOverflow(false);
        }
      };

      if (showOverflow) {
        document.addEventListener('mousedown', handleClickOutside);
        return () =>
          document.removeEventListener('mousedown', handleClickOutside);
      }
    }, [showOverflow]);

    // Use computed guest display name from database
    const displayName =
      guest.guest_display_name ||
      guest.users?.full_name ||
      guest.guest_name ||
      'Unnamed Guest';


    // State analysis
    const hasDeclined = isDeclined(guest);
    // Use last_invited_at as the primary indicator of invitation status
    // This ensures we only show "Invited" for actual invitations, not regular messages
    const hasBeenInvited = !!guest.last_invited_at;
    const isHost = guest.role === 'host';
    const isOptedOut = !!guest.sms_opt_out;

    // Determine primary action/status
    const canInvite =
      !hasBeenInvited &&
      !hasDeclined &&
      !isHost &&
      !isOptedOut &&
      !!guest.phone;
    const declineReason = guest.decline_reason;

    // Note: currentUserId used for self-action prevention in role management
    const isSelf = guest.user_id === currentUserId;

    // Confirmation dialog handlers
    const handlePromoteClick = () => {
      setShowOverflow(false);
      setShowPromoteConfirm(true);
      
      // PII-safe logging
      console.info('ui.roles.promote_click', {
        target_user_id: guest.user_id,
      });
    };

    const handleDemoteClick = () => {
      setShowOverflow(false);
      setShowDemoteConfirm(true);
      
      // PII-safe logging
      console.info('ui.roles.demote_click', {
        target_user_id: guest.user_id,
      });
    };

    const handleConfirmPromote = async () => {
      setShowPromoteConfirm(false);
      if (onPromoteToHost && guest.user_id) {
        await onPromoteToHost(guest.user_id);
      }
    };

    const handleConfirmDemote = async () => {
      setShowDemoteConfirm(false);
      if (onDemoteFromHost && guest.user_id) {
        await onDemoteFromHost(guest.user_id);
      }
    };

    return (
      <div 
        className="relative p-4 bg-white border border-gray-100 rounded-lg hover:shadow-sm transition-all duration-200"
        data-testid="guest-list-item"
        data-role={guest.role}
      >
        {/* Header: Avatar + Name + Actions */}
        <div className="flex items-center justify-between gap-3 mb-3">
          {/* Left: Avatar + Name + Role (flexible) */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <UserAvatar
              id={guest.user_id || guest.id}
              name={displayName}
              imageUrl={null}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <h3 className="text-[15px] font-medium leading-5 min-w-0">
                <span className="block truncate sm:line-clamp-2 sm:whitespace-normal">
                  {displayName}
                </span>
              </h3>
              {/* Role Chip - positioned below name on mobile, inline on desktop */}
              <div className="mt-1 sm:mt-0 sm:inline-flex sm:ml-2">
                <span
                  className={cn(
                    "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                    isHost 
                      ? "bg-purple-100 text-purple-800 border border-purple-200" 
                      : "bg-gray-100 text-gray-600 border border-gray-200"
                  )}
                >
                  {isHost ? "👑 HOST" : "GUEST"}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Uniform Action/Status + Fixed Ellipsis Position */}
          <div className="flex items-center gap-2 shrink-0 w-[140px] sm:w-[180px] justify-end">
            {/* Primary Action Slot - Uniform HeaderChip */}
            {hasDeclined ? (
              <HeaderChip
                variant="warning"
                icon="❌"
                label="Declined"
                microcopy={
                  guest.declined_at
                    ? formatRelativeTime(guest.declined_at)
                    : undefined
                }
                aria-label={`Guest declined ${guest.declined_at ? formatRelativeTime(guest.declined_at) : ''}`}
              />
            ) : isHost ? (
              <HeaderChip
                variant="neutral"
                icon="👑"
                label="Host"
                aria-label="Event host"
              />
            ) : isOptedOut ? (
              <HeaderChip
                variant="destructive"
                icon="🚫"
                label="Opted out"
                aria-label="Guest has opted out of SMS"
              />
            ) : canInvite && onInvite ? (
              <HeaderChip
                variant="primary"
                icon="📨"
                label="Invite"
                onClick={() => onInvite(guest.id)}
                disabled={inviteLoading}
                loading={inviteLoading}
                loadingText="Sending..."
                aria-label={`Send invitation to ${displayName}`}
              />
            ) : hasBeenInvited ? (
              <HeaderChip
                variant="success"
                icon="📬"
                label="Invited"
                microcopy={
                  guest.last_invited_at
                    ? `Sent ${formatRelativeTime(guest.last_invited_at)}`
                    : undefined
                }
                aria-label={`Guest invited ${guest.last_invited_at ? formatRelativeTime(guest.last_invited_at) : ''}`}
              />
            ) : (
              <HeaderChip
                variant="muted"
                icon="📝"
                label="Not Invited"
                aria-label="Guest not yet invited"
              />
            )}

            {/* Fixed Ellipsis Position - Always in upper right */}
            <div className="relative z-20" ref={overflowRef}>
              <button
                onClick={() => {
                  setShowOverflow(!showOverflow);
                  // PII-safe logging
                  if (!showOverflow) {
                    console.info('ui.roles.open_menu', {
                      target_user_id: guest.user_id,
                    });
                  }
                }}
                className={cn(
                  'p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md',
                  'min-h-[44px] min-w-[44px] flex items-center justify-center',
                  'focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-1',
                )}
                aria-label={`Open actions for ${displayName}`}
                aria-expanded={showOverflow}
                aria-haspopup="menu"
              >
                ⋯
              </button>

              {/* Overflow Menu Dropdown */}
              {showOverflow && (
                <div
                  className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-[60] min-w-[140px]"
                  role="menu"
                  style={{
                    // Ensure menu doesn't get cut off at viewport edges
                    maxHeight: '80vh',
                    overflowY: 'auto',
                  }}
                >
                  {/* Role Management Options */}
                  {capabilities.canPromoteGuests && onPromoteToHost && !isSelf && (
                    // Show "Make Host" for linked guests, or info message for unlinked guests
                    guest.user_id && guest.role === 'guest' ? (
                      <button
                        onClick={handlePromoteClick}
                        disabled={roleActionLoading}
                        className={cn(
                          'w-full px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50',
                          'flex items-center gap-2 focus:outline-none focus:bg-blue-50 min-h-[44px]',
                          'disabled:opacity-50 disabled:cursor-not-allowed',
                        )}
                        role="menuitem"
                        aria-label={`Make ${displayName} a host`}
                      >
                        <span>👑</span>
                        <span>{roleActionLoading ? 'Promoting...' : 'Make Host'}</span>
                      </button>
                    ) : !guest.user_id && guest.role === 'guest' ? (
                      <div
                        className="w-full px-3 py-2 text-left text-sm text-gray-500"
                        role="menuitem"
                        aria-label={`${displayName} must create an account to become a host`}
                      >
                        <div className="flex items-center gap-2">
                          <span>👑</span>
                          <div className="flex-1">
                            <div className="font-medium">Make Host</div>
                            <div className="text-xs text-gray-400">Requires account</div>
                          </div>
                        </div>
                      </div>
                    ) : null
                  )}

                  {capabilities.canDemoteHosts && guest.user_id && guest.role === 'host' && onDemoteFromHost && !isSelf && (
                    <button
                      onClick={handleDemoteClick}
                      disabled={roleActionLoading}
                      className={cn(
                        'w-full px-3 py-2 text-left text-sm text-orange-600 hover:bg-orange-50',
                        'flex items-center gap-2 focus:outline-none focus:bg-orange-50 min-h-[44px]',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                      )}
                      role="menuitem"
                      aria-label={`Remove host from ${displayName}`}
                    >
                      <span>👤</span>
                      <span>{roleActionLoading ? 'Demoting...' : 'Remove Host'}</span>
                    </button>
                  )}

                  {/* Divider if role options are shown */}
                  {capabilities.canPromoteGuests && guest.user_id && (
                    (guest.role === 'guest' && onPromoteToHost) || 
                    (guest.role === 'host' && onDemoteFromHost)
                  ) && (
                    <div className="border-t border-gray-200 my-1" />
                  )}

                  {/* Remove Guest Option */}
                  <button
                    onClick={() => {
                      setShowOverflow(false);
                      onRemove();
                    }}
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50',
                      'flex items-center gap-2 focus:outline-none focus:bg-red-50 min-h-[44px]',
                    )}
                    role="menuitem"
                  >
                    <span>🗑️</span>
                    <span>Remove</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Body: Contact Information */}
        <div className="space-y-1 mt-3">
          {guest.phone && (
            <p className="text-sm text-gray-600 leading-tight">
              📱 {guest.phone}
            </p>
          )}

        </div>

        {/* Decline Details (only for declined guests) */}
        {hasDeclined && declineReason && (
          <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-amber-700 italic break-words">
                  &quot;{declineReason}&quot;
                </p>
              </div>
              {onClearDecline && guest.user_id && (
                <button
                  onClick={() => onClearDecline(guest.user_id!)}
                  className={cn(
                    'text-xs px-2 py-1 text-amber-700 hover:text-amber-800',
                    'hover:bg-amber-100 rounded-md transition-colors duration-200',
                    'border border-amber-300 hover:border-amber-400',
                    'min-h-[44px] font-medium flex-shrink-0',
                  )}
                  aria-label={`Clear decline status for ${displayName}`}
                >
                  Clear decline
                </button>
              )}
            </div>
          </div>
        )}

        {/* SMS Opt-Out Warning (for opted-out guests with phone numbers) */}
        {isOptedOut && guest.phone && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <span className="text-red-500 text-sm">📵</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-red-700 font-medium">
                  SMS disabled
                </p>
                <p className="text-xs text-red-600 mt-1">
                  Guest has opted out of text messages. They can text UNSTOP to re-enable.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Dialogs */}
        {showPromoteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Make {displayName} a host?
              </h3>
              <p className="text-gray-600 mb-4">
                They&apos;ll be able to message, manage guests, and edit the schedule.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowPromoteConfirm(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmPromote}
                  disabled={roleActionLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium"
                >
                  {roleActionLoading ? 'Promoting...' : 'Make Host'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showDemoteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Remove host access from {displayName}?
              </h3>
              <p className="text-gray-600 mb-4">
                You must keep at least one host.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDemoteConfirm(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDemote}
                  disabled={roleActionLoading}
                  className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 font-medium"
                >
                  {roleActionLoading ? 'Removing...' : 'Remove Host'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  },
);

GuestListItem.displayName = 'GuestListItem';
