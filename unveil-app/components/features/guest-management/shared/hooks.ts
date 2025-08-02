/**
 * Shared hooks for guest management components
 * Provides reusable logic for common guest management operations
 */

import { useState, useCallback, useMemo } from 'react';
import { OptimizedGuest, GuestFilters } from './types';
import { useDebounce } from '@/hooks/common';

/**
 * Hook for managing guest selection state
 */
export function useGuestSelection(guests: OptimizedGuest[]) {
  const [selectedGuests, setSelectedGuests] = useState<Set<string>>(new Set());

  const toggleGuestSelection = useCallback((guestId: string, selected: boolean) => {
    setSelectedGuests(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(guestId);
      } else {
        newSet.delete(guestId);
      }
      return newSet;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedGuests(new Set());
  }, []);

  const selectAll = useCallback(() => {
    setSelectedGuests(new Set(guests.map(guest => guest.id)));
  }, [guests]);

  const selectFiltered = useCallback((filteredGuests: OptimizedGuest[]) => {
    setSelectedGuests(new Set(filteredGuests.map(guest => guest.id)));
  }, []);

  const isAllSelected = useMemo(() => 
    selectedGuests.size === guests.length && guests.length > 0,
    [selectedGuests.size, guests.length]
  );

  const isPartiallySelected = useMemo(() => 
    selectedGuests.size > 0 && selectedGuests.size < guests.length,
    [selectedGuests.size, guests.length]
  );

  return {
    selectedGuests,
    toggleGuestSelection,
    clearSelection,
    selectAll,
    selectFiltered,
    isAllSelected,
    isPartiallySelected,
  };
}

/**
 * Hook for managing filter state with debouncing
 */
export function useGuestFilters() {
  const [filters, setFilters] = useState<GuestFilters>({
    searchTerm: '',
    rsvpStatus: 'all',
    tags: [],
  });

  const debouncedSearchTerm = useDebounce(filters.searchTerm, 300);

  const updateFilters = useCallback((updates: Partial<GuestFilters>) => {
    setFilters(prev => ({ ...prev, ...updates }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      searchTerm: '',
      rsvpStatus: 'all',
      tags: [],
    });
  }, []);

  const hasActiveFilters = useMemo(() => {
    return debouncedSearchTerm !== '' || 
           filters.rsvpStatus !== 'all' || 
           filters.tags.length > 0;
  }, [debouncedSearchTerm, filters.rsvpStatus, filters.tags.length]);

  return {
    filters: {
      ...filters,
      searchTerm: debouncedSearchTerm, // Use debounced version for filtering
    },
    rawFilters: filters, // Raw filters for UI state
    updateFilters,
    resetFilters,
    hasActiveFilters,
  };
}

/**
 * Hook for filtering guests based on current filters
 */
export function useFilteredGuests(guests: OptimizedGuest[], filters: GuestFilters) {
  return useMemo(() => {
    let filtered = guests;

    // Search filter
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(guest => {
        const guestName = guest.guest_name?.toLowerCase() || '';
        const guestEmail = guest.guest_email?.toLowerCase() || '';
        const phone = guest.phone?.toLowerCase() || '';
        const userFullName = guest.users?.full_name?.toLowerCase() || '';
        const userEmail = guest.users?.email?.toLowerCase() || '';
        
        return (
          guestName.includes(searchLower) ||
          guestEmail.includes(searchLower) ||
          phone.includes(searchLower) ||
          userFullName.includes(searchLower) ||
          userEmail.includes(searchLower)
        );
      });
    }

    // RSVP status filter
    if (filters.rsvpStatus !== 'all') {
      filtered = filtered.filter(guest => {
        if (!guest.rsvp_status) return filters.rsvpStatus === 'pending';
        return guest.rsvp_status === filters.rsvpStatus;
      });
    }

    // Tag filter
    if (filters.tags.length > 0) {
      filtered = filtered.filter(guest => {
        const guestTags = guest.guest_tags || [];
        return filters.tags.some(tag => guestTags.includes(tag));
      });
    }

    return filtered;
  }, [guests, filters]);
}

/**
 * Hook for bulk operations with progress tracking
 */
export function useBulkOperations() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });

  const processBulkOperation = useCallback(async <T>(
    items: T[],
    operation: (item: T, index: number) => Promise<void>,
    onProgress?: (processed: number, total: number) => void
  ) => {
    setIsProcessing(true);
    setProgress({ processed: 0, total: items.length });

    try {
      for (let i = 0; i < items.length; i++) {
        await operation(items[i], i);
        const processed = i + 1;
        setProgress({ processed, total: items.length });
        onProgress?.(processed, items.length);
      }
    } finally {
      setIsProcessing(false);
      setProgress({ processed: 0, total: 0 });
    }
  }, []);

  return {
    isProcessing,
    progress,
    processBulkOperation,
  };
}

/**
 * Hook for optimistic updates with rollback capability
 */
export function useOptimisticUpdates<T extends { id: string }>(items: T[]) {
  const [optimisticItems, setOptimisticItems] = useState<T[]>([]);
  const [originalItems, setOriginalItems] = useState<Map<string, T>>(new Map());

  // Reset optimistic state when items change
  useMemo(() => {
    setOptimisticItems(items);
    setOriginalItems(new Map());
  }, [items]);

  const updateOptimistically = useCallback((id: string, updates: Partial<T>) => {
    setOptimisticItems(prev => {
      const item = prev.find(item => item.id === id);
      if (!item) return prev;

      // Store original if not already stored
      setOriginalItems(originals => {
        if (!originals.has(id)) {
          return new Map(originals).set(id, item);
        }
        return originals;
      });

      return prev.map(item => 
        item.id === id ? { ...item, ...updates } : item
      );
    });
  }, []);

  const commitUpdate = useCallback((id: string) => {
    setOriginalItems(prev => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
  }, []);

  const rollbackUpdate = useCallback((id: string) => {
    const original = originalItems.get(id);
    if (original) {
      setOptimisticItems(prev => 
        prev.map(item => item.id === id ? original : item)
      );
      setOriginalItems(prev => {
        const newMap = new Map(prev);
        newMap.delete(id);
        return newMap;
      });
    }
  }, [originalItems]);

  const rollbackAll = useCallback(() => {
    setOptimisticItems(prev => 
      prev.map(item => {
        const original = originalItems.get(item.id);
        return original || item;
      })
    );
    setOriginalItems(new Map());
  }, [originalItems]);

  return {
    items: optimisticItems,
    updateOptimistically,
    commitUpdate,
    rollbackUpdate,
    rollbackAll,
    hasPendingUpdates: originalItems.size > 0,
  };
}

/**
 * Hook for extracting available tags from guests
 */
export function useAvailableTags(guests: OptimizedGuest[]) {
  return useMemo(() => {
    const tagSet = new Set<string>();
    guests.forEach(guest => {
      if (guest.guest_tags) {
        guest.guest_tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  }, [guests]);
}