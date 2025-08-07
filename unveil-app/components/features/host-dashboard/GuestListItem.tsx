'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { 
  RSVP_STATUS_VALUES, 
  getRSVPStatusConfig, 
  normalizeRSVPStatus,
  type RSVPStatus 
} from '@/lib/types/rsvp';
import type { OptimizedGuest } from './types';

interface GuestListItemProps {
  guest: OptimizedGuest;
  onRSVPUpdate: (guestId: string, newStatus: RSVPStatus) => void;
  onRemove: (guestId: string) => void;
}

export const GuestListItem = memo<GuestListItemProps>(({
  guest,
  onRSVPUpdate,
  onRemove,
}) => {
  // Normalize RSVP status to handle legacy values
  const currentStatus = normalizeRSVPStatus(guest.rsvp_status);
  const statusConfig = getRSVPStatusConfig(currentStatus);
  
  // Use computed guest display name from database
  const displayName = guest.guest_display_name || guest.users?.full_name || guest.guest_name || 'Unnamed Guest';
  const displayEmail = guest.users?.email || guest.guest_email;
  
  return (
    <div className="p-4 bg-white border border-gray-100 rounded-lg hover:shadow-sm transition-all duration-200 m-3">
      <div className="space-y-3">
        {/* Guest Name - Full Width */}
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            {displayName}
          </h3>
        </div>
        
        {/* RSVP Status Dropdown - Below Name */}
        <div className="flex justify-start">
          <select
            value={currentStatus}
            onChange={(e) => onRSVPUpdate(guest.id, e.target.value as RSVPStatus)}
            className={cn(
              'text-sm px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-300 focus:border-pink-300',
              'min-h-[44px] min-w-[130px] transition-colors duration-200',
              statusConfig.bgColor,
              statusConfig.textColor,
              statusConfig.borderColor
            )}
            aria-label={`RSVP status for ${displayName}. Currently ${statusConfig.label}`}
          >
            {RSVP_STATUS_VALUES.map((status) => {
              const config = getRSVPStatusConfig(status);
              return (
                <option key={status} value={status}>
                  {config.emoji} {config.label}
                </option>
              );
            })}
          </select>
        </div>

        {/* Contact Information */}
        <div className="space-y-1">
          <p className="text-sm text-gray-600">
            📱 {guest.phone}
          </p>
          {displayEmail && (
            <p className="text-sm text-gray-600">
              ✉️ {displayEmail}
            </p>
          )}
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
            {guest.role}
          </p>
        </div>

        {/* Bottom Row: Remove Button */}
        <div className="flex justify-end pt-2 border-t border-gray-50">
          <button
            onClick={() => {
              if (window.confirm(`Are you sure you want to remove ${displayName} from the guest list?`)) {
                onRemove(guest.id);
              }
            }}
            className={cn(
              'text-sm px-4 py-2 text-red-600 hover:text-red-700',
              'hover:bg-red-50 rounded-lg transition-colors duration-200',
              'border border-red-200 hover:border-red-300',
              'min-h-[44px] min-w-[100px] font-medium'
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