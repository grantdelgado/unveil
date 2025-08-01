import { useState, useMemo } from 'react';
import { useDebounce } from '@/hooks/common';
import type { OptimizedGuest } from '@/hooks/guests/useGuestData';

interface UseGuestFilteringReturn {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filterByRSVP: string;
  setFilterByRSVP: (filter: string) => void;
  filteredGuests: OptimizedGuest[];
}

/**
 * Focused hook for guest search and filtering functionality
 * Split from useGuestData for better performance and maintainability
 */
export function useGuestFiltering(
  guests: OptimizedGuest[]
): UseGuestFilteringReturn {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterByRSVP, setFilterByRSVP] = useState('all');
  
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Memoized filtering logic to prevent unnecessary computations
  const filteredGuests = useMemo(() => {
    let filtered = guests;

    // Apply search filter
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
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

    // Apply RSVP filter
    if (filterByRSVP !== 'all') {
      filtered = filtered.filter(guest => {
        if (!guest.rsvp_status) return filterByRSVP === 'pending';
        return guest.rsvp_status.toLowerCase() === filterByRSVP.toLowerCase();
      });
    }

    return filtered;
  }, [guests, debouncedSearchTerm, filterByRSVP]);

  return {
    searchTerm,
    setSearchTerm,
    filterByRSVP,
    setFilterByRSVP,
    filteredGuests,
  };
}