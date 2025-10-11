'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { SecondaryButton } from '@/components/ui';
import type { GuestStatusCounts } from './types';

interface GuestControlPanelProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filterByRSVP: 'all' | 'attending' | 'declined' | 'not_invited' | 'invited';
  onFilterChange: (
    filter: 'all' | 'attending' | 'declined' | 'not_invited' | 'invited',
  ) => void;
  statusCounts: GuestStatusCounts;
  onImportGuests: () => void;
  onAddIndividualGuest?: () => void;
  onSendInvitations?: () => void; // New bulk invitation action
  hasGuests: boolean;
  className?: string;
}

interface FilterButtonProps {
  filter: 'all' | 'attending' | 'declined' | 'not_invited' | 'invited';
  isActive: boolean;
  count: number;
  onClick: () => void;
}

const FilterButton = memo<FilterButtonProps>(
  ({ filter, isActive, count, onClick }) => {
    const config = {
      all: { label: 'All', emoji: '👥' },
      not_invited: { label: 'Not Invited', emoji: '📝' },
      invited: { label: 'Invited', emoji: '📬' },
      attending: { label: 'Attending', emoji: '✅' },
      declined: { label: 'Declined', emoji: '❌' },
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
            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300',
        )}
        aria-pressed={isActive}
        aria-label={`Filter by ${label} (${count} guests)`}
      >
        <span className="text-base">{emoji}</span>
        <span>{label}</span>
        <span
          className={cn(
            'ml-1 px-2 py-0.5 rounded-full text-xs font-semibold',
            isActive
              ? 'bg-pink-100 text-pink-700'
              : 'bg-gray-100 text-gray-600',
          )}
        >
          {count}
        </span>
      </button>
    );
  },
);

FilterButton.displayName = 'FilterButton';

export const GuestControlPanel = memo<GuestControlPanelProps>(
  ({
    searchTerm,
    onSearchChange,
    filterByRSVP,
    onFilterChange,
    statusCounts,
    onImportGuests,
    onAddIndividualGuest,
    onSendInvitations,
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
                type="search"
                placeholder="Search guests by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className={cn(
                  'block w-full pl-10 pr-3 py-3 text-sm',
                  'border border-gray-200 rounded-lg',
                  'placeholder-gray-500 text-gray-900',
                  'focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-pink-300',
                  'transition-colors duration-200',
                  'min-h-[44px]',
                )}
                aria-label="Search guests"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 sm:w-auto">
            {/* Send Invitations button - only show when there are uninvited guests */}
            {onSendInvitations && statusCounts.not_invited > 0 && (
              <SecondaryButton
                onClick={onSendInvitations}
                fullWidth={false}
                className="flex items-center justify-center gap-2 min-h-[44px] px-4 bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100 hover:border-pink-300"
              >
                <span>📨</span>
                Send Invitations ({statusCounts.not_invited})
              </SecondaryButton>
            )}
            <SecondaryButton
              onClick={onAddIndividualGuest || (() => {})}
              fullWidth={false}
              className="flex items-center justify-center gap-2 min-h-[44px] px-4"
            >
              <span>👤</span>
              Add Guest
            </SecondaryButton>
            <SecondaryButton
              onClick={onImportGuests}
              fullWidth={false}
              className="flex items-center justify-center gap-2 min-h-[44px] px-4"
            >
              <span>📄</span>
              Import CSV
            </SecondaryButton>
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
              filter="not_invited"
              isActive={filterByRSVP === 'not_invited'}
              count={statusCounts.not_invited}
              onClick={() => onFilterChange('not_invited')}
            />
            <FilterButton
              filter="invited"
              isActive={filterByRSVP === 'invited'}
              count={statusCounts.invited}
              onClick={() => onFilterChange('invited')}
            />

            <FilterButton
              filter="declined"
              isActive={filterByRSVP === 'declined'}
              count={statusCounts.declined}
              onClick={() => onFilterChange('declined')}
            />
          </div>

          {/* Guest Count Summary */}
          {hasGuests && (
            <div className="text-sm text-gray-600 font-medium">
              <span className="hidden sm:inline">Total: </span>
              <span className="text-gray-900 font-semibold">
                {statusCounts.total}
              </span>
              <span className="text-gray-500"> guests</span>
            </div>
          )}
        </div>
      </div>
    );
  },
);

GuestControlPanel.displayName = 'GuestControlPanel';
