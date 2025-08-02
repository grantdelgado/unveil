'use client';

import { memo, useMemo, useRef, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
import { cn } from '@/lib/utils';
import { RSVPStatus } from '@/lib/types/rsvp';
import { OptimizedGuest, PaginationInfo } from '../shared/types';
import { GuestListItem } from '../../host-dashboard/GuestListItem';
import { GuestListEmpty } from './GuestListEmpty';
import { GuestListShimmer } from './GuestListShimmer';
import { CardContainer } from '@/components/ui';

export interface GuestListProps {
  guests: OptimizedGuest[];
  selectedGuests: Set<string>;
  onToggleSelect: (guestId: string, selected: boolean) => void;
  onRSVPUpdate: (guestId: string, newStatus: RSVPStatus) => Promise<void>;
  onRemove: (guestId: string) => Promise<void>;
  loading: boolean;
  pagination: PaginationInfo;
  onLoadMore: () => void;
  className?: string;
}

// Threshold for enabling virtualization
const VIRTUALIZATION_THRESHOLD = 100;
const ITEM_HEIGHT = 80; // Height of each guest list item in pixels
const LIST_HEIGHT = 600; // Maximum height of the virtualized list

/**
 * Smart guest list component with conditional virtualization
 * Uses react-window for large lists (>100 guests) and regular rendering for smaller lists
 */
export const GuestList = memo<GuestListProps>(({
  guests,
  selectedGuests,
  onToggleSelect,
  onRSVPUpdate,
  onRemove,
  loading,
  pagination,
  onLoadMore,
  className
}) => {
  const listRef = useRef<List>(null);
  
  // Decide whether to use virtualization based on guest count
  const shouldVirtualize = guests.length >= VIRTUALIZATION_THRESHOLD;
  
  // Memoized item data for virtualization
  const itemData = useMemo(() => ({
    guests,
    selectedGuests,
    onToggleSelect,
    onRSVPUpdate,
    onRemove,
  }), [guests, selectedGuests, onToggleSelect, onRSVPUpdate, onRemove]);

  // Virtualized row renderer
  interface VirtualizedRowProps {
    index: number;
    style: React.CSSProperties;
    data: {
      guests: OptimizedGuest[];
      selectedGuests: Set<string>;
      onToggleSelect: (guestId: string, selected: boolean) => void;
      onRSVPUpdate: (guestId: string, newStatus: RSVPStatus) => Promise<void>;
      onRemove: (guestId: string) => Promise<void>;
    };
  }

  const VirtualizedRow = useCallback(({ index, style, data }: VirtualizedRowProps) => {
    const guest = data.guests[index];
    const isSelected = data.selectedGuests.has(guest.id);

    return (
      <div style={style}>
        <GuestListItem
          guest={guest}
          isSelected={isSelected}
          onToggleSelect={data.onToggleSelect}
          onRSVPUpdate={data.onRSVPUpdate}
          onRemove={data.onRemove}
        />
      </div>
    );
  }, []);

  // Show loading state
  if (loading) {
    return (
      <CardContainer className={className}>
        <GuestListShimmer />
      </CardContainer>
    );
  }

  // Show empty state
  if (guests.length === 0) {
    return (
      <CardContainer className={className}>
        <GuestListEmpty />
      </CardContainer>
    );
  }

  return (
    <CardContainer className={cn('overflow-hidden', className)}>
      {/* List header with count */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Guest List
          </h3>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {guests.length} guest{guests.length !== 1 ? 's' : ''}
            </span>
            {shouldVirtualize && (
              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                Virtualized
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Guest list content */}
      <div className="relative">
        {shouldVirtualize ? (
          // Virtualized list for large datasets
          <List
            ref={listRef}
            height={Math.min(LIST_HEIGHT, guests.length * ITEM_HEIGHT)}
            width="100%"
            itemCount={guests.length}
            itemSize={ITEM_HEIGHT}
            itemData={itemData}
            overscanCount={5} // Render 5 extra items for smooth scrolling
            className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
          >
            {VirtualizedRow}
          </List>
        ) : (
          // Regular list for smaller datasets
          <div className="divide-y divide-gray-100">
            {guests.map((guest) => (
              <GuestListItem
                key={guest.id}
                guest={guest}
                isSelected={selectedGuests.has(guest.id)}
                onToggleSelect={onToggleSelect}
                onRSVPUpdate={onRSVPUpdate}
                onRemove={onRemove}
              />
            ))}
          </div>
        )}

        {/* Load more indicator (for future infinite scroll) */}
        {pagination.hasNextPage && (
          <div className="p-4 text-center border-t border-gray-100">
            <button
              onClick={onLoadMore}
              className="text-sm text-[#FF6B6B] hover:text-[#FF5555] font-medium"
            >
              Load more guests...
            </button>
          </div>
        )}
      </div>

      {/* Performance info (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="px-6 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
          {shouldVirtualize 
            ? `Using virtualization (${guests.length} guests, ~${Math.ceil(guests.length / 10)}ms render time)`
            : `Regular rendering (${guests.length} guests)`
          }
        </div>
      )}
    </CardContainer>
  );
});

GuestList.displayName = 'GuestList';