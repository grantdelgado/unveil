'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { RSVP_STATUS, type RSVPStatus } from '@/lib/types/rsvp';
import { GuestStatusCounts } from '../shared/types';

export interface RSVPStatusFilterProps {
  activeFilter: RSVPStatus | 'all';
  onFilterChange: (status: RSVPStatus | 'all') => void;
  statusCounts: GuestStatusCounts;
  className?: string;
}

/**
 * Filter component for RSVP status with pill-style buttons
 * Shows counts for each status and highlights active filter
 */
export const RSVPStatusFilter = memo<RSVPStatusFilterProps>(({
  activeFilter,
  onFilterChange,
  statusCounts,
  className
}) => {
  // Status configuration for pills
  const statusOptions = [
    {
      key: 'all',
      label: 'All',
      emoji: '👥',
      count: statusCounts.total,
      bgColor: 'bg-gray-50',
      textColor: 'text-gray-800',
      activeBgColor: 'bg-gray-100',
      activeTextColor: 'text-gray-900',
    },
    {
      key: RSVP_STATUS.ATTENDING,
      label: 'Attending',
      emoji: '✅',
      count: statusCounts.attending,
      bgColor: 'bg-green-50',
      textColor: 'text-green-800',
      activeBgColor: 'bg-green-100',
      activeTextColor: 'text-green-900',
    },
    {
      key: RSVP_STATUS.MAYBE,
      label: 'Maybe',
      emoji: '🤷‍♂️',
      count: statusCounts.maybe,
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-800',
      activeBgColor: 'bg-yellow-100',
      activeTextColor: 'text-yellow-900',
    },
    {
      key: RSVP_STATUS.DECLINED,
      label: 'Declined',
      emoji: '❌',
      count: statusCounts.declined,
      bgColor: 'bg-red-50',
      textColor: 'text-red-800',
      activeBgColor: 'bg-red-100',
      activeTextColor: 'text-red-900',
    },
    {
      key: RSVP_STATUS.PENDING,
      label: 'Pending',
      emoji: '⏳',
      count: statusCounts.pending,
      bgColor: 'bg-gray-50',
      textColor: 'text-gray-800',
      activeBgColor: 'bg-gray-100',
      activeTextColor: 'text-gray-900',
    },
  ];

  return (
    <div className={cn('space-y-2', className)}>
      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide py-2">
        {statusOptions.map((option) => {
          const isActive = activeFilter === option.key;
          
          return (
            <button
              key={option.key}
              onClick={() => onFilterChange(option.key as RSVPStatus | 'all')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium',
                'whitespace-nowrap flex-shrink-0 transition-all duration-200',
                'border-2 min-h-[44px]', // Touch-friendly
                isActive ? [
                  option.activeBgColor,
                  option.activeTextColor,
                  'border-current',
                  'shadow-sm'
                ] : [
                  option.bgColor,
                  option.textColor,
                  'border-transparent',
                  'hover:border-gray-200'
                ]
              )}
              aria-label={`Filter by ${option.label}. ${option.count} guests.`}
              aria-pressed={isActive}
            >
              <span aria-hidden="true">{option.emoji}</span>
              <span>{option.label}</span>
              <span className={cn(
                'px-2 py-1 rounded-full text-xs font-semibold',
                isActive ? 'bg-white bg-opacity-20' : 'bg-black bg-opacity-10'
              )}>
                {option.count}
              </span>
            </button>
          );
        })}
      </div>
      
      {/* Active filter indicator */}
      {activeFilter !== 'all' && (
        <div className="text-xs text-gray-500">
          Showing {statusCounts[activeFilter as RSVPStatus]} {activeFilter} guests
          <button
            onClick={() => onFilterChange('all')}
            className="ml-2 text-[#FF6B6B] hover:underline"
          >
            Clear filter
          </button>
        </div>
      )}
    </div>
  );
});

RSVPStatusFilter.displayName = 'RSVPStatusFilter';