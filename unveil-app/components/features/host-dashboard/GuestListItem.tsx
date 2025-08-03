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
  isSelected: boolean;
  onToggleSelect: (guestId: string, selected: boolean) => void;
  onRSVPUpdate: (guestId: string, newStatus: RSVPStatus) => void;
  onRemove: (guestId: string) => void;
}

export const GuestListItem = memo<GuestListItemProps>(({
  guest,
  isSelected,
  onToggleSelect,
  onRSVPUpdate,
  onRemove,
}) => {
  // Normalize RSVP status to handle legacy values
  const currentStatus = normalizeRSVPStatus(guest.rsvp_status);
  const statusConfig = getRSVPStatusConfig(currentStatus);
  
  // Guest display name with fallback
  const displayName = guest.users?.full_name || guest.guest_name || 'Unnamed Guest';
  const displayEmail = guest.users?.email || guest.guest_email;
  
  return (
    <div className="p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onToggleSelect(guest.id, e.target.checked)}
          className="mt-1 h-11 w-11 text-[#FF6B6B] focus:ring-[#FF6B6B] border-gray-300 rounded"
          aria-label={`Select ${displayName}`}
        />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-gray-900 truncate">
                {displayName}
              </h3>
              <div className="flex flex-col gap-1 mt-1">
                <p className="text-xs text-gray-500">
                  Phone: {guest.phone}
                </p>
                {displayEmail && (
                  <p className="text-xs text-gray-500">
                    Email: {displayEmail}
                  </p>
                )}
                <p className="text-xs text-gray-500">
                  Role: {guest.role}
                </p>
              </div>
            </div>
            
            {/* RSVP Status and Actions */}
            <div className="flex flex-col items-end gap-2 ml-4">
              <select
                value={currentStatus}
                onChange={(e) => onRSVPUpdate(guest.id, e.target.value as RSVPStatus)}
                className={cn(
                  'text-xs px-3 py-2 border rounded focus:ring-2 focus:ring-[#FF6B6B] focus:border-[#FF6B6B]',
                  'min-h-[44px] min-w-[120px]', // Improved touch-friendly size
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
              
              <button
                onClick={() => onRemove(guest.id)}
                className={cn(
                  'text-xs px-3 py-2 text-red-600 hover:text-red-700',
                  'hover:bg-red-50 rounded transition-colors',
                  'border border-red-200 hover:border-red-300',
                  'min-h-[44px] min-w-[80px]' // Improved touch-friendly size
                )}
                aria-label={`Remove ${displayName} from guest list`}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

GuestListItem.displayName = 'GuestListItem';