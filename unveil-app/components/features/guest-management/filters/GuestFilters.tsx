'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { GuestFilters as GuestFiltersType, GuestStatusCounts } from '../shared/types';
import { GuestSearchFilter } from './GuestSearchFilter';
import { RSVPStatusFilter } from './RSVPStatusFilter';

export interface GuestFiltersProps {
  filters: GuestFiltersType;
  onFiltersChange: (filters: Partial<GuestFiltersType>) => void;
  statusCounts: GuestStatusCounts;
  availableTags: string[];
  className?: string;
}

/**
 * Container component for all guest filtering options
 * Coordinates between search, status, and tag filters
 */
export const GuestFilters = memo<GuestFiltersProps>(({
  filters,
  onFiltersChange,
  statusCounts,
  availableTags,
  className
}) => {
  const handleSearchChange = (searchTerm: string) => {
    onFiltersChange({ searchTerm });
  };

  const handleStatusFilterChange = (rsvpStatus: string) => {
    onFiltersChange({ rsvpStatus: rsvpStatus as GuestFiltersType['rsvpStatus'] });
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* RSVP Status Filter Pills */}
      <RSVPStatusFilter
        activeFilter={filters.rsvpStatus}
        onFilterChange={handleStatusFilterChange}
        statusCounts={statusCounts}
      />

      {/* Search Filter */}
      <GuestSearchFilter
        searchTerm={filters.searchTerm}
        onSearchChange={handleSearchChange}
      />

      {/* TODO: Add tag filter component when needed */}
      {availableTags.length > 0 && (
        <div className="text-xs text-gray-500">
          Tag filtering coming soon...
        </div>
      )}
    </div>
  );
});

GuestFilters.displayName = 'GuestFilters';