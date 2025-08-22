'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface SearchInputProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

export function SearchInput({
  placeholder = 'Search...',
  value,
  onChange,
  className,
  disabled = false,
}: SearchInputProps) {
  return (
    <div className={cn('relative', className)}>
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <svg
          className="h-5 w-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          'w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-base',
          'focus:ring-2 focus:ring-purple-500 focus:border-transparent',
          'placeholder:text-gray-400',
          'disabled:bg-gray-50 disabled:text-gray-500',
          className,
        )}
        style={{ minHeight: '48px' }} // Ensure ≥44px touch target
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          disabled={disabled}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
