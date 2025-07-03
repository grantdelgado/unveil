'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import type { Database } from '@/app/reference/supabase.types';

type Guest = Database['public']['Tables']['event_guests']['Row'] & {
  users: Database['public']['Tables']['users']['Row'] | null;
};

interface GuestListItemProps {
  guest: Guest;
  isSelected: boolean;
  onToggleSelect: (guestId: string, selected: boolean) => void;
  onRSVPUpdate: (guestId: string, newStatus: string) => void;
  onRemove: (guestId: string) => void;
}

export const GuestListItem = memo<GuestListItemProps>(({
  guest,
  isSelected,
  onToggleSelect,
  onRSVPUpdate,
  onRemove,
}) => {
  return (
    <div className="p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onToggleSelect(guest.id, e.target.checked)}
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
                onChange={(e) => onRSVPUpdate(guest.id, e.target.value)}
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
                onClick={() => onRemove(guest.id)}
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
  );
});

GuestListItem.displayName = 'GuestListItem';