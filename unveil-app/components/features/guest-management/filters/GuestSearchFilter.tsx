'use client';

import { memo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/common';

export interface GuestSearchFilterProps {
  searchTerm: string;
  onSearchChange: (searchTerm: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Search filter component with debounced input
 * Allows searching guests by name, email, phone, etc.
 */
export const GuestSearchFilter = memo<GuestSearchFilterProps>(({
  searchTerm,
  onSearchChange,
  placeholder = 'Search guests by name, email, or phone...',
  className
}) => {
  const [localValue, setLocalValue] = useState(searchTerm);
  const debouncedValue = useDebounce(localValue, 300);

  // Update parent when debounced value changes
  useEffect(() => {
    if (debouncedValue !== searchTerm) {
      onSearchChange(debouncedValue);
    }
  }, [debouncedValue, searchTerm, onSearchChange]);

  // Sync with external changes
  useEffect(() => {
    setLocalValue(searchTerm);
  }, [searchTerm]);

  const handleClear = () => {
    setLocalValue('');
    onSearchChange('');
  };

  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <input
          type="text"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          placeholder={placeholder}
          className={cn(
            'w-full pl-10 pr-10 py-3 border border-gray-200 rounded-lg',
            'focus:ring-2 focus:ring-[#FF6B6B] focus:border-[#FF6B6B]',
            'text-sm placeholder-gray-500',
            'transition-all duration-200'
          )}
          aria-label="Search guests"
        />
        
        {/* Search icon */}
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
          <svg 
            className="w-4 h-4" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        
        {/* Clear button */}
        {localValue && (
          <button
            onClick={handleClear}
            className={cn(
              'absolute right-3 top-1/2 transform -translate-y-1/2',
              'text-gray-400 hover:text-gray-600 transition-colors',
              'p-1 rounded-full hover:bg-gray-100'
            )}
            aria-label="Clear search"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      
      {/* Search results indicator */}
      {localValue && (
        <div className="mt-2 text-xs text-gray-500">
          Searching for &ldquo;{localValue}&rdquo;
        </div>
      )}
    </div>
  );
});

GuestSearchFilter.displayName = 'GuestSearchFilter';