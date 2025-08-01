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

  // Optimized guest data fetching
  const fetchGuestsOptimized = useCallback(async (page: number = 1): Promise<{
    data: OptimizedGuest[];
    count: number;
  }> => {
    const startIndex = enablePagination ? (page - 1) * pageSize : 0;
    const endIndex = enablePagination ? startIndex + pageSize - 1 : undefined;

    let query = supabase
      .from('event_guests')
      .select(`
        id,
        event_id,
        user_id,
        guest_name,
        guest_email,
        phone,
        rsvp_status,
        notes,
        guest_tags,
        role,
        invited_at,
        phone_number_verified,
        sms_opt_out,
        preferred_communication,
        created_at,
        updated_at,
        users!user_id(
          id,
          full_name,
          phone,
          email,
          avatar_url,
          created_at,
          updated_at,
          intended_redirect,
          onboarding_completed
        )
      `, { count: 'exact' })
      .eq('event_id', eventId);

    if (enablePagination && endIndex !== undefined) {
      query = query.range(startIndex, endIndex);
    }

    const { data, error, count } = await query;

    if (error) {
      logger.databaseError('Error fetching guests', error);
      throw error;
    }

    return {
      data: data || [],
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