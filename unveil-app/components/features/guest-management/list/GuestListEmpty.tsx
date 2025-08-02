'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { PrimaryButton } from '@/components/ui';

export interface GuestListEmptyProps {
  searchTerm?: string;
  hasFilters?: boolean;
  onImportGuests?: () => void;
  onClearFilters?: () => void;
  className?: string;
}

/**
 * Empty state component for guest list
 * Shows different messages and actions based on context
 */
export const GuestListEmpty = memo<GuestListEmptyProps>(({
  searchTerm,
  hasFilters = false,
  onImportGuests,
  onClearFilters,
  className
}) => {
  // Determine the appropriate empty state based on context
  const isFiltered = searchTerm || hasFilters;
  
  return (
    <div className={cn('p-8 text-center', className)}>
      <div className="max-w-sm mx-auto">
        {/* Icon */}
        <div className="text-6xl mb-4">
          {isFiltered ? '🔍' : '👥'}
        </div>
        
        {/* Title */}
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {isFiltered ? 'No guests match your filters' : 'No guests yet'}
        </h3>
        
        {/* Description */}
        <p className="text-gray-600 mb-6">
          {isFiltered 
            ? 'Try adjusting your search or filters to find the guests you\'re looking for.'
            : 'Get started by importing your guest list or adding guests individually.'
          }
        </p>
        
        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {isFiltered ? (
            // Filtered state actions
            <>
              {onClearFilters && (
                <button
                  onClick={onClearFilters}
                  className="px-4 py-2 text-[#FF6B6B] border border-[#FF6B6B] rounded-lg hover:bg-[#FF6B6B] hover:text-white transition-colors"
                >
                  Clear Filters
                </button>
              )}
              {searchTerm && (
                <p className="text-sm text-gray-500">
                  Searching for: <span className="font-medium">&ldquo;{searchTerm}&rdquo;</span>
                </p>
              )}
            </>
          ) : (
            // Empty state actions
            <>
              {onImportGuests && (
                <PrimaryButton
                  onClick={onImportGuests}
                  className="flex items-center gap-2"
                >
                  <span>📄</span>
                  Import Guest List
                </PrimaryButton>
              )}
              <button
                disabled
                className="px-4 py-2 text-gray-400 border border-gray-200 rounded-lg opacity-50 cursor-not-allowed"
                title="Add individual guests coming soon"
              >
                Add Individual Guest
              </button>
            </>
          )}
        </div>
        
        {/* Help text */}
        {!isFiltered && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg text-left">
            <h4 className="text-sm font-medium text-blue-900 mb-2">
              💡 Getting Started Tips
            </h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Import guests from a CSV file for bulk adding</li>
              <li>• Include names, phone numbers, and email addresses</li>
              <li>• Guests will receive invitations via SMS or email</li>
              <li>• Track RSVPs in real-time as responses come in</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
});

GuestListEmpty.displayName = 'GuestListEmpty';