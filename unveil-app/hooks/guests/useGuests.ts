import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { type EventGuestWithUser } from '@/lib/supabase/types';
import { useGuests as useGuestsDomain } from '@/hooks/useGuests';
import { logError, type AppError } from '@/lib/error-handling';
import { withErrorHandling } from '@/lib/error-handling';
import { getEventGuests } from '@/lib/services/events';

interface UseGuestsReturn {
  guests: EventGuestWithUser[];
  loading: boolean;
  error: AppError | null;
  linkGuest: (
    eventId: string,
    phone: string,
  ) => Promise<{ success: boolean; error: string | null }>;
  refetch: () => Promise<void>;
}

export function useGuests(eventId: string | null): UseGuestsReturn {
  const [guests, setGuests] = useState<EventGuestWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);

  const fetchGuests = useCallback(async () => {
    if (!eventId) {
      setGuests([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Check authentication
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        console.warn('⚠️ No authenticated user for guests');
        setGuests([]);
        setLoading(false);
        return;
      }

      const result = await getEventGuests(eventId);

      if (result.error) {
        // Handle permission errors gracefully
        const errorMessage = result.error instanceof Error ? result.error.message : String(result.error);
        if (errorMessage?.includes('permission')) {
          console.warn('⚠️ No permission to access guests for this event');
          setGuests([]);
          setLoading(false);
          return;
        }
        throw new Error(errorMessage || 'Failed to fetch guests');
      }

      setGuests(result.data || []);
      setLoading(false);
    } catch (err) {
      console.warn('⚠️ useGuests fetchGuests error:', err);
      setGuests([]);
      setLoading(false);
    }
  }, [eventId]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const linkGuest = useCallback(
    async (_eventId: string, _phone: string) => {
      const wrappedLink = withErrorHandling(async () => {
        // Since we don't have linkGuestToUser in the simplified schema,
        // this is a placeholder for future implementation
        console.log(
          'Link guest functionality not implemented in simplified schema',
        );

        // Refresh guests list
        await fetchGuests();
        return { success: true, error: null };
      }, 'useGuests.linkGuest');

      const result = await wrappedLink();
      if (result?.error) {
        logError(result.error, 'useGuests.linkGuest');
        return { success: false, error: result.error.message };
      }
      return { success: true, error: null };
    },
    [fetchGuests],
  );

  const refetch = useCallback(async () => {
    await fetchGuests();
  }, [fetchGuests]);

  useEffect(() => {
    fetchGuests();
  }, [fetchGuests]);

  return {
    guests,
    loading,
    error,
    linkGuest,
    refetch,
  };
}
