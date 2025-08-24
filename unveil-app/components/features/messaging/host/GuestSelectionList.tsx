'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/inputs';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { cn } from '@/lib/utils';
import type { GuestWithDisplayName } from '@/lib/types/messaging';

interface GuestSelectionListProps {
  guests: GuestWithDisplayName[];
  selectedGuestIds: string[];
  onToggleGuest: (guestId: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onSearchChange: (query: string) => void;
  totalSelected: number;
  willReceiveMessage: number;
  loading?: boolean;
  className?: string;
  isEditMode?: boolean;
}

/**
 * Guest selection list with individual checkboxes and bulk actions
 * Mobile-optimized with ≥44px touch targets
 */
export function GuestSelectionList({
  guests,
  selectedGuestIds,
  onToggleGuest,
  onSelectAll,
  onClearAll,
  onSearchChange,
  totalSelected,
  willReceiveMessage,
  loading = false,
  className,
  isEditMode = false,
}: GuestSelectionListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    onSearchChange(query);
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header with counts and bulk actions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">
            {isEditMode ? 'Selected Recipients' : 'Select Recipients'}
          </h3>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onSelectAll}
              disabled={loading}
              className="text-xs h-8 px-3"
            >
              Select All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onClearAll}
              disabled={loading || selectedGuestIds.length === 0}
              className="text-xs h-8 px-3"
            >
              Clear All
            </Button>
          </div>
        </div>

        {/* Count summary */}
        <div className={cn(
          "border rounded-lg p-4",
          isEditMode 
            ? "bg-blue-50 border-blue-200" 
            : "bg-purple-50 border-purple-200"
        )}>
          {isEditMode && (
            <div className="text-xs text-blue-700 mb-3 font-medium">
              📝 Selected recipients only — {totalSelected} selected
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className={cn(
                "text-lg font-bold",
                isEditMode ? "text-blue-700" : "text-purple-700"
              )}>
                {totalSelected}
              </div>
              <div className={cn(
                "text-xs",
                isEditMode ? "text-blue-600" : "text-purple-600"
              )}>
                Total Selected
              </div>
            </div>
            <div>
              <div className="text-lg font-bold text-green-700">
                {willReceiveMessage}
              </div>
              <div className="text-xs text-green-600">Will Receive Message</div>
            </div>
          </div>
          {totalSelected !== willReceiveMessage && (
            <div className="text-xs text-amber-600 text-center mt-2">
              {totalSelected - willReceiveMessage} guest(s) will be excluded
              (opted out of SMS)
            </div>
          )}
        </div>

        {/* Search */}
        <SearchInput
          placeholder="Search guests..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="w-full"
        />
      </div>

      {/* Guest list */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="lg" />
          <span className="ml-3 text-gray-600">Loading guests...</span>
        </div>
      ) : guests.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-2xl mb-2">🔍</div>
          <p className="text-sm text-gray-500">
            {searchQuery
              ? 'No guests match your search'
              : 'No eligible guests found'}
          </p>
          {searchQuery && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSearchChange('')}
              className="mt-3"
            >
              Clear search
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {/* Individual guest checkboxes */}
          <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {guests.map((guest) => {
              const isSelected = selectedGuestIds.includes(guest.id);
              const isOptedOut = guest.isOptedOut;
              const isDisabled = isOptedOut;

              return (
                <label
                  key={guest.id}
                  className={cn(
                    'flex items-center space-x-3 p-4 transition-all',
                    isDisabled
                      ? 'cursor-not-allowed opacity-60'
                      : 'cursor-pointer hover:bg-purple-50 focus-within:bg-purple-50',
                    isSelected &&
                      !isDisabled &&
                      'bg-purple-50 border-l-4 border-purple-300',
                  )}
                  style={{ minHeight: '60px' }} // Ensure ≥44px touch target with padding
                >
                  <input
                    type="checkbox"
                    checked={isSelected && !isDisabled}
                    onChange={() => !isDisabled && onToggleGuest(guest.id)}
                    disabled={isDisabled}
                    aria-disabled={isDisabled}
                    className={cn(
                      'h-5 w-5 text-purple-600 focus:ring-purple-500 border-gray-300 rounded flex-shrink-0',
                      isDisabled &&
                        'opacity-50 cursor-not-allowed pointer-events-none',
                    )}
                    style={{ minWidth: '20px', minHeight: '20px' }}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {guest.displayName}
                      </span>

                      <div className="flex items-center space-x-2 flex-shrink-0">
                        {/* SMS opt-out indicator */}
                        {isOptedOut && (
                          <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded">
                            🚫 User opted out
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Guest tags */}
                    {guest.guest_tags && guest.guest_tags.length > 0 && (
                      <div className="flex items-center space-x-1 mt-1">
                        {guest.guest_tags.slice(0, 3).map((tag, index) => (
                          <span
                            key={index}
                            className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                        {guest.guest_tags.length > 3 && (
                          <span className="text-xs text-gray-500">
                            +{guest.guest_tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
