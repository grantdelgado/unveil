import { useMemo } from 'react';
import type { OptimizedGuest } from '@/hooks/guests/useGuestData';

interface StatusCounts {
  total: number;
  attending: number;
  pending: number;
  maybe: number;
  declined: number;
}

interface UseGuestStatusCountsReturn {
  statusCounts: StatusCounts;
}

/**
 * Focused hook for guest status counting logic
 * Split from useGuestData for better performance and maintainability
 */
export function useGuestStatusCounts(
  guests: OptimizedGuest[]
): UseGuestStatusCountsReturn {
  // Memoized status counting to prevent unnecessary recalculations
  const statusCounts = useMemo(() => {
    const counts: StatusCounts = {
      total: guests.length,
      attending: 0,
      pending: 0,
      maybe: 0,
      declined: 0,
    };

    guests.forEach(guest => {
      const status = guest.rsvp_status?.toLowerCase();
      switch (status) {
        case 'attending':
          counts.attending++;
          break;
        case 'maybe':
          counts.maybe++;
          break;
        case 'declined':
          counts.declined++;
          break;
        default:
          counts.pending++;
          break;
      }
    });

    return counts;
  }, [guests]);

  return {
    statusCounts,
  };
}