import { useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { smartInvalidation } from '@/lib/queryUtils';
import { useQueryClient } from '@tanstack/react-query';

interface UseGuestMutationsOptions {
  eventId: string;
  onGuestUpdated?: () => void;
  onOptimisticRollback?: (guestId: string) => void;
}

interface UseGuestMutationsReturn {
  handleRSVPUpdate: (guestId: string, newStatus: string) => Promise<void>;
  handleRemoveGuest: (guestId: string) => Promise<void>;
  handleMarkAllPendingAsAttending: () => Promise<void>;
  handleBulkRSVPUpdate: (guestIds: string[], newStatus: string) => Promise<void>;
}

/**
 * Focused hook for guest mutation operations (RSVP updates, bulk operations)
 * Split from useGuestData for better performance and maintainability
 */
export function useGuestMutations({ 
  eventId, 
  onGuestUpdated,
  onOptimisticRollback 
}: UseGuestMutationsOptions): UseGuestMutationsReturn {
  const queryClient = useQueryClient();

  // Single guest RSVP update with optimistic updates
  const handleRSVPUpdate = useCallback(async (guestId: string, newStatus: string) => {
    // Optimistically update React Query cache immediately
    const guestQueryKey = ['guests', eventId];
    
    // Cancel any outgoing refetches (to avoid overwriting our optimistic update)
    await queryClient.cancelQueries({ queryKey: guestQueryKey });
    
    // Snapshot the previous value for potential rollback
    const previousData = queryClient.getQueryData(guestQueryKey);
    
    // Optimistically update the cache
    queryClient.setQueryData(guestQueryKey, (oldData: any) => {
      if (!oldData || !Array.isArray(oldData)) return oldData;
      
      return oldData.map((guest: any) =>
        guest.id === guestId
          ? { ...guest, rsvp_status: newStatus }
          : guest
      );
    });
    
    // Trigger immediate callback for other listeners
    onGuestUpdated?.();
    
    try {
      const { error } = await supabase
        .from('event_guests')
        .update({ rsvp_status: newStatus })
        .eq('id', guestId);

      if (error) throw error;
      
      // Use centralized smart invalidation for RSVP updates
      await smartInvalidation({
        queryClient,
        mutationType: 'rsvp',
        eventId
      });
      
    } catch (updateError) {
      // Rollback optimistic update on error
      queryClient.setQueryData(guestQueryKey, previousData);
      onOptimisticRollback?.(guestId);
      
      logger.databaseError('Error updating RSVP', updateError);
      throw updateError;
    }
  }, [eventId, onGuestUpdated, onOptimisticRollback, queryClient]);

  // Remove guest
  const handleRemoveGuest = useCallback(async (guestId: string) => {
    try {
      const { error } = await supabase
        .from('event_guests')
        .delete()
        .eq('id', guestId);

      if (error) throw error;
      
      // Use centralized smart invalidation for guest removal
      await smartInvalidation({
        queryClient,
        mutationType: 'guest',
        eventId
      });
      
      onGuestUpdated?.();
    } catch (deleteError) {
      logger.databaseError('Error removing guest', deleteError);
      throw deleteError;
    }
  }, [eventId, onGuestUpdated, queryClient]);

  // Mark all pending guests as attending
  const handleMarkAllPendingAsAttending = useCallback(async () => {
    try {
      const { error } = await supabase
        .from('event_guests')
        .update({ rsvp_status: 'attending' })
        .eq('event_id', eventId)
        .or('rsvp_status.is.null,rsvp_status.eq.pending');

      if (error) throw error;
      
      // Use centralized smart invalidation for bulk update
      await smartInvalidation({
        queryClient,
        mutationType: 'rsvp',
        eventId
      });
      
      onGuestUpdated?.();
    } catch (updateError) {
      logger.databaseError('Error marking guests as attending', updateError);
      throw updateError;
    }
  }, [eventId, onGuestUpdated, queryClient]);

  // Bulk RSVP update
  const handleBulkRSVPUpdate = useCallback(async (guestIds: string[], newStatus: string) => {
    try {
      const { error } = await supabase
        .from('event_guests')
        .update({ rsvp_status: newStatus })
        .in('id', guestIds);

      if (error) throw error;
      
      // Use centralized smart invalidation for bulk operation
      await smartInvalidation({
        queryClient,
        mutationType: 'rsvp',
        eventId
      });
      
      onGuestUpdated?.();
    } catch (updateError) {
      logger.databaseError('Error bulk updating RSVP', updateError);
      throw updateError;
    }
  }, [eventId, onGuestUpdated, queryClient]);

  return {
    handleRSVPUpdate,
    handleRemoveGuest,
    handleMarkAllPendingAsAttending,
    handleBulkRSVPUpdate,
  };
}