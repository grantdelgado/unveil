'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { isDeclined } from '@/lib/guests/attendance';
import type { OptimizedGuest } from './types';

interface GuestListItemProps {
  guest: OptimizedGuest;
  onRemove: (guestId: string) => void;
  onClearDecline?: (guestUserId: string) => void;
}

export const GuestListItem = memo<GuestListItemProps>(({
  guest,
  onRemove,
  onClearDecline,
}) => {
  // Use computed guest display name from database
  const displayName = guest.guest_display_name || guest.users?.full_name || guest.guest_name || 'Unnamed Guest';
  const displayEmail = guest.users?.email || guest.guest_email;
  
  // RSVP-Lite: Check attendance status using declined_at
  const hasDeclined = isDeclined(guest);

  const declineReason = guest.decline_reason;
  
  return (
    <div className="p-2 bg-white border border-gray-100 rounded-lg hover:shadow-sm transition-all duration-200 m-1">
      <div className="space-y-1">
        {/* Top Row: Guest Name + Attendance Status */}
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-gray-900 leading-tight flex-1 truncate">
            {displayName}
          </h3>
          <div className={cn(
            'text-xs px-2 py-1 border rounded-md',
            'min-h-[28px] min-w-[110px] flex items-center justify-center',
            hasDeclined 
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-green-50 text-green-700 border-green-200'
          )}>
            {hasDeclined ? '❌ Declined' : '✅ Attending'}
          </div>
        </div>

        {/* Contact Information */}
        <div className="space-y-0.5">
          <p className="text-sm text-gray-600 leading-tight">
            📱 {guest.phone}
          </p>
          {displayEmail && (
            <p className="text-sm text-gray-600 leading-tight">
              ✉️ {displayEmail}
            </p>
          )}
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
            {guest.role}
          </p>
        </div>

        {/* RSVP-Lite: Decline Status Indicator */}
        {hasDeclined && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-amber-600 text-sm">⚠️</span>
                  <span className="text-sm font-medium text-amber-800">
                    Can&apos;t make it
                  </span>
                </div>
                {declineReason && (
                  <p className="text-xs text-amber-700 italic break-words">
                    &quot;{declineReason}&quot;
                  </p>
                )}
              </div>
              {onClearDecline && guest.user_id && (
                <button
                  onClick={() => onClearDecline(guest.user_id!)}
                  className={cn(
                    'text-xs px-2 py-1 text-amber-700 hover:text-amber-800',
                    'hover:bg-amber-100 rounded-md transition-colors duration-200',
                    'border border-amber-300 hover:border-amber-400',
                    'min-h-[24px] font-medium ml-2 flex-shrink-0'
                  )}
                  aria-label={`Clear decline status for ${displayName}`}
                >
                  Clear decline
                </button>
              )}
            </div>
          </div>
        )}

        {/* Bottom Right: Remove Button */}
        <div className="flex justify-end">
          <button
            onClick={() => onRemove(guest.id)}
            className={cn(
              'text-xs px-2 py-1 text-red-600 hover:text-red-700',
              'hover:bg-red-50 rounded-md transition-colors duration-200',
              'border border-red-200 hover:border-red-300',
              'min-h-[24px] min-w-[70px] font-medium'
            )}
            aria-label={`Remove ${displayName} from guest list`}
          >
            🗑️ Remove
          </button>
        </div>
      </div>
    </div>
  );
});

GuestListItem.displayName = 'GuestListItem';