'use client';

import { memo, useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { isDeclined } from '@/lib/guests/attendance';
import { HeaderChip } from './HeaderChip';
import type { OptimizedGuest } from './types';

interface GuestListItemProps {
  guest: OptimizedGuest;
  onRemove: () => void;
  onClearDecline?: (guestUserId: string) => void;
  onInvite?: (guestId: string) => Promise<void>; // Now async for one-tap invite
  inviteLoading?: boolean; // Loading state for invite action
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
  ({ guest, onRemove, onClearDecline, onInvite, inviteLoading = false }) => {
    const [showOverflow, setShowOverflow] = useState(false);
    const overflowRef = useRef<HTMLDivElement>(null);

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

    return (
      <div className="relative p-4 bg-white border border-gray-100 rounded-lg hover:shadow-sm transition-all duration-200">
        {/* Header: Name + Role Chip + Single Contextual Action */}
        <div className="flex items-start justify-between gap-3 mb-3">
          {/* Left: Name + Role */}
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-gray-900 leading-tight truncate mb-1">
              {displayName}
            </h3>
            <span
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide',
                isHost
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-gray-100 text-gray-600',
              )}
            >
              {guest.role}
            </span>
          </div>

          {/* Right: Uniform Action/Status + Fixed Ellipsis Position */}
          <div className="flex items-start gap-2">
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
            <div className="relative" ref={overflowRef}>
              <button
                onClick={() => setShowOverflow(!showOverflow)}
                className={cn(
                  'p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md',
                  'min-h-[44px] min-w-[44px] flex items-center justify-center',
                  'focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-1',
                )}
                aria-label="More actions"
                aria-expanded={showOverflow}
                aria-haspopup="menu"
              >
                ⋯
              </button>

              {/* Overflow Menu Dropdown */}
              {showOverflow && (
                <div
                  className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 min-w-[120px]"
                  role="menu"
                >
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
      </div>
    );
  },
);

GuestListItem.displayName = 'GuestListItem';
