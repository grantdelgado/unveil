import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { updateEventDetails, verifyHostPermissions } from '@/lib/services/events';
import type { EventDetailsFormData } from '@/lib/validation/events';
import { logger } from '@/lib/logger';

interface UseEventDetailsReturn {
  updateEvent: (
    eventId: string, 
    data: EventDetailsFormData
  ) => Promise<{ success: boolean; error?: string }>;
  isUpdating: boolean;
  error: string | null;
}

/**
 * Hook for managing event details updates
 * Handles validation, permissions, and cache invalidation
 */
export function useEventDetails(): UseEventDetailsReturn {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const updateEvent = useCallback(async (
    eventId: string, 
    formData: EventDetailsFormData
  ): Promise<{ success: boolean; error?: string }> => {
    setIsUpdating(true);
    setError(null);

    try {
      // First verify host permissions
      const permissionCheck = await verifyHostPermissions(eventId);
      if (!permissionCheck.success) {
        setError(permissionCheck.error || 'Permission denied');
        return { success: false, error: permissionCheck.error };
      }

      // Update the event
      const result = await updateEventDetails(eventId, formData);
      
      if (result.success) {
        // Invalidate relevant queries to refresh data
        await Promise.all([
          // Invalidate event details
          queryClient.invalidateQueries({ queryKey: ['event', eventId] }),
          // Invalidate host events list
          queryClient.invalidateQueries({ queryKey: ['host-events'] }),
          // Invalidate event with guest data
          queryClient.invalidateQueries({ queryKey: ['event-with-guest', eventId] }),
        ]);

        logger.api('Event details updated successfully', { eventId }, 'useEventDetails.updateEvent');
        
        return { success: true };
      } else {
        const errorMessage = result.error || 'Failed to update event';
        setError(errorMessage);
        logger.apiError('Event details update failed', new Error(errorMessage), 'useEventDetails.updateEvent');
        
        return { success: false, error: errorMessage };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unexpected error occurred';
      setError(errorMessage);
      logger.apiError('Event details update exception', error, 'useEventDetails.updateEvent');
      
      return { success: false, error: errorMessage };
    } finally {
      setIsUpdating(false);
    }
  }, [queryClient]);

  return {
    updateEvent,
    isUpdating,
    error,
  };
}
