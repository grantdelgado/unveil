/**
 * Hook for debouncing a value to prevent excessive API calls
 * 
 * @param value The value to debounce
 * @param delay Delay in milliseconds
 * @returns The debounced value
 */

import { useState, useEffect } from 'react';

export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook for debouncing a search term specifically
 * Uses the configured search debounce delay from GuestsFlags
 */
export function useDebouncedSearch(searchTerm: string): string {
  // Import here to avoid circular dependencies
  const { GuestsFlags } = require('@/lib/config/guests');
  return useDebouncedValue(searchTerm, GuestsFlags.searchDebounceMs);
}
