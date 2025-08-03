'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { PrimaryButton, SecondaryButton } from '@/components/ui';
import type { GuestStatusCounts } from './types';

interface GuestControlPanelProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filterByRSVP: 'all' | 'attending' | 'pending';
  onFilterChange: (filter: 'all' | 'attending' | 'pending') => void;
  statusCounts: GuestStatusCounts;
  onImportGuests: () => void;
  hasGuests: boolean;
  className?: string;
}

interface FilterButtonProps {
  filter: 'all' | 'attending' | 'pending';
  isActive: boolean;
  count: number;
  onClick: () => void;
}

const FilterButton = memo<FilterButtonProps>(({ filter, isActive, count, onClick }) => {
  const config = {
    all: { label: 'All', emoji: '👥' },
    attending: { label: 'Attending', emoji: '✅' },
    pending: { label: 'Pending', emoji: '⏳' },
  };

  const { label, emoji } = config[filter];

  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
        'min-h-[44px] flex items-center gap-2',
        'border focus:outline-none focus:ring-2 focus:ring-pink-300 focus:ring-offset-1',
        isActive
          ? 'bg-pink-50 text-pink-700 border-pink-200 shadow-sm'
          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
      )}
      aria-pressed={isActive}
      aria-label={`Filter by ${label} (${count} guests)`}
    >
      <span className="text-base">{emoji}</span>
      <span>{label}</span>
      <span className={cn(
        'ml-1 px-2 py-0.5 rounded-full text-xs font-semibold',
        isActive 
          ? 'bg-pink-100 text-pink-700'
          : 'bg-gray-100 text-gray-600'
      )}>
        {count}
      </span>
    </button>
  );
});

FilterButton.displayName = 'FilterButton';

export const GuestControlPanel = memo<GuestControlPanelProps>(({
  searchTerm,
  onSearchChange,
  filterByRSVP,
  onFilterChange,
  statusCounts,
  onImportGuests,
  hasGuests,
  className,
}) => {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Top Row: Search and Import */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search Bar */}
        <div className="flex-1">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-400 text-lg">🔍</span>
            </div>
            <input
              type="text"
              placeholder="Search guests by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className={cn(
                'block w-full pl-10 pr-3 py-3 text-sm',
                'border border-gray-200 rounded-lg',
                'placeholder-gray-500 text-gray-900',
                'focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-pink-300',
                'transition-colors duration-200',
                'min-h-[44px]'
              )}
              aria-label="Search guests"
            />
          </div>
        </div>

        {/* Import Button */}
        <div className="sm:w-auto">
          {hasGuests ? (
            <SecondaryButton
              onClick={onImportGuests}
              fullWidth={false}
              className="flex items-center justify-center gap-2 min-h-[44px] px-6"
            >
              <span>📄</span>
              Import More
            </SecondaryButton>
          ) : (
            <PrimaryButton
              onClick={onImportGuests}
              fullWidth={false}
              className="flex items-center justify-center gap-2 min-h-[44px] px-6"
            >
              <span>📄</span>
              Import Guests
            </PrimaryButton>
          )}
        </div>
      </div>

      {/* Bottom Row: Filters and Guest Count */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2">
          <FilterButton
            filter="all"
            isActive={filterByRSVP === 'all'}
            count={statusCounts.total}
            onClick={() => onFilterChange('all')}
          />
          <FilterButton
            filter="attending"
            isActive={filterByRSVP === 'attending'}
            count={statusCounts.attending}
            onClick={() => onFilterChange('attending')}
          />
          <FilterButton
            filter="pending"
            isActive={filterByRSVP === 'pending'}
            count={statusCounts.pending}
            onClick={() => onFilterChange('pending')}
          />
        </div>

        {/* Guest Count Summary */}
        {hasGuests && (
          <div className="text-sm text-gray-600 font-medium">
            <span className="hidden sm:inline">Total: </span>
            <span className="text-gray-900 font-semibold">{statusCounts.total}</span>
            <span className="text-gray-500"> guests</span>
          </div>
        )}
      </div>
    </div>
  );
});

GuestControlPanel.displayName = 'GuestControlPanel';