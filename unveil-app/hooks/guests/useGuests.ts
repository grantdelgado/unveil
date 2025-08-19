import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import type { OptimizedGuest } from '@/hooks/guests/useGuestData';


interface UseGuestsOptions {
  eventId: string;
  pageSize?: number;
  enablePagination?: boolean;
}

interface UseGuestsReturn {
  guests: OptimizedGuest[];
  loading: boolean;
  error: Error | null;
  fetchData: () => Promise<void>;
  currentPage: number;
  totalCount: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextPage: () => Promise<void>;
  previousPage: () => Promise<void>;
  goToPage: (page: number) => Promise<void>;
}

/**
 * Focused hook for guest data fetching and pagination
 * Split from useGuestData for better performance and maintainability
 */
export function useGuests({ 
  eventId, 
  pageSize = 50, 
  enablePagination = true 
}: UseGuestsOptions): UseGuestsReturn {
  const [guests, setGuests] = useState<OptimizedGuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Optimized guest data fetching with display names
  const fetchGuestsOptimized = useCallback(async (page: number = 1): Promise<{
    data: OptimizedGuest[];
    count: number;
  }> => {
    const offset = enablePagination ? (page - 1) * pageSize : 0;
    const limit = enablePagination ? pageSize : null;

    // Use RPC function to get guests with computed display names
    const { data: guestData, error } = await supabase
      .rpc('get_event_guests_with_display_names', {
        p_event_id: eventId,
        p_limit: limit ?? undefined,
        p_offset: offset
      });

    if (error) {
      logger.databaseError('Error fetching guests', error);
      throw error;
    }

    // Get total count for pagination
    const { count } = await supabase
      .from('event_guests')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId);

    // Transform to OptimizedGuest format with computed display name
    const optimizedGuests: OptimizedGuest[] = (guestData || []).map(guest => ({
      id: guest.id,
      event_id: guest.event_id,
      user_id: guest.user_id,
      guest_name: guest.guest_name,
      guest_email: guest.guest_email,
      phone: guest.phone,

      notes: guest.notes,
      guest_tags: guest.guest_tags,
      role: guest.role,
      invited_at: guest.invited_at,
      phone_number_verified: guest.phone_number_verified,
      sms_opt_out: guest.sms_opt_out,
      preferred_communication: guest.preferred_communication,
      created_at: guest.created_at,
      updated_at: guest.updated_at,
      // RSVP-Lite fields
      declined_at: guest.declined_at,
      decline_reason: guest.decline_reason,
      display_name: guest.guest_display_name, // Use guest_display_name as display_name
      guest_display_name: guest.guest_display_name,
      users: guest.user_id ? {
        id: guest.user_id,
        full_name: guest.user_full_name,
        phone: guest.user_phone || guest.phone,
        email: guest.user_email || guest.guest_email,
        avatar_url: guest.user_avatar_url,
        created_at: guest.user_created_at,
        updated_at: guest.user_updated_at,
        intended_redirect: guest.user_intended_redirect,
        onboarding_completed: guest.user_onboarding_completed || false,
      } : null,
    }));

    return {
      data: optimizedGuests,
      count: count || 0
    };
  }, [eventId, pageSize, enablePagination]);

  // Main data fetching function
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await fetchGuestsOptimized(currentPage);
      setGuests(result.data);
      setTotalCount(result.count);
    } catch (fetchError) {
      setError(fetchError as Error);
      logger.error('Failed to fetch guests', fetchError);
    } finally {
      setLoading(false);
    }
  }, [fetchGuestsOptimized, currentPage]);

  // Pagination helpers
  const totalPages = Math.ceil(totalCount / pageSize);
  const hasNextPage = enablePagination && currentPage < totalPages;
  const hasPreviousPage = enablePagination && currentPage > 1;

  const nextPage = useCallback(async () => {
    if (hasNextPage) {
      setCurrentPage(prev => prev + 1);
    }
  }, [hasNextPage]);

  const previousPage = useCallback(async () => {
    if (hasPreviousPage) {
      setCurrentPage(prev => prev - 1);
    }
  }, [hasPreviousPage]);

  const goToPage = useCallback(async (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  }, [totalPages]);

  // Fetch data when page changes
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    guests,
    loading,
    error,
    fetchData,
    currentPage,
    totalCount,
    hasNextPage,
    hasPreviousPage,
    nextPage,
    previousPage,
    goToPage,
  };
}